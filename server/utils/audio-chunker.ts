import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { ObjectStorageService } from "../objectStorage";

const execFileAsync = promisify(execFile);

export interface AudioChunk {
  path: string; // Now stores Object Storage path instead of local path
  startTime: number;
  duration: number;
  size: number;
  isObjectStorage?: boolean; // Flag to indicate if path is Object Storage
}

const MAX_CHUNK_SIZE = 24 * 1024 * 1024; // 24MB to stay safely under 25MB Whisper limit
const CHUNK_DURATION_SECONDS = 600; // 10 minutes per chunk (adjustable based on bitrate)

/**
 * Splits a large audio file into chunks suitable for Whisper API (<25MB each)
 * Returns array of chunk file paths with metadata
 * @param audioFilePath - Path to the source audio file (local or Object Storage)
 * @param uniqueId - Unique identifier (e.g., session ID) to prevent directory conflicts
 * @param useObjectStorage - Whether to store chunks in Object Storage (default: true)
 */
export async function splitAudioIntoChunks(
  audioFilePath: string,
  uniqueId?: string,
  useObjectStorage: boolean = true
): Promise<AudioChunk[]> {
  const fileSize = fs.statSync(audioFilePath).size;
  
  // If file is under 24MB, no chunking needed
  if (fileSize <= MAX_CHUNK_SIZE) {
    return [{
      path: audioFilePath,
      startTime: 0,
      duration: 0, // Will be filled by metadata extraction
      size: fileSize,
      isObjectStorage: false,
    }];
  }

  // Create unique identifier for chunks
  const uniqueSuffix = uniqueId || `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  // Try to get duration for optimization, but don't require it
  let duration = await getAudioDuration(audioFilePath);
  
  // If we have valid duration, use it for efficient chunking
  if (duration > 0) {
    const bitrate = await getAudioBitrate(audioFilePath);
    const effectiveBitrate = bitrate > 0 ? bitrate : (fileSize / duration);
    const calculatedDuration = Math.floor(MAX_CHUNK_SIZE / effectiveBitrate);
    const targetChunkDuration = Math.max(60, Math.min(600, calculatedDuration));
    
    console.log(`Known duration chunking: ${duration}s total, ${targetChunkDuration}s per chunk`);
    
    const chunks = await extractChunksWithDuration(
      audioFilePath, 
      uniqueSuffix, 
      duration, 
      targetChunkDuration,
      useObjectStorage
    );
    return chunks;
  }
  
  // Fallback: Iterative chunking without duration knowledge
  console.warn(`Duration unknown - using iterative chunking`);
  const chunks = await extractChunksIteratively(audioFilePath, uniqueSuffix, useObjectStorage);
  return chunks;
}

/**
 * Get audio file duration and bitrate using ffprobe (safe from command injection)
 */
async function getAudioDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      filePath
    ]);
    const duration = parseFloat(stdout.trim());
    if (duration > 0) return duration;
  } catch (error) {
    // ffprobe not available or failed, try music-metadata
  }

  // Fallback: use music-metadata
  try {
    const { parseFile } = await import("music-metadata");
    const metadata = await parseFile(filePath);
    const duration = metadata.format.duration || 0;
    if (duration > 0) return duration;
  } catch (error) {
    console.warn("Failed to get audio duration:", error);
  }

  // Return 0 to indicate failure - caller must handle this
  console.warn(`Could not determine duration for ${filePath}`);
  return 0;
}

/**
 * Get actual bitrate from audio file
 */
async function getAudioBitrate(filePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=bit_rate",
      "-of", "default=noprint_wrappers=1:nokey=1",
      filePath
    ]);
    const bitrate = parseInt(stdout.trim(), 10);
    if (bitrate > 0) return bitrate / 8; // Convert bits/sec to bytes/sec
  } catch (error) {
    // ffprobe failed
  }

  // Fallback: use music-metadata
  try {
    const { parseFile } = await import("music-metadata");
    const metadata = await parseFile(filePath);
    const bitrate = metadata.format.bitrate || 0;
    if (bitrate > 0) return bitrate / 8; // Convert bits/sec to bytes/sec
  } catch (error) {
    console.warn("Failed to get audio bitrate:", error);
  }

  // Return 0 to indicate unknown
  return 0;
}

/**
 * Extract chunks when duration is known (efficient approach)
 */
async function extractChunksWithDuration(
  audioFilePath: string,
  uniqueId: string,
  totalDuration: number,
  chunkDuration: number,
  useObjectStorage: boolean
): Promise<AudioChunk[]> {
  const originalExt = path.extname(audioFilePath) || ".mp3";
  const isM4B = originalExt.toLowerCase() === '.m4b';
  const chunks: AudioChunk[] = [];
  let currentTime = 0;
  let chunkIndex = 0;

  // Create temp directory for local chunks
  const tempDir = path.join("/tmp", `audio_chunks_${uniqueId}`);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  while (currentTime < totalDuration) {
    const remainingTime = totalDuration - currentTime;
    
    // For M4B files: make first chunk small (2 min) for quick start, then use standard duration
    // This allows users to start reading in ~2-4 minutes while the rest processes
    let targetDuration = chunkDuration;
    if (isM4B && chunkIndex === 0) {
      targetDuration = Math.min(120, chunkDuration); // First chunk: 2 minutes
      console.log(`M4B first chunk: using ${targetDuration}s for quick start`);
    }
    
    const actualDuration = Math.min(targetDuration, remainingTime);
    const localChunkPath = path.join(tempDir, `chunk_${chunkIndex}${originalExt}`);

    const actualOutputPath = await extractAudioSegment(audioFilePath, localChunkPath, currentTime, actualDuration);

    const chunkSize = fs.statSync(actualOutputPath).size;
    
    // Validate chunk size
    if (chunkSize > MAX_CHUNK_SIZE) {
      throw new Error(`Chunk ${chunkIndex} size (${chunkSize}) exceeds limit (${MAX_CHUNK_SIZE})`);
    }
    
    let finalPath = actualOutputPath;
    let isObjectStorage = false;

    // Upload to Object Storage if enabled
    if (useObjectStorage) {
      try {
        const objectStorageService = new ObjectStorageService();
        const privateDir = objectStorageService.getPrivateObjectDir();
        // Use the actual output extension (may be .mp3 for M4B files)
        const actualExt = path.extname(actualOutputPath);
        const objectPath = `${privateDir}/temp_chunks/${uniqueId}/chunk_${chunkIndex}${actualExt}`;
        
        // Upload to Object Storage
        const file = await objectStorageService.getObjectEntityFile(objectPath);
        await file.save(fs.readFileSync(actualOutputPath));
        
        finalPath = objectPath;
        isObjectStorage = true;
        
        // Delete local file after upload
        fs.unlinkSync(actualOutputPath);
      } catch (error) {
        console.warn(`Failed to upload chunk to Object Storage, using local: ${error}`);
        // Keep local path if upload fails
      }
    }
    
    chunks.push({
      path: finalPath,
      startTime: currentTime,
      duration: actualDuration,
      size: chunkSize,
      isObjectStorage,
    });

    currentTime += actualDuration;
    chunkIndex++;
  }

  // Clean up temp directory if all chunks were uploaded
  if (useObjectStorage && chunks.every(c => c.isObjectStorage)) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to remove temp directory: ${error}`);
    }
  }

  return chunks;
}

/**
 * Extract chunks iteratively without duration knowledge
 * Stops when ffmpeg returns empty or very small output
 */
async function extractChunksIteratively(
  audioFilePath: string,
  uniqueId: string,
  useObjectStorage: boolean
): Promise<AudioChunk[]> {
  const originalExt = path.extname(audioFilePath) || ".mp3";
  const chunks: AudioChunk[] = [];
  let currentTime = 0;
  let chunkIndex = 0;
  const CHUNK_DURATION = 300; // 5 minutes - conservative to ensure <24MB
  const MIN_CHUNK_SIZE = 1024; // 1KB - smaller means we've reached the end

  // Create temp directory for local chunks
  const tempDir = path.join("/tmp", `audio_chunks_${uniqueId}`);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  while (true) {
    const localChunkPath = path.join(tempDir, `chunk_${chunkIndex}${originalExt}`);

    const actualOutputPath = await extractAudioSegment(audioFilePath, localChunkPath, currentTime, CHUNK_DURATION);

    const chunkSize = fs.statSync(actualOutputPath).size;
    
    // Stop if chunk is empty or very small (reached end of audio)
    if (chunkSize < MIN_CHUNK_SIZE) {
      fs.unlinkSync(actualOutputPath); // Remove empty chunk
      break;
    }
    
    // Validate chunk size
    if (chunkSize > MAX_CHUNK_SIZE) {
      throw new Error(`Chunk ${chunkIndex} size (${chunkSize}) exceeds limit (${MAX_CHUNK_SIZE})`);
    }
    
    let finalPath = actualOutputPath;
    let isObjectStorage = false;

    // Upload to Object Storage if enabled
    if (useObjectStorage) {
      try {
        const objectStorageService = new ObjectStorageService();
        const privateDir = objectStorageService.getPrivateObjectDir();
        // Use the actual output extension (may be .mp3 for M4B files)
        const actualExt = path.extname(actualOutputPath);
        const objectPath = `${privateDir}/temp_chunks/${uniqueId}/chunk_${chunkIndex}${actualExt}`;
        
        // Upload to Object Storage
        const file = await objectStorageService.getObjectEntityFile(objectPath);
        await file.save(fs.readFileSync(actualOutputPath));
        
        finalPath = objectPath;
        isObjectStorage = true;
        
        // Delete local file after upload
        fs.unlinkSync(actualOutputPath);
      } catch (error) {
        console.warn(`Failed to upload chunk to Object Storage, using local: ${error}`);
        // Keep local path if upload fails
      }
    }
    
    chunks.push({
      path: finalPath,
      startTime: currentTime,
      duration: CHUNK_DURATION, // Approximate - Whisper will determine actual
      size: chunkSize,
      isObjectStorage,
    });

    currentTime += CHUNK_DURATION;
    chunkIndex++;
    
    // Safety limit: max 500 chunks (250 minutes at 5min/chunk = ~41 hours)
    if (chunkIndex >= 500) {
      console.warn(`Reached maximum chunk limit (500) for safety`);
      break;
    }
  }

  // Clean up temp directory if all chunks were uploaded
  if (useObjectStorage && chunks.every(c => c.isObjectStorage)) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to remove temp directory: ${error}`);
    }
  }

  console.log(`Iterative chunking complete: ${chunks.length} chunks extracted`);
  return chunks;
}

/**
 * Extract a segment of audio using ffmpeg (safe from command injection)
 * Important: -ss before -i is faster and more accurate for seeking
 * M4B files require re-encoding instead of codec copy
 * @returns The actual output path (may differ from requested path if re-encoding changes extension)
 */
async function extractAudioSegment(
  inputPath: string,
  outputPath: string,
  startTime: number,
  duration: number
): Promise<string> {
  const inputExt = path.extname(inputPath).toLowerCase();
  const isM4B = inputExt === '.m4b';
  
  // M4B files often have codecs/metadata that can't be copied directly
  // Re-encode to MP3 for Whisper API compatibility
  const audioCodecArgs = isM4B 
    ? ["-acodec", "libmp3lame", "-b:a", "128k"] 
    : ["-acodec", "copy"];
  
  // For M4B files, change output extension to .mp3
  const finalOutputPath = isM4B 
    ? outputPath.replace(/\.[^.]+$/, '.mp3')
    : outputPath;
  
  // Re-encoding M4B files is CPU-intensive and takes longer than codec copy
  // Allow roughly 1 minute of processing per 1 minute of audio (generous buffer)
  const timeout = isM4B ? (duration * 1000) + 120000 : 120000; // For M4B: duration + 2min buffer, others: 2 min
  
  // Use execFile with argument array to prevent command injection
  // Note: -ss before -i does input seeking (faster), -ss after -i does output seeking (slower but more accurate)
  // For chunking, we want fast input seeking
  await execFileAsync("ffmpeg", [
    "-ss", startTime.toString(),
    "-i", inputPath,
    "-t", duration.toString(),
    ...audioCodecArgs,
    "-y",
    finalOutputPath
  ], {
    timeout,
    maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large stderr output
  });
  
  return finalOutputPath;
}

/**
 * Clean up chunk files after processing
 * Now handles both local filesystem and Object Storage chunks
 */
export async function cleanupChunks(chunks: AudioChunk[]): Promise<void> {
  if (!chunks || chunks.length === 0) return;

  // Skip cleanup if there's only one chunk (no splitting occurred)
  if (chunks.length === 1) return;

  const objectStorageService = new ObjectStorageService();
  
  for (const chunk of chunks) {
    if (!chunk.path) continue;
    
    try {
      if (chunk.isObjectStorage) {
        // Delete from Object Storage
        const file = await objectStorageService.getObjectEntityFile(chunk.path);
        await file.delete();
        console.log(`Deleted Object Storage chunk: ${chunk.path}`);
      } else if (fs.existsSync(chunk.path)) {
        // Delete local file
        fs.unlinkSync(chunk.path);
        console.log(`Deleted local chunk: ${chunk.path}`);
      }
    } catch (error) {
      console.warn(`Failed to delete chunk: ${chunk.path}`, error);
    }
  }
  
  // Try to remove the temp chunks directory from Object Storage
  if (chunks.length > 0 && chunks[0].isObjectStorage) {
    try {
      const firstChunkPath = chunks[0].path;
      // Extract the temp_chunks directory path
      const match = firstChunkPath.match(/(.*\/temp_chunks\/[^\/]+)/);
      if (match) {
        const tempDir = match[1];
        const dirFile = await objectStorageService.getObjectEntityFile(tempDir);
        await dirFile.delete();
        console.log(`Deleted Object Storage temp directory: ${tempDir}`);
      }
    } catch (error) {
      console.warn(`Failed to remove Object Storage temp directory:`, error);
    }
  }
  
  // Remove local temp directory if exists
  const localTempDir = chunks.find(c => !c.isObjectStorage)?.path;
  if (localTempDir) {
    const tempDir = path.dirname(localTempDir);
    if (tempDir && fs.existsSync(tempDir) && tempDir.includes("audio_chunks_")) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log(`Deleted local temp directory: ${tempDir}`);
      } catch (error) {
        console.warn(`Failed to remove local temp directory: ${tempDir}`, error);
      }
    }
  }
}
