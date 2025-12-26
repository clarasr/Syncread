import Fuse from "fuse.js";

export interface SyncAnchor {
  audioTime: number;
  textIndex: number;
  confidence: number;
}

// Minimum confidence threshold for accepting matches
const MIN_CONFIDENCE = 0.40; // Lowered to accept more matches (was 0.55)

/**
 * Normalize text for matching by removing punctuation and standardizing whitespace
 * This makes matching more robust to differences between EPUB and audio transcription
 */
function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    // Remove most punctuation but keep apostrophes in contractions (don't, it's)
    .replace(/["""'']/g, "'") // Normalize quotes to standard apostrophe
    .replace(/[—–-]/g, " ") // Replace dashes with spaces
    .replace(/[^\w\s']/g, " ") // Remove punctuation except apostrophes
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

// Split text into sentences for finer-grained matching
function splitIntoSentences(text: string): { text: string; index: number }[] {
  const sentences: { text: string; index: number }[] = [];

  // Match sentences ending with . ! ? followed by space or end of string
  // Also handles common abbreviations (Mr. Mrs. Dr. etc.)
  const sentenceRegex = /[^.!?]+(?:[.!?]+(?:\s+|$)|$)/g;
  let match;

  while ((match = sentenceRegex.exec(text)) !== null) {
    const sentence = match[0].trim();
    if (sentence.length > 15) { // Only include substantial sentences
      const normalized = normalizeForMatching(sentence);
      // Ensure normalized text is still substantial (not just punctuation)
      if (normalized.length > 10) {
        sentences.push({
          text: normalized,
          index: match.index,
        });
      }
    }
  }

  return sentences;
}

export function findTextMatches(
  epubText: string,
  transcriptions: { text: string; timestamp: number }[]
): SyncAnchor[] {
  const syncAnchors: SyncAnchor[] = [];

  // Create sentence-level chunks for precise matching
  const sentences = splitIntoSentences(epubText);

  console.log(`[Fuzzy Matcher] Created ${sentences.length} sentence chunks from ${epubText.length} characters`);

  // Also create overlapping word chunks as fallback for multi-sentence transcriptions
  const words = epubText.split(/\s+/);
  const CHUNK_SIZE = 15; // Reduced from 50 to better match Whisper segment length
  const OVERLAP = 5;     // Reduced from 25 to create more granular coverage
  const wordChunks: { text: string; index: number }[] = [];

  for (let i = 0; i < words.length; i += (CHUNK_SIZE - OVERLAP)) {
    const chunkWords = words.slice(i, i + CHUNK_SIZE);
    const chunkText = chunkWords.join(' ');

    // Find the character index of this chunk in the original text
    const searchStart = i === 0 ? 0 : wordChunks[wordChunks.length - 1]?.index || 0;
    const firstWord = chunkWords[0];
    const foundIndex = epubText.indexOf(firstWord, searchStart);

    if (foundIndex !== -1) {
      const normalized = normalizeForMatching(chunkText);
      // Ensure normalized chunk is substantial (adjusted for smaller chunk size)
      if (normalized.length > 10) {
        wordChunks.push({
          text: normalized,
          index: foundIndex
        });
      }
    }
  }

  // Combine sentences and word chunks for comprehensive matching
  const allChunks = [...sentences, ...wordChunks];

  console.log(`[Fuzzy Matcher] Total search space: ${allChunks.length} chunks (${sentences.length} sentences + ${wordChunks.length} word chunks)`);
  console.log(`[Fuzzy Matcher] Sample chunks:`);
  if (allChunks.length > 0) {
    console.log(`  First: "${allChunks[0].text.substring(0, 50)}..." @ index ${allChunks[0].index}`);
  }
  if (allChunks.length > 1) {
    const mid = Math.floor(allChunks.length / 2);
    console.log(`  Middle: "${allChunks[mid].text.substring(0, 50)}..." @ index ${allChunks[mid].index}`);
  }
  if (allChunks.length > 2) {
    console.log(`  Last: "${allChunks[allChunks.length - 1].text.substring(0, 50)}..." @ index ${allChunks[allChunks.length - 1].index}`);
  }

  // Set up Fuse.js for fuzzy matching
  const fuse = new Fuse(allChunks, {
    keys: ["text"],
    threshold: 0.45, // Balance between strict and permissive (was 0.35)
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 10, // Reduced to match shorter segments
    distance: 300, // Increased search distance for better matching
  });

  // Match each transcription segment to EPUB text
  for (const transcription of transcriptions) {
    const cleanTranscript = transcription.text.trim();
    if (cleanTranscript.length < 12) {
      console.log(`[Fuzzy Matcher] Skipping short transcription: "${cleanTranscript}"`);
      continue;
    }

    // Normalize transcription for matching (remove punctuation, lowercase)
    const normalizedTranscript = normalizeForMatching(cleanTranscript);
    console.log(`\n[Fuzzy Matcher] Matching @ ${transcription.timestamp.toFixed(1)}s`);
    console.log(`  Original:   "${cleanTranscript.substring(0, 60)}..."`);
    console.log(`  Normalized: "${normalizedTranscript.substring(0, 60)}..."`);

    // Try exact match first (much faster and more accurate)
    let exactMatch = null;
    for (const chunk of allChunks) {
      if (chunk.text === normalizedTranscript) {
        exactMatch = chunk;
        break;
      }
    }

    if (exactMatch) {
      console.log(`  Exact match: "${exactMatch.text.substring(0, 60)}..." @ index ${exactMatch.index}`);
      console.log(`  ✓ ACCEPTED (exact match - 100% confidence)`);
      syncAnchors.push({
        audioTime: transcription.timestamp,
        textIndex: exactMatch.index,
        confidence: 1.0,
      });
      continue;
    }

    // Fall back to fuzzy matching
    const results = fuse.search(normalizedTranscript);

    if (results.length > 0) {
      const bestMatch = results[0];
      const score = bestMatch.score ?? 1;
      const confidence = 1 - score; // Convert Fuse score to confidence

      console.log(`  Best match: "${bestMatch.item.text.substring(0, 60)}..." (score: ${score.toFixed(3)}, confidence: ${(confidence * 100).toFixed(1)}%)`);
      console.log(`  Text index: ${bestMatch.item.index}`);

      if (confidence >= MIN_CONFIDENCE) {
        syncAnchors.push({
          audioTime: transcription.timestamp,
          textIndex: bestMatch.item.index,
          confidence,
        });
        console.log(`  ✓ ACCEPTED (above ${MIN_CONFIDENCE * 100}% threshold)`);
      } else {
        console.log(`  ✗ REJECTED (below ${MIN_CONFIDENCE * 100}% threshold)`);
      }
    } else {
      console.log(`  ✗ NO MATCHES FOUND in search space`);
    }
  }

  // Sort by audio time
  syncAnchors.sort((a, b) => a.audioTime - b.audioTime);

  console.log(`[Fuzzy Matcher] Final result: ${syncAnchors.length} sync anchors from ${transcriptions.length} transcription segments`);

  return syncAnchors;
}
