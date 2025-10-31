# SyncRead - TODO List

## Remaining Features

### 1. EPUB Reprocessing ✅ COMPLETED (October 18, 2025)
**Priority: High**
- ✅ Add "Reprocess" button to re-parse existing EPUBs with new HTML/CSS extraction
- ✅ This fixes formatting for EPUBs uploaded before the HTML rendering feature was implemented
- ✅ Users can now click "Enable Formatting" to upgrade legacy EPUBs

### 2. Page-Turning Pagination ✅ COMPLETED (October 18, 2025)
**Priority: High**
- ✅ Calculate page breaks based on viewport height
- ✅ Add swipe/tap navigation between pages
- ✅ Show page indicators (e.g., "Page 12 of 245")
- ✅ Toggle between paginated and scroll modes with BookOpen/Scroll icon
- ✅ Preserve pagination state across theme/typography changes and window resize
- ✅ Full support for formatted HTML content

### 3. Bookmarking System
**Priority: Medium**
- Save reading position for text (chapter + page/position)
- Save playback position for audio (timestamp)
- Sync bookmarks across text-only, audio-only, and synced reading modes
- Visual bookmark indicators in the reading interface
- List of saved bookmarks with quick access

### 4. UI/UX Overhaul - Library
**Priority: Medium**
- Apple Books-style grid layout
- Enhanced card design with cover images
- Mobile-first responsive design
- Smooth transitions and animations
- 3-dot dropdown menu on file cards
- Rename and delete dialogs

### 5. UI/UX Overhaul - Reading Interfaces
**Priority: Medium**
- Apple Books-style controls and gestures
- Tap zones for page navigation
- Swipe gestures for page turns
- Refined theme selector design
- Enhanced typography customizer
- Polish all interactions and transitions

### 6. End-to-End Testing
**Priority: High**
- Test with real EPUB files (various formats)
- Test with real audiobook files (various formats)
- Validate sync accuracy across different content types
- Mobile device testing (iOS Safari, Chrome)
- Edge case handling and error states

## Nice-to-Have Features (Future)
- Standalone "Read Only" mode for EPUBs without audiobooks
- Standalone "Listen Only" mode for audiobooks without EPUBs
- Export/import bookmarks
- Reading statistics and progress tracking
- Notes and highlights
