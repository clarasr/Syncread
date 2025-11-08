import { storage } from "../storage";
import { extractAudioByWordRange, extractAudioByTimeRange, cleanupSegments } from "./audio-extractor";
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
 * Find initial alignment between audio and EPUB by searching broadly
 * Handles cases where audio has narrator intro and EPUB has front matter
 * @param sessionId - The sync session ID
 * @param audioFilePath - Path to the audio file (already downloaded if from object storage)
 * @param searchDurationSeconds - How many seconds of audio to transcribe (default 45)
 * @param searchWindowWords - How many words of EPUB to search (default 5000)
 * @returns Initial anchor point {audioTime, textIndex, confidence} or null if no match found
 */
async function findInitialAlignment(
  sessionId: string,
  audioFilePath: string,
  searchDurationSeconds: number = 45,
  searchWindowWords: number = 5000
): Promise<{ audioTime: number; textIndex: number; confidence: number } | null> {
  const session = await storage.getSyncSession(sessionId);
  if (!session) {
    throw new Error("Session not found");
  }

  const epub = await storage.getEpubBook(session.epubId);
  if (!epub) {
    throw new Error("EPUB not found");
  }

  console.log(`[Initial Alignment] Searching first ${searchDurationSeconds}s of audio across first ${searchWindowWords} words of EPUB`);

  // Extract first N seconds of audio (not based on words, but actual time)
  const chunkDir = path.join("uploads", `chunks_${sessionId}`);
  const audioSegment = await extractAudioByTimeRange(
    audioFilePath,
    0, // Start at 0 seconds
    searchDurationSeconds,
    chunkDir
  );

  try {
    // Transcribe the audio segment with detailed segments
    const transcription = await transcribeAudioSegment(audioSegment.filePath);

    if (!transcription.segments || transcription.segments.length === 0) {
      console.warn(`[Initial Alignment] No segments returned from Whisper`);
      return null;
    }

    // Build word map for the EPUB
    const wordMap = buildWordIndexMap(epub.textContent);
    const totalWords = wordMap.length;

    // Limit search window to available words
    const actualSearchWindow = Math.min(searchWindowWords, totalWords);
    
    // Get text slice for the search window
    const searchEndCharIndex = actualSearchWindow < totalWords 
      ? wordMap[actualSearchWindow] 
      : epub.textContent.length;
    const searchText = epub.textContent.slice(0, searchEndCharIndex);

    console.log(`[Initial Alignment] Transcription: "${transcription.text.substring(0, 100)}..."`);
    console.log(`[Initial Alignment] Found ${transcription.segments.length} segments from Whisper`);
    
    // Log each segment with timestamp for debugging
    console.log(`[Initial Alignment] Whisper segments:`);
    transcription.segments.forEach((seg, idx) => {
      console.log(`  [${idx}] ${seg.start.toFixed(1)}s-${seg.end.toFixed(1)}s: "${seg.text}"`);
    });
    
    console.log(`[Initial Alignment] Searching across ${searchText.length} characters (${actualSearchWindow} words)`);

    // Try to match each segment individually to find precise audio timestamps
    const segmentMatches = transcription.segments.map(seg => ({
      text: seg.text,
      timestamp: seg.start, // Precise audio timestamp for this segment
    }));

    // Use fuzzy matcher to find best match across all segments
    const matches = findTextMatches(searchText, segmentMatches);

    if (matches.length === 0) {
      console.warn(`[Initial Alignment] ✗ No match found with sufficient confidence (>55%)`);
      console.warn(`[Initial Alignment] This may indicate the audiobook doesn't match the EPUB text`);
      return null;
    }

    // Sort by confidence and take the best match
    const bestMatch = matches.sort((a, b) => b.confidence - a.confidence)[0];

    // Log quality metrics for initial alignment
    const avgConfidence = matches.reduce((sum, m) => sum + m.confidence, 0) / matches.length;
    console.log(`[Initial Alignment] Found ${matches.length} potential matches from ${segmentMatches.length} segments`);
    console.log(`[Initial Alignment] Match rate: ${((matches.length / segmentMatches.length) * 100).toFixed(1)}%`);
    console.log(`[Initial Alignment] Confidence range: ${(Math.min(...matches.map(m => m.confidence)) * 100).toFixed(1)}% - ${(Math.max(...matches.map(m => m.confidence)) * 100).toFixed(1)}%`);
    console.log(`[Initial Alignment] ✓ Best match at audio time ${bestMatch.audioTime.toFixed(1)}s, text position ${bestMatch.textIndex} with ${(bestMatch.confidence * 100).toFixed(1)}% confidence`);
    
    // Log snippet of matched text
    const matchedTextStart = Math.max(0, bestMatch.textIndex - 50);
    const matchedTextEnd = Math.min(epub.textContent.length, bestMatch.textIndex + 150);
    const matchedSnippet = epub.textContent.slice(matchedTextStart, matchedTextEnd);
    console.log(`[Initial Alignment] Matched text: "...${matchedSnippet}..."`);

    return {
      audioTime: bestMatch.audioTime, // Precise timestamp from Whisper segment
      textIndex: bestMatch.textIndex, // Character position (NOT word index!)
      confidence: bestMatch.confidence,
    };
  } finally {
    // Cleanup temp audio file
    await cleanupSegments([audioSegment.filePath]);
  }
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
    console.log(`[syncWordChunk] Transcription: "${transcription.text.substring(0, 100)}..."`);
    console.log(`[syncWordChunk] Received ${transcription.segments?.length || 0} segments from Whisper`);

    // Match transcription segments to text slice for fine-grained sync points
    console.log(`[syncWordChunk] Finding text matches...`);
    let transcriptionsToMatch: { text: string; timestamp: number }[] = [];

    if (transcription.segments && transcription.segments.length > 0) {
      // Use segment-level timestamps for precise matching
      transcriptionsToMatch = transcription.segments.map(seg => ({
        text: seg.text,
        timestamp: audioSegment.startTime + seg.start, // Offset by chunk start time
      }));
      console.log(`[syncWordChunk] Using ${transcriptionsToMatch.length} Whisper segments for matching`);
    } else {
      // Fallback to full transcription if no segments available
      transcriptionsToMatch = [{
        text: transcription.text,
        timestamp: audioSegment.startTime,
      }];
      console.log(`[syncWordChunk] No segments available, using full transcription`);
    }

    const matches = findTextMatches(textSlice, transcriptionsToMatch);
    console.log(`[syncWordChunk] Found ${matches.length} matches from ${transcriptionsToMatch.length} segments`);

    // Calculate sync quality metrics
    const matchRate = transcriptionsToMatch.length > 0
      ? (matches.length / transcriptionsToMatch.length) * 100
      : 0;
    const avgConfidence = matches.length > 0
      ? matches.reduce((sum, m) => sum + m.confidence, 0) / matches.length
      : 0;
    const minConfidence = matches.length > 0
      ? Math.min(...matches.map(m => m.confidence))
      : 0;
    const maxConfidence = matches.length > 0
      ? Math.max(...matches.map(m => m.confidence))
      : 0;

    console.log(`[Sync Quality] Match rate: ${matchRate.toFixed(1)}% (${matches.length}/${transcriptionsToMatch.length})`);
    console.log(`[Sync Quality] Confidence: avg=${(avgConfidence * 100).toFixed(1)}%, min=${(minConfidence * 100).toFixed(1)}%, max=${(maxConfidence * 100).toFixed(1)}%`);

    if (matchRate < 50) {
      console.warn(`[Sync Quality] ⚠️  Low match rate! Only ${matchRate.toFixed(1)}% of segments matched. Audio may not align well with text.`);
    }
    if (avgConfidence < 0.7) {
      console.warn(`[Sync Quality] ⚠️  Low average confidence (${(avgConfidence * 100).toFixed(1)}%). Sync accuracy may be poor.`);
    }

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
