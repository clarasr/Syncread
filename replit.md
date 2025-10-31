# SyncRead - EPUB & Audiobook Sync Application

## Overview

SyncRead is a mobile-first web application designed to create an immersive reading experience by synchronizing EPUB text with audiobook narration. It automatically aligns text and audio using AI-powered Whisper transcription and fuzzy text matching. Users can upload EPUB files and audiobooks, manage them in an Apple Books-style library, and create synchronized reading sessions. The application supports customizable reading experiences with themes, typography controls, and playback options. The core ambition is to provide a seamless and engaging way to consume books through synchronized audio and text.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend uses React with TypeScript, Vite, TanStack Query for server state management, Wouter for routing, and Tailwind CSS with shadcn/ui for components. The design is inspired by Apple Books, focusing on a content-first, mobile-first approach. It features a theme system with 6 presets (Original, Quiet, Paper, Bold, Calm, Focus) supporting light/dark modes, and extensive typography customization. Key UI components include a Library grid, a two-step UploadModal, a ReadingPane with synchronized highlighting, a MinimizedAudioPlayer, and customizers for themes and typography. State is managed with React Query for async data and local component state, with preferences persisted in `localStorage`.

### Backend Architecture

The backend is built with Express.js and Node.js, using Drizzle ORM for PostgreSQL (Neon Database). Authentication is handled via Replit Auth (OpenID Connect) with session-based management. File storage has been migrated to Replit Object Storage, utilizing presigned URLs for uploads and authenticated serving of private files. The system supports progressive syncing, allowing reading to start quickly by processing 1000-word chunks on-demand with intelligent word indexing and auto-advance mechanisms.

**Core Data Processing Pipeline:**

1.  **EPUB Parsing:** Extracts metadata and clean text, identifies chapter boundaries.
2.  **Audio Chunking:** Automatically splits large audio files into <25MB chunks for Whisper API compatibility, using a dual-strategy approach (metadata-based or iterative fallback). Temporary chunks are now stored in Object Storage for better scalability.
3.  **Whisper Transcription:** Uses OpenAI Whisper API to convert audio chunks to text with timing data. Automatically downloads audio from Object Storage when needed.
4.  **Fuzzy Text Matching:** Employs Fuse.js for fuzzy string matching between transcriptions and EPUB text, generating sync anchors.
5.  **Sync Point Calculation:** Sorts and filters anchors, creating linear interpolations for smooth audio-text synchronization.

Sync sessions track progress through `pending`, `processing`, `paused`, `complete`, or `error` states, with retry functionality and robust user ownership verification for all data access.

## Recent Updates (October 19, 2025)

### Code Quality Improvements (COMPLETED - October 19, 2025)

**Renderer Consolidation:**
- Created shared utility `client/src/lib/epub-renderer-utils.ts` to eliminate 90% code duplication
- Extracted `FONT_FAMILIES` constant and `generateEpubDocument()` function
- Both HtmlRenderer and PaginatedHtmlRenderer now use the shared utility
- Single source of truth for iframe HTML generation
- **Impact:** Easier maintenance, consistent behavior, smaller codebase

**Performance Optimization:**
- Added `useMemo` to both renderers to prevent unnecessary iframe rebuilds
- Memoizes generated HTML based on content, typography, and theme dependencies
- Only regenerates when actual content or settings change
- **Impact:** Eliminates flicker when switching themes, smoother user experience

**Temp File Cleanup Safety:**
- Refactored progressive sync to use `finally` block for cleanup
- Guarantees temp audio files are deleted even on errors or early returns
- Prevents disk space leaks if sync is paused mid-process
- **Impact:** More robust file management, no orphaned temp files

### Critical Bug Fixes (COMPLETED - October 19, 2025)

**Upload Crash Fix:**
- **Root Cause:** EPUB upload endpoint was parsing `htmlChapters` but not saving it to database, causing silent insert failures and server crashes
- **Database Layer Fix:**
  - Added `htmlChapters` field to both MemStorage and DbStorage `createEpubBook` methods
  - Added `title` field to audiobook storage methods for type consistency
- **Upload Endpoint Fix:**
  - Modified EPUB upload route to pass `parsed.htmlChapters` to storage layer
  - Added comprehensive logging with `[EPUB Upload]` and `[Audio Upload]` tags
- **Impact:** Eliminates server crashes during EPUB uploads, ensures formatted content is preserved
- **Testing:** E2E test confirmed upload flow works correctly - htmlChapters saved to DB and reader displays formatted content

**Progressive Sync FFmpeg Error Fix:**
- **Root Cause:** Progressive sync was passing Object Storage paths directly to FFmpeg, which can only read local files
- **Fix:** Added download logic to `progressive-sync.ts` to download audio from Object Storage to temp file before processing
- **Cleanup:** Proper temp file cleanup in both success and error paths
- **Pattern:** Uses same download approach as full sync for consistency

**Reader Only Showing Cover Fix:**
- **Root Cause:** Reader was hardcoded to display only `epub.htmlChapters[0]` (typically the cover page)
- **Fix:** Combine all HTML chapters into one continuous reading experience by joining chapter HTML and CSS
- **Impact:** Users can now read entire books in both paginated and scroll modes
- **UX:** Provides Apple Books-style continuous reading without manual chapter navigation

### Page-Turning Pagination (COMPLETED - October 18, 2025)
- **PaginatedHtmlRenderer Component:**
  - Calculates pages based on viewport height vs content height
  - Navigation via buttons, tap zones (desktop), and swipe gestures (mobile)
  - Page indicator shows "Page X of Y" at bottom center
  - Responsive recalculation on window resize
  - Atomic state updates preserve page position across all changes
- **Reading Mode Toggle:**
  - BookOpen icon → paginated mode with page controls
  - Scroll icon → continuous scrolling mode
  - Preference persisted in localStorage
- **State Preservation:**
  - Unified `setPageWithRef()` updates both ref and state synchronously
  - Page position preserved across theme changes, typography adjustments, and window resize
  - Content shrinking clamps to valid page range
  - Navigation + immediate resize maintains correct page
- **UX Features:**
  - Left 1/3 tap zone → previous page (desktop)
  - Right 1/3 tap zone → next page (desktop)
  - 50px minimum swipe distance for mobile gestures
  - Disabled button states on first/last pages
  - All typography and theme settings work in both modes

### EPUB Reprocessing (COMPLETED)
- **Backend Endpoint:** POST `/api/library/epubs/:id/reprocess`
  - Downloads EPUB from Object Storage
  - Re-parses with enhanced parser (HTML/CSS/fonts/images)
  - Updates database with new htmlChapters
  - Proper temp file cleanup in finally block
- **Frontend UI:** "Enable Formatting" button in reader header
  - Shows only when htmlChapters unavailable (legacy EPUBs)
  - One-click upgrade to formatted content
  - Auto-refresh after processing
  - Toast notifications for success/error

### EPUB Formatting Preservation (COMPLETED - October 16, 2025)
- **Schema:** Added `htmlChapters` field to epubBooks table (JSONB: { title, html, css })
- **Parser Enhancements:**
  - Extracts inline CSS from `<style>` tags
  - Extracts and resolves linked stylesheets from `<link rel="stylesheet">`
  - Resolves CSS `url()` references relative to correct base directories (HTML dir for inline, CSS dir for linked)
  - Converts images to base64 data URLs (jpg, png, gif, svg, webp, bmp, ico)
  - Converts CSS-referenced assets to base64 (fonts: woff, woff2, ttf, otf, eot)
  - Case-insensitive asset lookup with querystring/fragment handling
  - Comprehensive MIME type mapping with fallback
  - Logs warnings for missing assets
- **HtmlRenderer Component:**
  - Renders EPUB HTML in isolated iframe with sandbox="allow-same-origin"
  - Applies typography settings (font, boldText, lineSpacing, etc.)
  - Theme-aware (reading-background/foreground colors)
  - Responsive images and styled elements
- **EpubReader Integration:**
  - Conditionally uses HtmlRenderer when htmlChapters available
  - Falls back to ReadingPane for plain text
  - Preserves all theme and typography features

### Object Storage Migration (October 11, 2025)
- **Audio Chunking:** Migrated temporary chunk file storage from local filesystem to Replit Object Storage
- **Download Pipeline:** Added automatic download of audiobooks from Object Storage before processing
- **Cleanup:** Implemented proper cleanup of both local temp files and Object Storage chunks

### File Management Features (October 11, 2025)
- **CRUD Operations:** Added update and delete methods for EPUBs and audiobooks in storage layer
- **API Routes:** New endpoints for retrieving, renaming, and deleting individual files
- **Cascade Deletion:** Deleting EPUBs or audiobooks automatically removes associated sync sessions
- **Security:** All operations enforce user ownership verification

### Planned Features (Not Yet Implemented)
- **Page-Turning Navigation:** Implement pagination for EPUB chapters
- **Bookmarks:** Add bookmark functionality for EPUB reader
- **Standalone Reading Modes:**
  - "Read Only" mode for EPUBs without audiobooks
  - "Listen Only" mode for audiobooks without EPUBs
- **Library UI Enhancements:**
  - 3-dot dropdown menu on file cards
  - Rename dialog for files
  - Delete confirmation dialog

### Database Schema

The PostgreSQL database includes `users`, `sessions`, `epub_books`, `audiobooks`, and `sync_sessions` tables. UUID primary keys are used, with JSONB fields for flexible storage of chapters and sync points. Status and step enums are text fields, and timestamps provide audit trails.

## External Dependencies

**Third-Party Services:**

-   **OpenAI Whisper API:** For cloud-based speech-to-text transcription (`whisper-1` model).
-   **Replit Object Storage:** For persistent file storage and management.
-   **Neon PostgreSQL:** Serverless Postgres for database persistence.

**Third-Party Libraries:**

-   **Radix UI Primitives & shadcn/ui:** For accessible and styled UI components.
-   **Fuse.js:** For fuzzy string matching in text alignment.
-   **Cheerio:** For server-side HTML/XML parsing of EPUB content.
-   **AdmZip:** For EPUB file extraction.
-   **music-metadata:** For audio file metadata extraction.
-   **Drizzle ORM & Drizzle Kit:** For database interaction and migrations.
-   **Zod:** For runtime type validation.