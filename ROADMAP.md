# SyncRead Development Roadmap

## Vision
A seamless audiobook + EPUB reader that allows effortless switching between:
- **Reading mode** (EPUB only)
- **Listening mode** (Audiobook only)
- **Immersive mode** (Synced reading with karaoke-style highlighting)

**Key principle:** Progress syncs across all modes, so you can switch freely and always pick up where you left off.

---

## Current Status: V0 - Stabilization Phase 🔧

### V0.0.1 - Fix Critical Sync Issues ✅ **COMPLETED** (2025-12-26)
**Goal:** Make the karaoke highlighting work reliably without skips/jumps

**Tasks:**
- [x] ~~Fix the paragraph jump bug~~ - Fixed paragraph splitting to only use double newlines
- [x] ~~Improve fuzzy matching accuracy~~
  - [x] Better handling of line breaks vs paragraph breaks
  - [x] More granular sync points (sentence-level + word chunks)
  - [x] Add confidence scoring (increased threshold to 55%, stricter matching)
- [x] ~~Add sync quality metrics~~ - Added match rate, confidence stats, warnings

**Changes Made:**
- `ReadingPane.tsx`: Changed paragraph split regex from `/\n\n+|\n/` → `/\n\n+/`
- `Reader.tsx`: Same fix for paragraph boundary detection
- `fuzzy-matcher.ts`:
  - Added sentence-level chunking for finer-grained matches
  - Increased confidence threshold from 50% → 55%
  - Stricter Fuse.js parameters (0.35 threshold, min 12 chars)
  - Comprehensive logging for match quality
- `progressive-sync.ts`:
  - Use Whisper segment-level timestamps (not just full text)
  - Added sync quality metrics (match rate, confidence stats)
  - Warnings for low match rates (<50%) or low confidence (<70%)

**Success Criteria:** ✓ Text highlighting smoothly follows audio without jumping multiple lines

---

### V0.0.2 - Unified Progress Tracking ⬅️ **NEXT**
**Goal:** Reading position syncs across all three modes

**Tasks:**
- [ ] Create single source of truth for reading position (character index or word position)
- [ ] Map between modes:
  - [ ] Audio time ↔ Text position (already exists via sync anchors)
  - [ ] Last read paragraph → Audio time (interpolate from anchors)
  - [ ] Last audio time → Text paragraph (already exists)
- [ ] Persist unified position in database (add `lastReadPosition` to sessions)
- [ ] Resume from last position regardless of mode

**Success Criteria:** Switch from reading to listening (or vice versa) and automatically resume at the correct position

---

### V0.0.3 - Mid-Chapter Start Support
**Goal:** Allow starting playback from any paragraph in the book

**Tasks:**
- [ ] Show chapter/paragraph list in Reader
- [ ] Click paragraph → seek audio to corresponding time
- [ ] Seek audio → scroll text to corresponding paragraph
- [ ] Handle alignment edge cases (before first anchor, after last anchor)

**Success Criteria:** Click any paragraph and audio starts playing from that point

---

### V0.0.4 - Stability & Error Handling
**Goal:** Robust progressive sync that recovers gracefully from errors

**Tasks:**
- [ ] Add error boundaries (prevent crashes from propagating)
- [ ] Improve chunk sync robustness:
  - [ ] Cache downloaded audio during progressive sync
  - [ ] Retry failed chunks with exponential backoff
  - [ ] Resume from last successful chunk on error
- [ ] Add sync status indicators (show confidence, last sync time)

**Success Criteria:** Progressive sync completes successfully even with network hiccups or API errors

---

## V0.x - Incremental Improvements ⚙️

### V0.1 - Performance Optimization
- Reduce re-renders in Reader (debounce timeupdate, memoize calculations)
- Lazy-load HTML chapters (don't send base64 assets until needed)
- Add paragraph virtualization for large books (only render visible paragraphs)
- Optimize database queries (pagination, indexing)

### V0.2 - Code Quality & Testing
- Extract constants (magic numbers → named constants)
- Add unit tests for critical paths (fuzzy matching, sync interpolation)
- Refactor duplicated logic (paragraph splitting, Object Storage downloads)
- Add JSDoc comments for complex algorithms

### V0.3 - UX Polish
- Improve sync feedback (confidence scores, quality indicators)
- Better loading states (skeletons instead of spinners)
- Keyboard shortcuts (Space = play/pause, Arrow keys = seek)
- "Re-sync this section" button for bad matches

### V0.4 - Cost Management
- Show Whisper API cost estimates before sync
- Add sync preview (show first 30 seconds of alignment before full sync)
- Implement chunk size optimization (balance cost vs accuracy)

---

## V1 - New Features ✨

### V1.0 - Enhanced Reading Modes
- Standalone EPUB reader (no audio required)
- Standalone audiobook player (no EPUB required)
- Mode switcher in Library (show available modes per session)
- Word-level highlighting (karaoke style, not paragraph)

### V1.1 - Bookmarking & Navigation
- Visual bookmarks (save positions with notes)
- Chapter navigation (table of contents, jump to chapter)
- Reading statistics (time spent, pages read, listening time)

### V1.2 - Multi-Device Sync
- Cloud progress sync (resume on different device)
- Conflict resolution (if reading on two devices simultaneously)

### V1.3 - Advanced Sync Options
- Manual sync point editing (drag to adjust bad matches)
- Multiple sync strategies (fast/cheap vs slow/accurate)
- Custom Whisper models (fine-tuned for specific narrators)

---

## Development Principles

1. **Incremental development:** Complete one version fully before moving to next
2. **No breaking changes:** Add features without removing what works
3. **Test thoroughly:** Each version should be stable before moving forward
4. **Version control:** Tag each release (v0.0.1, v0.0.2, etc.)

---

**Last Updated:** 2025-12-26
**Current Version:** v0.0.1 ✅
**Target Version:** v0.0.2
