# SyncRead - EPUB & Audiobook Sync Application

## Overview

SyncRead is a mobile-first web application designed to provide an immersive reading experience by synchronizing EPUB text with audiobook narration. It achieves this by automatically aligning text and audio using AI-powered Whisper transcription and fuzzy text matching. The application allows users to upload and manage EPUB files and audiobooks in an Apple Books-style library, create synchronized reading sessions, and customize their reading experience with themes and typography controls. The core ambition is to offer a seamless and engaging way to consume books through synchronized audio and text.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application uses a React-TypeScript frontend with Vite, TanStack Query, Wouter, and Tailwind CSS (shadcn/ui), inspired by Apple Books for a mobile-first, content-centric design. It features a theme system with 6 presets, light/dark modes, and extensive typography customization. Preferences are persisted in `localStorage`.

The backend is built with Express.js and Node.js, utilizing Drizzle ORM with a PostgreSQL database (Neon). Authentication is handled via Replit Auth (OpenID Connect). File storage leverages Replit Object Storage with presigned URLs for secure access. The system supports progressive syncing, processing content in 1000-word chunks on-demand for quick session starts.

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