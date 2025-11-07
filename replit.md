# SyncRead - EPUB & Audiobook Sync Application

## Overview

SyncRead is a mobile-first web application designed to provide an immersive reading experience by synchronizing EPUB text with audiobook narration. It achieves this by automatically aligning text and audio using AI-powered Whisper transcription and fuzzy text matching. The application allows users to upload and manage EPUB files and audiobooks in an Apple Books-style library, create synchronized reading sessions, and customize their reading experience with themes and typography controls. The core ambition is to offer a seamless and engaging way to consume books through synchronized audio and text.

## Recent Changes

**Nov 7, 2025 - Critical Bug Fixes:**
- **Fixed progress polling spam:** Stabilized debounce hook with useCallback and onFlushRef
  - Progress update functions were being recreated every render, causing infinite loop
  - Used useCallback for stable function references and ref for onFlush to break render cycle
  - Progress now updates every 5 seconds as intended (was spamming every 130ms)
- **Fixed audio playback initialization:** Handle user clicking play before audio loads
  - Added init-time play check when user presses play before audio element is ready
  - Gracefully handles browser autoplay policy with NotAllowedError detection
  - Ensures playback starts regardless of load timing without console spam
- **Fixed EPUB reparse endpoint:** Downloads EPUB from object storage to temp file before parsing
  - Mirrors the upload flow pattern with proper cleanup in finally block
  - Restores reparse functionality for EPUBs stored in object storage
- **Fixed progressive sync chunk matching:** Added 100-word overlap context to text windows
  - Provides fuzzy matcher with enough context to find matches at chunk boundaries
  - Resolves chunk 2 matching failures when boundary splits mid-sentence

**Nov 7, 2025 - Real-Time Paragraph Highlighting & Progress Polling Fixes:**
- **Fixed paragraph highlighting timing:** Switched from using last passed anchor to linear interpolation
  - Highlighting now moves to next paragraph BEFORE voice finishes reading it (predictive vs reactive)
  - Uses interpolation formula: `textIndex = beforeAnchor.textIndex + (textDiff × timeProgress / timeDiff)`
  - Provides smooth, real-time highlighting synchronized with audio playback position
- **Fixed progress polling after audio ends:** Added immediate flush when audio finishes
  - `handleEnded` callback now calls `flushProgressUpdate()` to save final position
  - Progress polling stops when `isPlaying` becomes false (no more continuous requests)
  - Prevents unnecessary API calls after playback completes
- **EPUB parser paragraph fix:** Updated `epub-parser.ts` to preserve paragraph boundaries
  - Extracts text from `<p>` tags individually, joins with double newlines (`\n\n`)
  - Fallback replaces block-level HTML elements with paragraph breaks
  - Prevents all text from collapsing into a single paragraph
- **Re-parse feature:** New `/api/epub/:id/reparse` endpoint to refresh existing EPUBs
  - Library UI has "Refresh Paragraphs" option in EPUB dropdown menu
  - Updates old EPUBs without re-uploading

**Nov 6, 2025 - ElevenReader-Style UX Improvements:**
- **Fixed theme colors:** Light mode now has white background (98% lightness), dark mode stays dark (4% lightness)
- **Paragraph-level highlighting:** Switched from sentence-level to paragraph-level highlighting for smoother, less granular sync (inspired by ElevenReader)
  - ReadingPane splits content on newlines (`\n\n+|\n`) instead of sentence boundaries
  - Paragraphs are highlighted with yellow background and padding for visual emphasis
  - Removed redundant `/api/sync/:id/position` API polling; client-side calculation now handles all highlighting
- **Integrated audio player:** Replaced expandable MinimizedAudioPlayer with ElevenReader-style always-visible bottom bar
  - Clean, compact design with progress slider, time stamps, play/pause, skip ±15s, and speed selector
  - No minimize/maximize - controls are always accessible without modal overlays
- **Removed debug code:** Cleaned up test anchor endpoint and console logging

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application uses a React-TypeScript frontend with Vite, TanStack Query, Wouter, and Tailwind CSS (shadcn/ui), inspired by Apple Books for a mobile-first, content-centric design. It features a theme system with 6 presets, light/dark modes, and extensive typography customization. Preferences are persisted in `localStorage`.

The backend is built with Express.js and Node.js, utilizing Drizzle ORM with a PostgreSQL database (Neon). Authentication is handled via Replit Auth (OpenID Connect). File storage leverages Replit Object Storage with presigned URLs for secure access. 

**Sync Mode (Updated Nov 4, 2025):**
- **Default: PROGRESSIVE SYNC** - Only processes audio chunks as user reads (cost-effective for long audiobooks)
- First chunk: 75 words (~30 seconds of audio at 150 WPM) for quick verification
- Subsequent chunks: 1000 words (~6.5 minutes) processed on-demand as user progresses
- M4B files: Automatically re-encoded to MP3 during chunk extraction
- Full sync mode available via API parameter but not recommended for 24+ hour audiobooks

**Core Data Processing Pipeline:**

1.  **EPUB Parsing:** Extracts metadata, clean text, and chapter boundaries.
2.  **Audio Chunking:** Splits large audio files into smaller segments (e.g., <25MB for Whisper API), using adaptive strategies for different audio formats like M4B.
3.  **Whisper Transcription:** Transcribes audio chunks to text with timing data using the OpenAI Whisper API.
4.  **Fuzzy Text Matching:** Aligns transcriptions with EPUB text using Fuse.js.
5.  **Sync Point Calculation:** Generates smooth audio-text synchronization points through linear interpolation.

Sync sessions track progress through various states (pending, processing, paused, complete, error) with retry functionality and robust user ownership verification. The database schema includes `users`, `sessions`, `epub_books`, `audiobooks`, and `sync_sessions` tables, using UUIDs and JSONB fields for flexible data storage.

## External Dependencies

**Third-Party Services:**

-   **OpenAI Whisper API:** For cloud-based speech-to-text transcription.
-   **Replit Object Storage:** For persistent file storage.
-   **Neon PostgreSQL:** For database persistence.

**Third-Party Libraries:**

-   **Radix UI Primitives & shadcn/ui:** For accessible UI components.
-   **Fuse.js:** For fuzzy string matching.
-   **Cheerio:** For server-side HTML/XML parsing.
-   **AdmZip:** For EPUB file extraction.
-   **music-metadata:** For audio file metadata extraction.
-   **Drizzle ORM & Drizzle Kit:** For database interaction and migrations.
-   **Zod:** For runtime type validation.