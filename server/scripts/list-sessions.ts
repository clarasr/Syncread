/**
 * List all sessions in the database
 */

import { db } from "../db";

async function listSessions() {
  const allSessions = await db.query.sessions.findMany({
    with: {
      epub: true,
      audiobook: true,
    },
  });

  console.log(`\nFound ${allSessions.length} session(s):\n`);

  for (const session of allSessions) {
    console.log(`Session ID: ${session.id}`);
    console.log(`  Status: ${session.status}`);
    console.log(`  EPUB: ${session.epub?.title || 'N/A'}`);
    console.log(`  Audiobook: ${session.audiobook?.title || 'N/A'}`);
    console.log(`  Sync anchors: ${session.syncAnchors?.length || 0}`);
    console.log(`  Created: ${session.createdAt}`);
    console.log();
  }

  if (allSessions.length > 0) {
    console.log(`To test fuzzy matcher, run:`);
    console.log(`  npx tsx server/scripts/test-fuzzy-matcher.ts ${allSessions[0].id}`);
    console.log();
  }
}

listSessions()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
