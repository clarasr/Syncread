import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";

const execFileAsync = promisify(execFile);

// Average audiobook narration speed in words per minute
const NARRATION_SPEED_WPM = 150;

export interface AudioSegment {
  filePath: string;
  startTime: number;
  duration: number;
  wordRange: { start: number; end: number };
}

/**
 * Extract a specific time range from an audio file based on word count estimation
 * @param sourceAudioPath - Path to the source audiobook file
 * @param wordStart - Starting word index
 * @param wordCount - Number of words to extract
 * @param outputDir - Directory to save the extracted segment
 * @returns AudioSegment with details of the extracted audio
 */
export async function extractAudioByWordRange(
  sourceAudioPath: string,
  wordStart: number,
  wordCount: number,
  outputDir: string
): Promise<AudioSegment> {
  // Validate word range
  if (wordStart < 0 || wordCount <= 0) {
    throw new Error(`Invalid word range: start=${wordStart}, count=${wordCount}`);
  }

  // Estimate time range based on word count
  const startTimeMinutes = wordStart / NARRATION_SPEED_WPM;
  const durationMinutes = wordCount / NARRATION_SPEED_WPM;
  
  const startTimeSeconds = startTimeMinutes * 60;
  const durationSeconds = durationMinutes * 60;

  // Create output directory if it doesn't exist
  await fs.mkdir(outputDir, { recursive: true });

  // Always output as MP3 for Whisper API compatibility
  // Whisper accepts: flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm
  // MP3 is universally compatible and has good compression
  const timestamp = Date.now();
  const outputFilename = `segment_${wordStart}_${wordStart + wordCount}_${timestamp}.mp3`;
  const outputPath = path.join(outputDir, outputFilename);

  // Extract audio segment using ffmpeg
  // -ss: start time (before -i for faster seeking)
  // -t: duration
  // -vn: skip video/image streams (album art)
  // -acodec libmp3lame: re-encode to MP3 (Whisper compatible)
  // -b:a 128k: 128kbps bitrate (good quality for speech)
  const args = [
    "-ss", startTimeSeconds.toString(),
    "-i", sourceAudioPath,
    "-t", durationSeconds.toString(),
    "-vn", // Skip video/image streams (album artwork)
    "-acodec", "libmp3lame",
    "-b:a", "128k",
    "-y", // overwrite output file if exists
    outputPath
  ];

  try {
    // M4B re-encoding can be slow (e.g., 0.84x real-time)
    // Allow generous timeout: 2 minutes per minute of audio
    const timeoutMs = Math.max(60000, (durationSeconds / 60) * 2 * 60 * 1000);
    
    await execFileAsync("ffmpeg", args, { timeout: timeoutMs, maxBuffer: 50 * 1024 * 1024 });
    
    return {
      filePath: outputPath,
      startTime: startTimeSeconds,
      duration: durationSeconds,
      wordRange: { start: wordStart, end: wordStart + wordCount }
    };
  } catch (error: any) {
    throw new Error(`Failed to extract audio segment: ${error.message}`);
  }
}

/**
 * Extract multiple progressive chunks of audio based on word ranges
 * Useful for progressive sync where we sync small chunks on-demand
 */
export async function extractProgressiveChunks(
  sourceAudioPath: string,
  chunkWordSize: number,
  totalWords: number,
  outputDir: string
): Promise<AudioSegment[]> {
  const segments: AudioSegment[] = [];
  let currentWordStart = 0;

  while (currentWordStart < totalWords) {
    const wordsRemaining = totalWords - currentWordStart;
    const chunkSize = Math.min(chunkWordSize, wordsRemaining);

    const segment = await extractAudioByWordRange(
      sourceAudioPath,
      currentWordStart,
      chunkSize,
      outputDir
    );

    segments.push(segment);
    currentWordStart += chunkSize;
  }

  return segments;
}

/**
 * Cleanup extracted audio segments to save disk space
 */
export async function cleanupSegments(segmentPaths: string[]): Promise<void> {
  await Promise.all(
    segmentPaths.map(filePath => 
      fs.unlink(filePath).catch(err => 
        console.error(`Failed to delete segment ${filePath}:`, err)
      )
    )
  );
}
