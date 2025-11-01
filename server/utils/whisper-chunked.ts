import { splitAudioIntoChunks, cleanupChunks, type AudioChunk } from "./audio-chunker";
import { transcribeAudioSegment } from "./whisper-service";

export interface ChunkedTranscription {
  fullText: string;
  chunks: {
    text: string;
    startTime: number;
    duration: number;
  }[];
  totalChunks: number;
}

export interface ChunkProgressCallback {
  (current: number, total: number): void;
}

export interface ChunkInitCallback {
  (totalChunks: number): void;
}

/**
 * Transcribe audio file with automatic chunking for files >25MB
 * Calls onInit with total chunk count before processing
 * Calls onProgress callback after each chunk is processed
 * @param uniqueId - Unique identifier to isolate chunk directories across concurrent sessions
 */
export async function transcribeWithChunking(
  audioFilePath: string,
  uniqueId: string,
  onInit?: ChunkInitCallback,
  onProgress?: ChunkProgressCallback
): Promise<ChunkedTranscription> {
  // Split audio into chunks (only once!) with unique directory
  const chunks = await splitAudioIntoChunks(audioFilePath, uniqueId);
  const totalChunks = chunks.length;

  // Notify caller of total chunks before processing starts
  if (onInit) {
    try {
      await onInit(totalChunks);
    } catch (error) {
      console.error("Error in onInit callback:", error);
    }
  }

  const transcriptions: { text: string; startTime: number; duration: number }[] = [];

  try {
    // Process each chunk sequentially
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // Transcribe this chunk
      const result = await transcribeAudioSegment(chunk.path);
      
      // All chunks are now time-based (created by ffmpeg with proper timestamps)
      // Use the chunk's provided timestamps and duration
      const actualStartTime = chunk.startTime;
      const actualDuration = chunk.duration || result.duration || 0;
      
      transcriptions.push({
        text: result.text,
        startTime: actualStartTime,
        duration: actualDuration,
      });

      // Call progress callback AFTER successful transcription
      if (onProgress) {
        try {
          await onProgress(i + 1, totalChunks);
        } catch (error) {
          console.error("Error in onProgress callback:", error);
        }
      }
    }

    // Combine all transcriptions
    const fullText = transcriptions.map(t => t.text).join(" ");

    return {
      fullText,
      chunks: transcriptions,
      totalChunks,
    };
  } finally {
    // Always cleanup chunk files if they were created, even on errors
    if (chunks.length > 1) {
      await cleanupChunks(chunks);
    }
  }
}
