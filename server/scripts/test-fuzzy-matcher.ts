/**
 * Diagnostic script to test fuzzy matcher with real data
 * Usage: npx tsx server/scripts/test-fuzzy-matcher.ts <sessionId>
 */

import { db } from "../db";
import { sessions, epubs, audiobooks } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { findTextMatches } from "../utils/fuzzy-matcher";

async function testMatcher() {
  const sessionId = parseInt(process.argv[2]);

  if (!sessionId) {
    console.error("Usage: npx tsx server/scripts/test-fuzzy-matcher.ts <sessionId>");
    process.exit(1);
  }

  console.log(`\n=== Testing Fuzzy Matcher for Session ${sessionId} ===\n`);

  // Get session
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
  });

  if (!session) {
    console.error(`Session ${sessionId} not found`);
    process.exit(1);
  }

  console.log(`Session: ${session.id}`);
  console.log(`Status: ${session.status}`);
  console.log(`Current sync anchors: ${session.syncAnchors?.length || 0}`);

  // Get EPUB
  const epub = await db.query.epubs.findFirst({
    where: eq(epubs.id, session.epubId),
  });

  if (!epub) {
    console.error(`EPUB ${session.epubId} not found`);
    process.exit(1);
  }

  console.log(`\nEPUB: ${epub.title}`);
  console.log(`Text length: ${epub.textContent?.length || 0} characters`);
  console.log(`First 100 chars: "${epub.textContent?.substring(0, 100)}..."`);

  // Get audiobook
  const audiobook = await db.query.audiobooks.findFirst({
    where: eq(audiobooks.id, session.audiobookId),
  });

  if (!audiobook) {
    console.error(`Audiobook ${session.audiobookId} not found`);
    process.exit(1);
  }

  console.log(`\nAudiobook: ${audiobook.title}`);
  console.log(`Duration: ${audiobook.duration}s`);

  // Check if we have transcriptions in the session
  if (!session.lastTranscriptions || session.lastTranscriptions.length === 0) {
    console.error("\n❌ No transcriptions found in session.lastTranscriptions");
    console.log("This means Whisper hasn't been called yet or the data wasn't saved.");
    process.exit(1);
  }

  console.log(`\nTranscriptions: ${session.lastTranscriptions.length} segments`);
  console.log("Sample transcriptions:");
  session.lastTranscriptions.slice(0, 3).forEach((t: any, i: number) => {
    console.log(`  [${i}] @ ${t.timestamp}s: "${t.text.substring(0, 60)}..."`);
  });

  // Test the fuzzy matcher
  console.log("\n=== Running Fuzzy Matcher ===\n");

  try {
    const syncAnchors = findTextMatches(
      epub.textContent || "",
      session.lastTranscriptions
    );

    console.log(`\n=== Results ===`);
    console.log(`Total sync anchors created: ${syncAnchors.length}`);
    console.log(`Match rate: ${(syncAnchors.length / session.lastTranscriptions.length * 100).toFixed(1)}%`);

    if (syncAnchors.length > 0) {
      const avgConfidence = syncAnchors.reduce((sum, a) => sum + a.confidence, 0) / syncAnchors.length;
      console.log(`Average confidence: ${(avgConfidence * 100).toFixed(1)}%`);

      console.log(`\nFirst 5 sync anchors:`);
      syncAnchors.slice(0, 5).forEach((anchor, i) => {
        const textSnippet = epub.textContent?.substring(anchor.textIndex, anchor.textIndex + 50) || "";
        console.log(`  [${i}] ${anchor.audioTime.toFixed(1)}s → index ${anchor.textIndex} (${(anchor.confidence * 100).toFixed(1)}%)`);
        console.log(`      "${textSnippet}..."`);
      });

      if (syncAnchors.length > 5) {
        console.log(`\nLast 3 sync anchors:`);
        syncAnchors.slice(-3).forEach((anchor, i) => {
          const textSnippet = epub.textContent?.substring(anchor.textIndex, anchor.textIndex + 50) || "";
          console.log(`  [${syncAnchors.length - 3 + i}] ${anchor.audioTime.toFixed(1)}s → index ${anchor.textIndex} (${(anchor.confidence * 100).toFixed(1)}%)`);
          console.log(`      "${textSnippet}..."`);
        });
      }

      // Check distribution throughout text
      const textLength = epub.textContent?.length || 0;
      const maxIndex = Math.max(...syncAnchors.map(a => a.textIndex));
      const coverage = (maxIndex / textLength) * 100;
      console.log(`\nText coverage: ${coverage.toFixed(1)}% (anchors span up to index ${maxIndex} of ${textLength})`);

    } else {
      console.log("\n❌ NO SYNC ANCHORS CREATED!");
      console.log("This means NO transcriptions matched the EPUB text.");
      console.log("\nPossible reasons:");
      console.log("1. EPUB text and audio are from different editions");
      console.log("2. Narrator is paraphrasing or skipping sections");
      console.log("3. EPUB parsing extracted wrong content");
      console.log("4. Audio transcription is inaccurate");
    }

  } catch (error) {
    console.error("\n❌ Error running fuzzy matcher:", error);
    throw error;
  }
}

testMatcher()
  .then(() => {
    console.log("\n=== Test Complete ===\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Test failed:", error);
    process.exit(1);
  });
