import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { ObjectStorageService } from "../objectStorage";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
// Using OpenAI's Whisper API for audio transcription
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface TranscriptionResult {
  text: string;
  duration?: number;
  segments?: Array<{ start: number; end: number; text: string }>;
}

/**
 * Helper to get a readable stream from either local file or Object Storage
 */
async function getAudioStream(audioFilePath: string): Promise<fs.ReadStream> {
  // Check if it's an Object Storage path
  if (audioFilePath.startsWith("/replit-objstore-")) {
    const objectStorageService = new ObjectStorageService();
    const file = await objectStorageService.getObjectEntityFile(audioFilePath);
    
    // Download to temp file
    const tempPath = path.join("/tmp", `temp_audio_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`);
    await file.download({ destination: tempPath });
    
    return fs.createReadStream(tempPath);
  }
  
  // Local file
  return fs.createReadStream(audioFilePath);
}

export async function transcribeAudioSegment(
  audioFilePath: string
): Promise<TranscriptionResult> {
  const audioReadStream = await getAudioStream(audioFilePath);

  const transcription = await openai.audio.transcriptions.create({
    file: audioReadStream,
    model: "whisper-1",
    response_format: "verbose_json",
  });

  // Extract duration from segments if available (most accurate)
  let duration = transcription.duration || 0;
  if (!duration && transcription.segments && transcription.segments.length > 0) {
    const lastSegment = transcription.segments[transcription.segments.length - 1];
    duration = lastSegment.end || 0;
  }

  return {
    text: transcription.text,
    duration,
    segments: transcription.segments as any,
  };
}

export async function transcribeAudioFile(
  audioFilePath: string
): Promise<string> {
  const audioReadStream = await getAudioStream(audioFilePath);

  const transcription = await openai.audio.transcriptions.create({
    file: audioReadStream,
    model: "whisper-1",
  });

  return transcription.text;
}
