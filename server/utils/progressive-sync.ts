import { storage } from "../storage";
import { extractAudioByWordRange, cleanupSegments } from "./audio-extractor";
import { transcribeAudioSegment } from "./whisper-service";
import { findTextMatches } from "./fuzzy-matcher";
import { ObjectStorageService } from "../objectStorage";
import path from "path";
import fs from "fs";

/**
 * Build a word index map for fast lookups
 * Returns an array where index i contains the character position of word i
 */
function buildWordIndexMap(text: string): number[] {
  const wordPositions: number[] = [];
  let inWord = false;
  let wordStartPos = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const isWhitespace = /\s/.test(char);

    if (!inWord && !isWhitespace) {
      // Starting a new word
      wordStartPos = i;
      inWord = true;
      wordPositions.push(wordStartPos);
    } else if (inWord && isWhitespace) {
      // Ending a word
      inWord = false;
    }
  }

  return wordPositions;
}

/**
 * Progressively sync a chunk of words from the EPUB to the audiobook
 * @param sessionId - The sync session ID
 * @param wordStart - Starting word index
 * @param wordCount - Number of words to sync
 * @returns Success status
 */
export async function syncWordChunk(
  sessionId: string,
  wordStart: number,
  wordCount: number
): Promise<boolean> {
  // Declare these outside try block so they're accessible in finally for cleanup
  let audioFilePath: string = '';
  let needsCleanup = false;
  
  try {
    const session = await storage.getSyncSession(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // Don't proceed if session is paused
    if (session.status === "paused") {
      console.log("Session is paused, skipping chunk sync");
      return false;
    }

    const epub = await storage.getEpubBook(session.epubId);
    const audio = await storage.getAudiobook(session.audioId);

    if (!epub || !audio) {
      throw new Error("EPUB or audiobook not found");
    }

    // Download audio file from Object Storage if needed
    audioFilePath = audio.filePath;
    const uploadDir = path.join(process.cwd(), "uploads");
    
    if (audio.objectStoragePath) {
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(audio.objectStoragePath);
      const tempPath = path.join(uploadDir, `temp-audio-progressive-${sessionId}.${audio.format}`);
      
      // Download to temp location for processing
      await new Promise<void>((resolve, reject) => {
        const writeStream = fs.createWriteStream(tempPath);
        const readStream = objectFile.createReadStream();
        readStream.pipe(writeStream);
        writeStream.on('finish', () => resolve());
        writeStream.on('error', reject);
        readStream.on('error', reject);
      });
      
      audioFilePath = tempPath;
      needsCleanup = true;
    }

    // Build word index map for accurate text slicing
    const wordMap = buildWordIndexMap(epub.textContent);
    const totalWords = wordMap.length;

    // Clamp word range to available text
    const actualStart = Math.max(0, Math.min(wordStart, totalWords));
    const actualEnd = Math.min(totalWords, wordStart + wordCount);
    const actualCount = actualEnd - actualStart;

    if (actualCount <= 0) {
      console.log(`No words to sync: start=${wordStart}, count=${wordCount}, totalWords=${totalWords}`);
      return false;
    }

    // Get character indices for this word range
    const startCharIndex = wordMap[actualStart];
    const endCharIndex = actualEnd < totalWords ? wordMap[actualEnd] : epub.textContent.length;
    const textSlice = epub.textContent.slice(startCharIndex, endCharIndex);

    // Extract audio segment based on word range
    const chunkDir = path.join("uploads", `chunks_${sessionId}`);
    const audioSegment = await extractAudioByWordRange(
      audioFilePath,
      actualStart,
      actualCount,
      chunkDir
    );

    // Transcribe the audio segment
    const transcription = await transcribeAudioSegment(audioSegment.filePath);

    // Match transcription to text slice
    const matches = findTextMatches(textSlice, [{
      text: transcription.text,
      timestamp: audioSegment.startTime,
    }]);

    // Adjust matches to global text indices (not slice-relative)
    const adjustedMatches = matches.map(match => ({
      audioTime: match.audioTime,
      textIndex: match.textIndex + startCharIndex,
      confidence: match.confidence,
    }));

    // Merge with existing sync anchors
    const existingAnchors = session.syncAnchors || [];
    const mergedAnchors = [...existingAnchors, ...adjustedMatches]
      .sort((a, b) => a.audioTime - b.audioTime);

    // Remove duplicates (keep higher confidence)
    const uniqueAnchors = mergedAnchors.reduce((acc, anchor) => {
      const existing = acc.find(a => 
        Math.abs(a.audioTime - anchor.audioTime) < 1 && 
        Math.abs(a.textIndex - anchor.textIndex) < 10
      );
      if (existing) {
        if (anchor.confidence > existing.confidence) {
          const index = acc.indexOf(existing);
          acc[index] = anchor;
        }
      } else {
        acc.push(anchor);
      }
      return acc;
    }, [] as typeof adjustedMatches);

    // Update session with new sync points
    // Only update syncedUpToWord if we've progressed further
    const updateData: any = {
      syncAnchors: uniqueAnchors,
    };

    if (actualEnd > (session.syncedUpToWord || 0)) {
      updateData.syncedUpToWord = actualEnd;
      updateData.progress = Math.floor((actualEnd / totalWords) * 100);
      
      if (actualEnd >= totalWords) {
        updateData.status = "complete";
        updateData.currentStep = "complete";
        updateData.progress = 100;
      }
    }

    await storage.updateSyncSession(sessionId, updateData);

    // Cleanup temporary audio segment
    await cleanupSegments([audioSegment.filePath]);

    return true;
  } catch (error: any) {
    console.error(`Error syncing word chunk: ${error.message}`);
    await storage.updateSyncSession(sessionId, {
      status: "error",
      error: `Chunk sync failed: ${error.message}`,
    });
    return false;
  } finally {
    // Always clean up temp audio file if we downloaded it
    if (needsCleanup && audioFilePath && fs.existsSync(audioFilePath)) {
      try {
        fs.unlinkSync(audioFilePath);
      } catch (cleanupError) {
        console.error("Error cleaning up temp audio file:", cleanupError);
      }
    }
  }
}

/**
 * Start progressive sync by syncing the first chunk
 * @param sessionId - The sync session ID
 * @returns Success status
 */
export async function startProgressiveSync(sessionId: string): Promise<boolean> {
  const session = await storage.getSyncSession(sessionId);
  if (!session) {
    throw new Error("Session not found");
  }

  // Update status to processing
  await storage.updateSyncSession(sessionId, {
    status: "processing",
    currentStep: "transcribing",
  });

  // Get the configured chunk size (default 1000 words)
  const chunkSize = session.wordChunkSize || 1000;

  // Sync the first chunk
  return await syncWordChunk(sessionId, 0, chunkSize);
}
