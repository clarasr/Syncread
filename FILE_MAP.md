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

### Unused ❌ DELETE
| File | Status | Reason |
|------|--------|--------|
| ❌ `Home.tsx` | **DELETE** | Not in router, duplicate of Library |

---

## 🧩 Components

### Audio Players
| Component | Used By | Status | Purpose |
|-----------|---------|--------|---------|
| ✅ `IntegratedAudioPlayer.tsx` | Reader.tsx | **KEEP** | Player for synced mode (132 lines) |
| ✅ `AudioPlayer.tsx` | AudiobookPlayer.tsx | **KEEP** | Standalone audio player (130 lines) |
| ❌ `MinimizedAudioPlayer.tsx` | NONE | **DELETE** | Unused minimizable player (227 lines) |

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
| ❌ `SettingsPanel.tsx` | NONE | **DELETE** | Unused settings (109 lines) |

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
| ❌ `lib/authUtils.ts` | NONE | **DELETE** | Unused auth utilities |

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

### Files to DELETE ❌ (4 files, ~575 lines)

1. **`client/src/pages/Home.tsx`** (240 lines)
   - Not in router
   - Duplicate of Library page

2. **`client/src/components/MinimizedAudioPlayer.tsx`** (227 lines)
   - Never imported
   - Replaced by IntegratedAudioPlayer

3. **`client/src/components/SettingsPanel.tsx`** (109 lines)
   - Never imported
   - Settings now in modals (ThemeSelector, TypographyCustomizer)

4. **`client/src/lib/authUtils.ts`** (~? lines)
   - Never imported
   - Auth now handled by useAuth hook

### Total Codebase
- **Active code:** ~9,225 lines (excluding UI library)
- **Can remove:** ~575 lines (6% reduction)
- **UI library:** ~65 shadcn components (standard, keep all)

---

## 🎯 Recommendation

**Safe to delete now:**
```bash
rm client/src/pages/Home.tsx
rm client/src/components/MinimizedAudioPlayer.tsx
rm client/src/components/SettingsPanel.tsx
rm client/src/lib/authUtils.ts
```

These files are:
1. Not imported anywhere
2. Not in router
3. Superseded by newer implementations
4. Safe to remove without breaking anything

**After deletion, commit as:**
```
git commit -m "chore: Remove unused components (Home, MinimizedAudioPlayer, SettingsPanel, authUtils)"
```
