import Fuse from "fuse.js";

export interface SyncAnchor {
  audioTime: number;
  textIndex: number;
  confidence: number;
}

export function findTextMatches(
  epubText: string,
  transcriptions: { text: string; timestamp: number }[]
): SyncAnchor[] {
  const syncAnchors: SyncAnchor[] = [];

  // Create overlapping text chunks for better matching of multi-sentence transcriptions
  // Use a sliding window approach with ~50-word chunks and 25-word overlap
  const words = epubText.split(/\s+/);
  const CHUNK_SIZE = 50;
  const OVERLAP = 25;
  const chunks: { text: string; index: number }[] = [];
  
  for (let i = 0; i < words.length; i += (CHUNK_SIZE - OVERLAP)) {
    const chunkWords = words.slice(i, i + CHUNK_SIZE);
    const chunkText = chunkWords.join(' ');
    
    // Find the character index of this chunk in the original text
    const searchStart = i === 0 ? 0 : chunks[chunks.length - 1]?.index || 0;
    const firstWord = chunkWords[0];
    const foundIndex = epubText.indexOf(firstWord, searchStart);
    
    if (foundIndex !== -1) {
      chunks.push({ text: chunkText, index: foundIndex });
    }
  }

  // Set up Fuse.js for fuzzy matching
  const fuse = new Fuse(chunks, {
    keys: ["text"],
    threshold: 0.4, // 0.0 = perfect match, 1.0 = match anything
    includeScore: true,
    ignoreLocation: true, // Don't penalize matches based on position in the chunk
    minMatchCharLength: 10, // Require at least 10 characters to match
  });

  // Match each transcription to EPUB text
  for (const transcription of transcriptions) {
    const cleanTranscript = transcription.text.trim();
    if (cleanTranscript.length < 10) continue; // Skip very short transcriptions

    const results = fuse.search(cleanTranscript);
    
    if (results.length > 0) {
      const bestMatch = results[0];
      const score = bestMatch.score ?? 1;
      const confidence = 1 - score; // Convert Fuse score to confidence

      if (confidence > 0.5) { // Only use matches with >50% confidence
        syncAnchors.push({
          audioTime: transcription.timestamp,
          textIndex: bestMatch.item.index,
          confidence,
        });
      }
    }
  }

  // Sort by audio time
  syncAnchors.sort((a, b) => a.audioTime - b.audioTime);

  return syncAnchors;
}
