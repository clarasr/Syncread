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

  // Split EPUB text into sentences for better matching
  const sentences = epubText.match(/[^.!?]+[.!?]+/g) || [epubText];
  
  // Create a map of sentence to character index
  const sentenceMap: { text: string; index: number }[] = [];
  let currentIndex = 0;
  
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    const foundIndex = epubText.indexOf(trimmed, currentIndex);
    if (foundIndex !== -1) {
      sentenceMap.push({ text: trimmed, index: foundIndex });
      currentIndex = foundIndex + trimmed.length;
    }
  }

  // Set up Fuse.js for fuzzy matching
  const fuse = new Fuse(sentenceMap, {
    keys: ["text"],
    threshold: 0.4, // 0.0 = perfect match, 1.0 = match anything
    includeScore: true,
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
