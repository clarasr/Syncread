# SyncRead File Map & Cleanup Recommendations

**Generated:** 2025-12-26
**Purpose:** Document codebase structure and identify files for cleanup

---

## 📁 Core Application Files

### Frontend Entry Points
- ✅ `client/src/main.tsx` - App entry point
- ✅ `client/src/App.tsx` - Routing and providers
- ✅ `client/index.html` - HTML template

### Backend Entry Points
- ✅ `server/index.ts` - Express server entry
- ✅ `server/routes.ts` (1414 lines) - All API routes
- ✅ `server/vite.ts` - Vite dev server integration

---

## 📄 Pages (Routes)

### Currently Used ✅
| Page | Route | Purpose | Lines |
|------|-------|---------|-------|
| `Landing.tsx` | `/` (unauthenticated) | Login/welcome screen | 93 |
| `Library.tsx` | `/library` | Main library view | 678 |
| `Reader.tsx` | `/reader` | **Synced reading mode** | 705 |
| `EpubReader.tsx` | `/epub` | Standalone EPUB reader | 270 |
| `AudiobookPlayer.tsx` | `/audiobook` | Standalone audio player | 386 |
| `not-found.tsx` | `*` | 404 page | 21 |

---

## 🧩 Components

### Audio Players
| Component | Used By | Status | Purpose |
|-----------|---------|--------|---------|
| ✅ `IntegratedAudioPlayer.tsx` | Reader.tsx | **KEEP** | Player for synced mode (132 lines) |
| ✅ `AudioPlayer.tsx` | AudiobookPlayer.tsx | **KEEP** | Standalone audio player (130 lines) |
| 🔮 `MinimizedAudioPlayer.tsx` | NONE (V1.0) | **KEEP - FUTURE** | Reserved for mode switching (227 lines) |

### Reading Components
| Component | Used By | Status | Purpose |
|-----------|---------|--------|---------|
| ✅ `ReadingPane.tsx` | Reader.tsx | **KEEP** | Text display for synced mode |
| ✅ `HtmlRenderer.tsx` | Reader, EpubReader | **KEEP** | Formatted EPUB rendering |
| ✅ `PaginatedHtmlRenderer.tsx` | Reader, EpubReader | **KEEP** | Page-turning mode |

### UI/Settings Components
| Component | Used By | Status | Purpose |
|-----------|---------|--------|---------|
| ✅ `ThemeSelector.tsx` | Reader, EpubReader | **KEEP** | Theme picker |
| ✅ `ThemeToggle.tsx` | Multiple | **KEEP** | Dark mode toggle |
| ✅ `TypographyCustomizer.tsx` | Reader, EpubReader | **KEEP** | Font/spacing controls |
| ✅ `ProcessingModal.tsx` | Reader | **KEEP** | Sync progress modal |
| ✅ `UploadModal.tsx` | Library | **KEEP** | File upload dialog |
| ✅ `FileUploadZone.tsx` | UploadModal | **KEEP** | Drag-drop zone |
| 🔮 `SettingsPanel.tsx` | NONE (V0.4) | **KEEP - FUTURE** | Reserved for Whisper model selection (109 lines) |

### UI Library (shadcn/ui) - All KEEP ✅
65 UI components in `client/src/components/ui/` - Standard shadcn library

---

## 🪝 Hooks

| Hook | Used By | Status | Purpose |
|------|---------|--------|---------|
| ✅ `useAuth.ts` | App, pages | **KEEP** | Authentication |
| ✅ `use-reader-theme.ts` | Reader, EpubReader | **KEEP** | Theme management |
| ✅ `use-toast.ts` | Multiple | **KEEP** | Toast notifications |
| ✅ `useDebouncedProgress.ts` | Reader | **KEEP** | Progress debouncing |

---

## 📚 Libraries & Utils

### Client Utils
| File | Used By | Status | Purpose |
|------|---------|--------|---------|
| ✅ `lib/queryClient.ts` | App, all pages | **KEEP** | TanStack Query setup |
| ✅ `lib/utils.ts` | Many | **KEEP** | Utility functions |
| ✅ `lib/use-mobile.tsx` | UI components | **KEEP** | Mobile detection |
| ✅ `lib/uploadValidation.ts` | UploadModal | **KEEP** | File validation |
| ✅ `lib/epub-renderer-utils.ts` | HtmlRenderer | **KEEP** | EPUB rendering helpers |

### Server Utils
| File | Lines | Status | Purpose |
|------|-------|--------|---------|
| ✅ `epub-parser.ts` | 256 | **KEEP** | Parse EPUB files |
| ✅ `fuzzy-matcher.ts` | 116 | **KEEP** | Text-audio matching |
| ✅ `progressive-sync.ts` | 503 | **KEEP** | Progressive sync logic |
| ✅ `whisper-service.ts` | 72 | **KEEP** | OpenAI Whisper API |
| ✅ `whisper-chunked.ts` | 92 | **KEEP** | Chunk large audio files |
| ✅ `audio-extractor.ts` | 183 | **KEEP** | FFmpeg audio extraction |
| ✅ `audio-chunker.ts` | 442 | **KEEP** | Audio chunking logic |
| ✅ `sync-algorithm.ts` | 96 | **KEEP** | Full sync algorithm |
| ✅ `file-hash.ts` | ? | **KEEP** | File deduplication |

---

## 🗄️ Database & Storage

| File | Lines | Status | Purpose |
|------|-------|--------|---------|
| ✅ `shared/schema.ts` | 119 | **KEEP** | Database schema (Drizzle) |
| ✅ `server/db.ts` | 15 | **KEEP** | DB connection |
| ✅ `server/storage.ts` | 521 | **KEEP** | Data access layer |
| ✅ `server/objectStorage.ts` | 337 | **KEEP** | Object Storage integration |
| ✅ `server/objectAcl.ts` | 181 | **KEEP** | Access control |
| ✅ `server/replitAuth.ts` | 158 | **KEEP** | Replit Auth |

---

## 🧪 Tests

| File | Status | Note |
|------|--------|------|
| ✅ `lib/__tests__/uploadValidation.test.ts` | **KEEP** | Has actual tests |
| ⚠️ `server/utils/__tests__/file-hash.test.ts` | **KEEP** | Has tests but check if passing |

---

## 🔧 Configuration Files

All configuration files are needed - **KEEP ALL**:
- `package.json`, `tsconfig.json`
- `vite.config.ts`, `tailwind.config.ts`
- `drizzle.config.ts`, `postcss.config.js`
- `components.json` (shadcn config)

---

## 📊 Summary

### Files DELETED ✅ (2 files, ~244 lines)

1. ✅ **`client/src/pages/Home.tsx`** (240 lines) - DELETED
   - Duplicate of Library page
   - Not in router

2. ✅ **`client/src/lib/authUtils.ts`** (4 lines) - DELETED
   - Trivial helper, not needed

### Files RESERVED for Future 🔮 (2 files, ~336 lines)

1. 🔮 **`client/src/components/MinimizedAudioPlayer.tsx`** (227 lines)
   - **Reserved for V1.0 - Enhanced Reading Modes**
   - Collapsible player for mode switching
   - Shows minimized bar at bottom while reading EPUB-only
   - Added TODO comment explaining future use

2. 🔮 **`client/src/components/SettingsPanel.tsx`** (109 lines)
   - **Reserved for V0.4 - Cost Management**
   - Whisper model selection (fast/balanced/accurate)
   - Cost estimates before sync
   - Added TODO comment explaining future use

### Total Codebase
- **Active code:** ~9,225 lines (excluding UI library)
- **Removed:** ~244 lines (2.6% reduction)
- **Reserved for future:** ~336 lines (documented for V0.4 & V1.0)
- **UI library:** ~65 shadcn components (standard, keep all)

---

## 🎯 Result

**Cleaned up:**
```bash
✓ Deleted: Home.tsx, authUtils.ts
✓ Reserved: MinimizedAudioPlayer.tsx (V1.0), SettingsPanel.tsx (V0.4)
✓ Added TODO comments explaining future use
```

The codebase is now cleaner while preserving valuable components for planned features!
