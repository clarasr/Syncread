# SyncRead - Apple Books Design Guidelines

## Design Approach

**Selected Approach:** Apple Books / iOS Reading Experience

**Justification:** This is a reading-focused application where content clarity, comfort, and customization are paramount. Apple Books provides the perfect foundation for:
- Clean, distraction-free reading with serif typography
- Comprehensive theme system with light/dark modes
- Advanced typography controls for accessibility
- Minimalist UI that emphasizes content over chrome
- Familiar iOS patterns for intuitive interaction

**Core Design Principles:**
1. **Content First** - Text and reading experience dominate; UI fades away
2. **Reading Comfort** - Serif fonts, proper spacing, customizable themes
3. **Minimalist Chrome** - Icon-only buttons, hidden controls until needed
4. **Theme Flexibility** - Multiple preset themes plus full customization

---

## Color Palette

### Theme Presets

**Original (Light)**
- Background: 0 0% 100% (pure white)
- Text: 0 0% 0% (black)
- Secondary Text: 0 0% 40%

**Quiet (Dark Gray)**
- Background: 0 0% 25% (dark gray)
- Text: 0 0% 85% (light gray)
- Secondary Text: 0 0% 60%

**Paper (Cream)**
- Background: 40 20% 96% (warm cream)
- Text: 30 15% 15% (warm black)
- Secondary Text: 30 10% 40%

**Bold (High Contrast)**
- Background: 0 0% 0% (pure black)
- Text: 0 0% 100% (pure white)
- Secondary Text: 0 0% 70%

**Calm (Beige)**
- Background: 35 30% 92% (soft beige)
- Text: 25 20% 20% (warm dark)
- Secondary Text: 25 15% 45%

**Focus (Minimal Dark)**
- Background: 220 15% 12% (cool dark)
- Text: 220 10% 95% (cool white)
- Secondary Text: 220 10% 65%

### UI Colors (Theme Independent)
- Primary: 212 100% 48% (blue for interactive elements)
- Success: 142 76% 36% (green)
- Destructive: 0 84% 48% (red)
- Border: Uses theme with 10% opacity

---

## Typography

### Font Families
**Reading Fonts (User Selectable):**
- Georgia (Default Serif)
- Palatino (Classic Serif)
- Charter (Modern Serif)
- New York (Apple Serif)
- San Francisco (Sans-Serif)
- Iowan Old Style (Traditional)

**UI Fonts:**
- System: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto

### Text Hierarchy
**Reading Text:**
- Body: 16-24px (user adjustable), leading-relaxed, serif
- Chapter Title: text-3xl (30px), font-semibold, tracking-tight
- Book Title: text-xl, font-semibold

**UI Elements:**
- Buttons: text-base, font-medium
- Labels: text-sm, font-medium
- Captions: text-xs, secondary color

### Customizable Controls
- Font Size: 12px - 32px (slider)
- Line Spacing: 1.0 - 2.0 (slider)
- Character Spacing: -0.05 - 0.1em (slider)
- Word Spacing: 0 - 0.2em (slider)
- Bold Text: Toggle

---

## Layout System

**Spacing:** Use 8px grid (space-2, space-4, space-6, space-8)

**Reading Layout:**
- Max width: 65ch for optimal line length
- Side margins: 32px (desktop), 24px (tablet), 16px (mobile)
- Top/bottom padding: 48px (desktop), 32px (mobile)

**UI Panels:**
- Bottom sheets: Rounded top corners (24px), slide up animation
- Modals: Full-screen on mobile, centered card on desktop
- Toolbars: 56px height, minimal padding

---

## Component Library

### Core Reading Components

**ReadingPane**
- Clean white/theme background
- Serif font with customizable settings
- Current sentence: Subtle underline or bold (not background highlight)
- Smooth auto-scroll to current position
- Tap to show/hide controls

**MinimizedAudioPlayer**
- Compact bar: 64px height
- Content: Book cover thumbnail (48px), chapter name, play button
- Tap to expand to full player
- Expandable: Slide up animation, full controls revealed

**FullAudioPlayer**
- Large book cover image
- Chapter title and book metadata
- Seek slider with timestamps
- Large play/pause button
- 15s skip back/forward
- Speed control (0.5x - 2x)
- Volume slider
- Sleep timer icon
- Additional options (...)

### Theme & Settings Components

**ThemeSelector**
- Grid layout: 2 columns on mobile, 3 on desktop
- Each theme card: 
  - Theme name
  - Preview with "Aa" in theme colors
  - Selected state: Checkmark overlay
- Light/Dark toggle above grid
- "Customize" button at bottom

**TypographyCustomizer**
- Font selector: Dropdown menu
- Bold text: Toggle switch
- Sliders for:
  - Line spacing (icon + value)
  - Character spacing (icon + value)
  - Word spacing (icon + value)
- Live preview text at top

### Navigation Components

**BottomToolbar** (Reading View)
- Icon buttons only: Contents (☰), Bookmark, Share, Brightness
- 56px height
- Icons: 24px, ghost style
- Centered horizontally

**BottomTabBar** (Library/Home)
- Floating rounded bar
- Icons: Home, Library, Audiobooks, Search
- Active state: Icon fill + label
- 80px height (includes safe area)

### Library Components

**BookGrid**
- Grid: 2 columns mobile, 3-4 desktop
- Book cover: aspect-ratio 2/3
- Progress percentage below
- Cloud icon if not downloaded
- Menu (...) for options

**LibraryHeader**
- Large title: "Library"
- Filter/sort icons (right)
- Search bar (expandable)

---

## Animations

**Principles: Smooth, Natural, Subtle**

- Bottom sheet slide up: 300ms ease-out
- Theme change: 200ms cross-fade
- Player expand/collapse: 250ms ease-in-out
- Auto-scroll: scroll-behavior smooth
- Button press: scale(0.95) 100ms
- Modal appear: fade + slide 250ms

**No Animation:**
- Text rendering
- Font changes
- Theme color switches

---

## Interactive States

**Reading Controls:**
- Tap center: Show/hide toolbar
- Swipe down: Close reader
- Long press text: Select/highlight options
- Pinch: Font size adjustment

**Audio Player:**
- Tap minimized bar: Expand to full player
- Swipe down full player: Minimize
- Drag seek slider: Scrub audio
- Double tap sides: Skip 15s forward/back

**Theme Selector:**
- Tap theme card: Apply theme
- Tap customize: Show detail editor
- Toggle light/dark: Instant switch

---

## Accessibility

**Requirements:**
- All interactive elements: min 44x44px touch target
- Sufficient contrast: WCAG AA minimum
- Screen reader labels on all icons
- Keyboard navigation support
- Respects system font size preferences
- Dynamic type support

**Typography Helpers:**
- Bold text option for low vision
- Adjustable spacing for dyslexia
- High contrast themes available

---

## iOS Patterns

**Bottom Sheets:**
- Rounded top corners (24px)
- Drag handle at top
- Swipe down to dismiss
- Backdrop blur + dim

**Context Menus:**
- Glassmorphic background
- Rounded corners (16px)
- Icons left-aligned
- Destructive actions at bottom (red)

**Switches:**
- iOS-style toggle
- Smooth animation
- Green when on

**Sliders:**
- Thick track (4px)
- Large thumb (28px)
- Value label appears on drag
