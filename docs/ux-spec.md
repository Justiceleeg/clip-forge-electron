# ClipForge UI/UX Specification

**Version:** 1.0  
**Date:** 2025-10-27  
**Status:** Specification for Implementation

---

## Executive Summary

This document defines the complete UI/UX specification for ClipForge, a desktop video editing application built with Tauri + Leptos. The specification covers design system, layout architecture, component specifications, interaction patterns, and implementation guidelines for both MVP (Epic 1) and Phase 2 features (Epic 2).

### Goals

- Provide an intuitive, streamlined desktop video editing experience inspired by CapCut
- Minimize cognitive load while maximizing functionality
- Support rapid 72-hour development cycle with clear implementation guidance
- Ensure MVP delivers core import → preview → trim → export workflow

---

## 1. Design System

### 1.1 Color Palette

**Dark Theme (Default)**

```css
/* Primary Colors */
--color-primary: #4F6DF7;          /* Brand blue */
--color-primary-hover: #6377FF;    /* Lighter blue for hover */
--color-primary-active: #3A5CE6;   /* Darker blue for active/pressed */

/* Secondary Colors */
--color-secondary: #7B8AE6;        /* Accent purple-blue */
--color-accent: #FF6B6B;          /* Error/warning red */

/* Neutral Grays */
--color-bg-primary: #0F0F0F;      /* Main background */
--color-bg-secondary: #1A1A1A;    /* Panel backgrounds */
--color-bg-tertiary: #252525;     /* Input backgrounds */
--color-border: #2A2A2A;          /* Borders, dividers */
--color-text-primary: #FFFFFF;     /* Primary text */
--color-text-secondary: #B0B0B0;  /* Secondary text */
--color-text-tertiary: #707070;   /* Disabled text */

/* Semantic Colors */
--color-success: #4CAF50;         /* Success messages */
--color-warning: #FFA726;         /* Warning messages */
--color-error: #EF5350;           /* Error states */
--color-info: #42A5F5;            /* Info messages */

/* Timeline Specific */
--color-clip-default: #4F6DF7;    /* Default clip color */
--color-clip-selected: #7B8AE6;   /* Selected clip */
--color-playhead: #FF6B6B;        /* Playhead indicator */
--color-timeline-bg: #151515;     /* Timeline background */
--color-track-bg: #1F1F1F;        /* Track background */
```

**Light Theme (Optional)**

Note: Light theme can be implemented later if time permits. Focus on dark theme for MVP.

```css
/* Light Theme Placeholder - Out of scope for MVP */
/* Implement in future iteration if needed */
```

### 1.2 Typography

**Font Family**
- Primary: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif`
- Monospace (for code/timecode): `'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace`

**Scale**
```css
--font-size-xs: 0.75rem;    /* 12px - Tooltips, metadata */
--font-size-sm: 0.875rem;   /* 14px - Secondary text */
--font-size-base: 1rem;     /* 16px - Body text */
--font-size-lg: 1.125rem;    /* 18px - Subheadings */
--font-size-xl: 1.25rem;    /* 20px - Section headers */
--font-size-2xl: 1.5rem;    /* 24px - Panel titles */
--font-size-3xl: 2rem;      /* 32px - Page titles */
```

**Weights**
```css
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
```

**Line Heights**
```css
--line-height-tight: 1.2;
--line-height-normal: 1.5;
--line-height-relaxed: 1.75;
```

### 1.3 Spacing System

Base unit: 4px

```css
--spacing-1: 0.25rem;   /* 4px */
--spacing-2: 0.5rem;    /* 8px */
--spacing-3: 0.75rem;   /* 12px */
--spacing-4: 1rem;      /* 16px */
--spacing-5: 1.25rem;   /* 20px */
--spacing-6: 1.5rem;    /* 24px */
--spacing-8: 2rem;      /* 32px */
--spacing-10: 2.5rem;   /* 40px */
--spacing-12: 3rem;     /* 48px */
```

### 1.4 Border Radius

```css
--radius-sm: 0.25rem;    /* 4px - Small elements */
--radius-md: 0.5rem;     /* 8px - Buttons, inputs */
--radius-lg: 0.75rem;    /* 12px - Cards, panels */
--radius-xl: 1rem;       /* 16px - Modals */
--radius-full: 9999px;   /* Pills, avatars */
```

### 1.5 Shadows and Elevation

```css
/* Elevation levels */
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.25);
--shadow-md: 0 2px 4px 0 rgba(0, 0, 0, 0.3);
--shadow-lg: 0 4px 8px 0 rgba(0, 0, 0, 0.35);
--shadow-xl: 0 8px 16px 0 rgba(0, 0, 0, 0.4);

/* Used for:
- Buttons: shadow-sm
- Cards/Panels: shadow-md
- Modals: shadow-lg
- Timeline clips: shadow-sm
*/
```

### 1.6 Icons

**Icon System Guidelines**
- Use 16x16, 20x20, 24x24 sizes based on context
- Maintain 1px stroke width for consistency
- Prefer outlined style for clarity at small sizes
- Use SVG icons for crisp rendering

**Icon Mapping (MVP)**
```
📁 Import
📤 Export  
▶️ Play
⏸️ Pause
✂️ Trim/Split
🗑️ Delete
```

---

## 2. Layout Architecture

### 2.1 Window Layout

**Minimum Window Size:** 1280px × 720px  
**Default Window Size:** 1440px × 900px  
**Maximum Window Size:** User-definable (resizable)

### 2.2 MVP Layout Structure

```
┌─────────────────────────────────────────────────┐
│                    Toolbar                       │
│  [Import] [Export]              [Settings?]      │
├─────────────────────────────────────────────────┤
│                                                 │
│            Video Preview Panel                  │
│          (16:9 aspect ratio)                   │
│                                                 │
│         Playback Controls Below                 │
├─────────────────────────────────────────────────┤
│              Timeline Editor                    │
│  [Playhead]                                     │
│  ────────────────────────────────────────────  │
│  Track 1: [════════════════] (clip block)      │
│  ────────────────────────────────────────────  │
│  Minimum Height: 200px                         │
│  Expandable via drag handle                    │
└─────────────────────────────────────────────────┘
```

**Responsive Behavior:**
- Window can be resized down to 1280×720
- Timeline can be collapsed/expanded (drag handle at top)
- Preview panel maintains 16:9 aspect ratio when possible

### 2.3 Phase 2 Layout Structure

```
┌───┬───────────────────────────────────────────┐
│ M │              Toolbar                       │
│ e │  [Import] [Record] [Export]  [Settings]   │
│ d ├───────────────────────────────────────────┤
│ i │                                             │
│ a │           Video Preview                    │
│ L │         (16:9 aspect ratio)               │
│ i │                                             │
│ b │        Playback Controls                   │
│ r │                                             │
│ a ├───────────────────────────────────────────┤
│ r │                                             │
│ y │         Timeline Editor                    │
│   │  [Playhead]                                 │
│   │  ────────────────────────────────        │
│   │  Track 2: [══════] [══════]              │
│   │  Track 1: [═════════════════]             │
│   │  ────────────────────────────────        │
│   │  [Zoom Controls]                          │
└───┴───────────────────────────────────────────┘
```

**Media Library Panel:**
- Default width: 250px
- Collapsible to 0px (hide completely)
- Contains: clip thumbnails, metadata, search (future)

### 2.4 Grid System

```css
/* Main container uses CSS Grid */
.editor-container {
  display: grid;
  grid-template-rows: auto 1fr auto; /* Toolbar, Content, Timeline */
  height: 100vh;
}

/* Phase 2: Add sidebar */
.editor-container.phase2 {
  grid-template-columns: 250px 1fr;
  grid-template-rows: auto 1fr auto;
}

/* Responsive breakpoints */
@media (max-width: 1400px) {
  .media-library {
    display: none; /* Hide on smaller screens */
  }
}
```

---

## 3. Component Specifications

### 3.1 MVP Components

#### 3.1.1 Video Preview Player

**Location:** Center panel (largest area)

**Structure:**
```
┌────────────────────────────────────┐
│                                    │
│                                    │
│      <video> element               │
│      (16:9 aspect ratio)          │
│                                    │
│                                    │
│                                    │
├────────────────────────────────────┤
│  [◀◀] [◀] [▶] [▶▶]  [Timecode]    │
│  5s   10s       00:00:15 / 02:30  │
└────────────────────────────────────┘
```

**Props:**
- `video_src`: Video source URL/path
- `current_time`: Current playback position
- `duration`: Total video duration
- `is_playing`: Playback state
- `trim_start`: Start trim point (optional)
- `trim_end`: End trim point (optional)

**States:**
- Empty: Show placeholder text "Import a video to get started"
- Loading: Show loading spinner
- Loaded: Display video with controls
- Error: Show error message with retry button

**Interactions:**
- Play/Pause: Spacebar or click play button
- Scrub: Click/drag on timeline to jump to position
- Frame advance: Left/Right arrow keys

**CSS:**
```css
.video-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-secondary);
  min-height: 400px;
}

.video-preview video {
  max-width: 100%;
  max-height: calc(100vh - 300px); /* Reserve space for controls */
  background: #000;
  border-radius: var(--radius-lg);
}

.preview-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-4);
  padding: var(--spacing-4);
}

.timecode-display {
  font-family: monospace;
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
}
```

#### 3.1.2 Timeline Editor

**Location:** Bottom panel (minimum 200px height, expandable)

**Structure:**
```
┌─────────────────────────────────────┐
│  [▲ Drag to resize]                │
├─────────────────────────────────────┤
│  00:00    00:15    00:30   00:45   │
│  |════════════════════════════════| │
│                                    │
│  ┌────────────────────────────────┐ │
│  │ Track 1                       │ │
│  │ [======== Clip Block ========] │ │
│  │                                │ │
│  └────────────────────────────────┘ │
│                                    │
│  [Zoom: ████████░░]                │
└─────────────────────────────────────┘
```

**Track Structure:**
```css
.timeline {
  background: var(--color-timeline-bg);
  border-top: 1px solid var(--color-border);
  position: relative;
}

.track {
  height: 80px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-track-bg);
  position: relative;
}

.clip-block {
  height: 70px;
  margin: 5px;
  background: var(--color-clip-default);
  border-radius: var(--radius-md);
  cursor: move;
  position: absolute;
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
}

.clip-block:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.clip-block.selected {
  background: var(--color-clip-selected);
  border: 2px solid var(--color-playhead);
}
```

**Clip Block States:**
- Default: Solid color block
- Hover: Slight elevation, show trim handles
- Selected: Highlighted border, show controls
- Dragging: Semi-transparent, follows cursor

**Trim Handles:**
```
[◄──] [========================] [──►]
Left   Content Area              Right
```

```css
.trim-handle {
  width: 8px;
  height: 100%;
  background: rgba(255, 255, 255, 0.5);
  cursor: ew-resize;
  border-radius: var(--radius-sm) 0 0 var(--radius-sm);
}

.trim-handle.right {
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

.trim-handle:hover {
  background: rgba(255, 255, 255, 0.8);
}
```

#### 3.1.3 Import Drop Zone

**Location:** Overlays main content when empty or dropped file

**States:**

**Empty State:**
```
┌─────────────────────────────────────┐
│                                    │
│      📁                              │
│                                    │
│     Drop videos here                │
│   or click to browse                │
│                                    │
│   Supports: MP4, MOV                │
│                                    │
└─────────────────────────────────────┘
```

**Drag Over:**
- Border: 2px dashed var(--color-primary)
- Background: rgba(79, 109, 247, 0.1)
- Scale: 1.02

**Loading:**
- Show spinner
- Disable drop zone

**Error:**
- Show error icon
- Display error message
- Provide retry button

**CSS:**
```css
.import-dropzone {
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-12);
  text-align: center;
  transition: all 0.3s ease;
}

.import-dropzone.drag-over {
  border-color: var(--color-primary);
  background: rgba(79, 109, 247, 0.1);
  transform: scale(1.02);
}
```

#### 3.1.4 Export Modal

**Location:** Overlay modal (centered on screen)

**Structure:**
```
┌─────────────────────────────────────┐
│   Export Video              [X]    │
├─────────────────────────────────────┤
│                                     │
│   Resolution: [720p ▼]             │
│   Format: MP4                       │
│                                     │
│   Filename: [clip-forge-video.mp4] │
│                                     │
│   Save Location: [Browse...]       │
│   /Users/john/Desktop/             │
│                                     │
│   ────────────────────────         │
│   Progress: [████████░░] 75%       │
│                                     │
│   [Cancel]         [Export]        │
└─────────────────────────────────────┘
```

**Props:**
- `is_exporting`: Boolean (shows progress bar)
- `progress`: 0-100 percentage
- `filename`: String
- `save_location`: String
- `resolution`: "720p" | "1080p" | "source"

**States:**
- Initial: Show settings, ready to export
- Exporting: Show progress, disable controls
- Success: Show checkmark, auto-close after 2s
- Error: Show error message, allow retry

**CSS:**
```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--color-bg-secondary);
  border-radius: var(--radius-xl);
  padding: var(--spacing-6);
  max-width: 500px;
  width: 90%;
  box-shadow: var(--shadow-xl);
}

.export-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-tertiary);
}
```

#### 3.1.5 Toolbar

**Location:** Top of window

**Structure:**
```
┌──────────────────────────────────────────┐
│  📁 Import  📤 Export    [⚙️] Settings   │
└──────────────────────────────────────────┘
```

**Components:**
- Icon buttons with labels
- Tooltips on hover
- Disabled state when no video loaded (for Export)

**CSS:**
```css
.toolbar {
  display: flex;
  align-items: center;
  gap: var(--spacing-4);
  padding: var(--spacing-4) var(--spacing-6);
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
}

.toolbar-button {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-3) var(--spacing-4);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.toolbar-button:hover {
  background: var(--color-bg-tertiary);
  border-color: var(--color-primary);
}

.toolbar-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### 3.2 Phase 2 Components

#### 3.2.1 Media Library Panel

**Structure:**
```
┌────────────────────────┐
│ 📚 Media Library    [×]│
├────────────────────────┤
│ [Grid] [List]  🔍     │
├────────────────────────┤
│ ┌──────┐ ┌──────┐     │
│ │      │ │      │     │
│ │  📺  │ │  📺  │     │
│ │ 15s  │ │ 2m   │     │
│ └──────┘ └──────┘     │
│ ┌──────┐            │
│ │      │             │
│ │  📺  │             │
│ │ 45s  │             │
│ └──────┘            │
└────────────────────────┘
```

**Features:**
- Grid view (default): Thumbnail tiles
- List view: Compact rows with thumbnail + metadata
- Search: Filter by filename
- Metadata: Duration, resolution visible on hover

#### 3.2.2 Recording Controls

**Location:** Modal or sidebar panel

**Structure:**
```
┌────────────────────────────────────┐
│      Start Recording               │
├────────────────────────────────────┤
│                                    │
│  Video Source:                      │
│  ○ Full Screen                     │
│  ○ Window        [Select Window ▼] │
│  ○ Webcam        [Camera 1 ▼]     │
│                                    │
│  Audio Source:                      │
│  ☑ Microphone   [Mic 1 ▼]         │
│  ☑ System Audio                    │
│                                    │
│  ⏺ Start Recording                 │
└────────────────────────────────────┘
```

**Features:**
- Source selection radio buttons
- Device dropdowns
- Preview thumbnail for webcam
- Duration timer once recording starts
- Stop button during recording

#### 3.2.3 Multi-track Timeline

**Structure:**
```
┌────────────────────────────────────┐
│  00:00    00:30    01:00   01:30 │
│  |══════════════════════════════| │
├────────────────────────────────────┤
│  Track 2 (Overlay):               │
│  [══]  [==========]  [══]         │
├────────────────────────────────────┤
│  Track 1 (Main):                   │
│  [====================]  [===]    │
└────────────────────────────────────┘
```

**Features:**
- Multiple tracks stacked vertically
- Track labels (edit-able)
- Drag clips between tracks
- Stacking: Top track overlays bottom

#### 3.2.4 Playhead

**Visual:**
```
     |
   ──┼──
     |
```

**CSS:**
```css
.playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--color-playhead);
  pointer-events: none;
  z-index: 10;
}

.playhead::before {
  content: '';
  position: absolute;
  top: 0;
  left: -6px;
  width: 14px;
  height: 14px;
  background: var(--color-playhead);
  border-radius: 50%;
}
```

**Interactions:**
- Draggable along timeline
- Updates preview on scrub
- Snaps to clip edges when enabled

#### 3.2.5 Zoom Controls

**Structure:**
```
Timeline Zoom: [█░░░░░░] 10%
               100ms    1min
```

**Interaction:**
- Slider controls timeline zoom
- "Fit to screen" button resets zoom
- Mouse wheel + modifier to zoom

---

## 4. Interaction Patterns

### 4.1 Import Flow

**MVP Flow:**
```
User clicks [Import] button
    ↓
Native file picker opens
    ↓
User selects MP4/MOV file
    ↓
Video loads into application
    ↓
Clip block appears on timeline
    ↓
Preview player shows first frame
    ↓
Ready for editing
```

**Phase 2 Enhancement:**
```
Drag file from external source
    ↓
Drop zone highlights (blue border)
    ↓
File validated (format, size)
    ↓
Added to Media Library
    ↓
Thumbnail generated
    ↓
Appears in library grid
```

### 4.2 Trim Interaction

**MVP Flow:**
```
User clicks clip on timeline
    ↓
Clip highlights (selected state)
    ↓
Trim handles appear on left/right edges
    ↓
User drags left handle inward
    ↓
Preview updates to show new in-point
    ↓
User drags right handle inward
    ↓
Preview updates to show new out-point
    ↓
Trimmed clip shows reduced duration
```

**Visual Feedback:**
- Trimmed area: Lighter shade or cross-hatch pattern
- Timecode updates on hover over handles
- Preview frame updates on drag

### 4.3 Playback Controls

**Keyboard Shortcuts (MVP):**
- `Spacebar`: Play/Pause
- `←`: Jump back 5 seconds
- `→`: Jump forward 5 seconds
- `↑`: Volume up
- `↓`: Volume down

**Timeline Interactions:**
- Click on timeline: Jump to position
- Drag playhead: Scrub through video
- Click clip: Select and show in preview
- Double-click clip: Jump to clip start

### 4.4 Export Flow

**MVP Flow:**
```
User clicks [Export] button
    ↓
Export modal opens
    ↓
User selects destination location
    ↓
User enters filename
    ↓
User clicks [Export] button
    ↓
Modal shows progress bar
    ↓
FFmpeg processes video (trimming applied)
    ↓
Completion: Checkmark + success message
    ↓
Modal auto-closes after 2 seconds
```

**Phase 2 Enhancement:**
- Resolution selection (720p/1080p/source)
- Quality settings
- Multiple clips stitched together

---

## 5. States and Feedback

### 5.1 Empty States

**No Video Imported:**
```
┌─────────────────────────────────────┐
│                                    │
│          📹                         │
│                                    │
│     No video imported yet           │
│                                    │
│     Click [Import] to get started   │
│                                    │
│     Supported: MP4, MOV             │
│                                    │
└─────────────────────────────────────┘
```

**No Timeline Clips:**
```
Timeline is empty
Add clips from the media library
```

### 5.2 Loading States

**Video Loading:**
```
┌─────────────────────────────────────┐
│                                    │
│          ⏳                         │
│                                    │
│     Loading video...                │
│                                    │
└─────────────────────────────────────┘
```

**Export in Progress:**
```
Exporting... [████████░░] 75%

Please wait while we process your video
```

### 5.3 Error States

**Import Error:**
```
❌ Failed to import video

The file format is not supported or the file is corrupted.

[Try Again] [Cancel]
```

**Export Error:**
```
❌ Export failed

An error occurred while exporting your video.

Error: Invalid trim points

[Retry]
```

### 5.4 Success Feedback

**Export Complete:**
```
✓ Export complete!

Your video has been saved to:
/Users/john/Desktop/my-video.mp4

[Open File] [OK]
```

### 5.5 Hover States

**All Interactive Elements:**
- Buttons: Slight elevation (shadow increase)
- Clips: Slight scale up (1.02)
- Timeline: Background color shift
- Icons: Slight rotation or scale

### 5.6 Active/Selected States

**Clip Selected:**
- Border: 2px solid `--color-playhead`
- Background: `--color-clip-selected`
- Show contextual controls (if applicable)

**Button Pressed:**
- Transform: scale(0.98)
- Shadow: Reduced
- Background: Darker shade

---

## 6. Visual Design Language

### 6.1 Style Principles

1. **Clarity over Decoration**
   - Clean, functional aesthetic
   - No unnecessary visual flourishes
   - Information hierarchy through contrast and spacing

2. **Professional Appearance**
   - Dark theme for reduced eye strain
   - High contrast for readability
   - Consistent rounded corners for modern feel

3. **Responsive Feedback**
   - All interactions provide immediate visual feedback
   - Smooth transitions (200-300ms) for state changes
   - Loading indicators for async operations

### 6.2 Visual Hierarchy

**Priority Order:**
1. **Preview Panel**: Largest, center focus
2. **Toolbar**: Constant, accessible actions
3. **Timeline**: Critical for editing, always visible
4. **Media Library** (Phase 2): Secondary, can be collapsed

**Methods:**
- Size: Larger elements = more important
- Contrast: Darker backgrounds for primary panels
- Color: Primary colors for actions, neutrals for structure
- Position: Top-to-bottom, left-to-right reading flow

### 6.3 Color Usage

**Primary Blue (`--color-primary`):**
- Primary actions (Import, Export, Record)
- Hover states
- Selected elements (clip blocks)

**Accent Red (`--color-playhead`):**
- Playhead indicator
- Critical actions (Delete, Error states)

**Neutral Grays:**
- Backgrounds, structure, borders
- Text in various hierarchies
- Disabled states

### 6.4 Animations

**Timing Functions:**
```css
/* Standard */
transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

/* Smooth entrance */
animation: fadeIn 0.3s ease-out;

/* Staggered (for lists) */
animation-delay: calc(var(--index) * 0.05s);
```

**Avoid:**
- Excessive motion
- Slow animations (>500ms for user-triggered)
- Auto-playing animations

---

## 7. Accessibility Considerations

### 7.1 Keyboard Navigation

**Tab Order:**
1. Toolbar buttons
2. Preview controls
3. Timeline clips
4. Modal elements (when open)

**Custom Shortcuts:**
See Section 4.3 for playback keyboard shortcuts

### 7.2 Focus Indicators

```css
/* Visible focus ring */
*:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

### 7.3 Color Contrast

- Text on background: WCAG AA minimum (4.5:1)
- Interactive elements: High contrast for visibility
- Icons: Minimum 3:1 contrast ratio

### 7.4 Screen Readers

**ARIA Labels (MVP):**
```html
<button aria-label="Import video">Import</button>
<button aria-label="Export video">Export</button>
<div role="region" aria-label="Video preview">...</div>
<div role="region" aria-label="Timeline editor">...</div>
```

---

## 8. Responsive Behavior

### 8.1 Window Resize

**Minimum Size: 1280×720**
- Below this: Show warning or prevent resize
- Timeline collapses first (reduce to 100px)
- Preview scales down while maintaining 16:9

**Above Minimum:**
- Preview expands to fill available space
- Timeline remains comfortable minimum height
- Toolbar adapts (wrap buttons if needed)

### 8.2 Timeline Scrolling

**Horizontal Scroll:**
- Essential when zoomed in or long videos
- Smooth scroll on drag
- Scrollbar styling matches app theme

**Vertical Scroll (Phase 2):**
- Enable when multiple tracks exceed window height
- Snap to track boundaries

### 8.3 Panel Collapse

**Timeline:**
- Collapse button in toolbar or drag handle
- Collapsed: Show icon + "Expand timeline"
- 50px minimum when collapsed

**Media Library (Phase 2):**
- Collapse button in panel header
- Collapses to 0px width
- Click anywhere to re-expand

---

## 9. Implementation Notes

### 9.1 Leptos Component Structure

**Recommended Hierarchy:**

```rust
// Main app structure
fn App() -> impl IntoView {
    view! {
        <EditorLayout>
            <Toolbar />
            <PreviewPanel />
            <Timeline />
        </EditorLayout>
    }
}

// Subcomponents
#[component]
fn VideoPreview(
    src: ReadSignal<String>,
    current_time: ReadSignal<f64>,
    // ... other props
) -> impl IntoView {
    view! {
        <div class="video-preview">
            <video src=move || src.get() />
            <PreviewControls />
        </div>
    }
}
```

### 9.2 State Management

**Global State (Signals):**
- `current_video`: Option<VideoClip>
- `timeline_clips`: Vec<Clip>
- `playback_state`: PlaybackState
- `selection`: Option<ClipId>

**Reactive Updates:**
- Use Leptos `Signal` for reactive UI
- Update preview when timeline changes
- Auto-update playhead position during playback

### 9.3 CSS Organization

```
styles.css
├── Design tokens (--color-*, --spacing-*, etc.)
├── Base styles (typography, reset)
├── Layout (grid, flexbox utilities)
├── Components (buttons, inputs, timeline)
├── Utilities (spacing, shadows, etc.)
└── Theme (dark mode variables)
```

### 9.4 Tauri Integration

**Commands:**
```rust
// Tauri commands in src-tauri/src/lib.rs
#[tauri::command]
async fn import_video(path: String) -> Result<VideoMetadata, String> {
    // Load video, extract metadata
}

#[tauri::command]
async fn export_video(
    input_path: String,
    output_path: String,
    trim_start: Option<f64>,
    trim_end: Option<f64>
) -> Result<(), String> {
    // Use FFmpeg to export
}
```

**Events:**
- Progress updates from FFmpeg
- File system events
- Window state changes

### 9.5 Performance Considerations

**Timeline Rendering:**
- Virtual scrolling for 10+ clips
- Debounce trim handle drag
- Throttle preview frame updates

**Memory Management:**
- Release video resources when not in preview
- Cache thumbnails for Media Library
- Limit video file size warnings

**Export:**
- Show progress from FFmpeg stdout/stderr
- Allow cancellation
- Timeout handling for long exports

---

## 10. User Flows

### 10.1 Complete MVP Workflow

```
1. Launch App
   → Show empty state with import button

2. Import Video
   → Click [Import]
   → Select MP4 file
   → Video loads
   → Clip appears on timeline
   → Preview shows first frame

3. Preview Video
   → Click play button
   → Video plays in preview
   → Click timeline to scrub
   → Audio plays synced

4. Trim Video
   → Click clip on timeline
   → Clip highlights
   → Drag left trim handle
   → Drag right trim handle
   → Preview shows trimmed section

5. Export Video
   → Click [Export]
   → Choose save location
   → Enter filename
   → Click [Export]
   → Progress bar shows
   → Success message
   → File saved

6. Exit App
   → Close window or use Cmd+Q
```

### 10.2 Phase 2 Workflow Extensions

**Multiple Clips:**
```
1. Import multiple videos
2. Drag clips to timeline
3. Arrange in sequence
4. Split clips at playhead
5. Place clips on different tracks
6. Export final composition
```

**Recording Workflow:**
```
1. Click [Record]
2. Select screen/webcam source
3. Configure audio input
4. Start recording
5. Recording indicator shows
6. Stop recording
7. Video appears in Media Library
8. Drag to timeline
9. Edit as normal
```

---

## 11. Testing Scenarios

### 11.1 MVP Test Scenarios

**Scenario 1: Happy Path**
- Import 15-second video
- Preview plays smoothly
- Trim to 10 seconds
- Export successfully
- File size reasonable (<10MB for short clip)

**Scenario 2: Error Handling**
- Import invalid file → Shows error
- Export with no video → Button disabled
- Trim beyond video bounds → Constrains to valid range

**Scenario 3: Performance**
- Import 10 clips on timeline
- UI remains responsive
- Preview maintains 30+ fps
- No memory leaks after 15+ minutes

### 11.2 Phase 2 Test Scenarios

**Scenario 1: Multi-track Editing**
- Import 5 clips
- Arrange on 2 tracks
- Overlay creates PiP effect
- Preview shows composition
- Export renders both tracks

**Scenario 2: Recording**
- Record 30-second screen capture
- Record with webcam overlay
- Export to 1080p
- File opens in external player

---

## 12. Phased Implementation Priority

### Phase 1: MVP (Tue Oct 28 - Hard Deadline)

**Week 1 (Mon-Tue):**
- [ ] Implement design system tokens
- [ ] Build basic layout (toolbar, preview, timeline)
- [ ] Create import drop zone
- [ ] Implement video preview player
- [ ] Build timeline with single clip
- [ ] Add trim handles and interaction
- [ ] Create export modal
- [ ] Integrate FFmpeg for export

**Must Have:**
- Import MP4/MOV
- Basic timeline display
- Video preview
- Trim functionality
- Export single clip
- Package as native app

### Phase 2: Full Features (Wed Oct 29 - Final Deadline)

**Week 1 (Wed):**
- [ ] Add Media Library panel
- [ ] Implement multi-clip timeline
- [ ] Add drag-and-drop to timeline
- [ ] Build split functionality
- [ ] Add multi-track support
- [ ] Implement recording UI
- [ ] Add zoom controls
- [ ] Enhance export with resolution options
- [ ] Polish and package final app

**Nice to Have:**
- Snapping behavior
- Keyboard shortcuts expansion
- Undo/redo (if time permits)

---

## 13. Future Enhancements (Post-Deadline)

**Stretch Goals (Not in current sprint):**
- Effects and transitions UI
- Text overlay editing
- Audio mixing controls
- Keyframe animation
- Cloud export/sharing
- Templates
- Keyboard customization

---

## 14. References

**Inspiration:**
- CapCut mobile/web app
- DaVinci Resolve interface
- Final Cut Pro layout
- Lightworks timeline

**Technical References:**
- Leptos documentation
- Tauri command system
- FFmpeg documentation
- HTML5 video API

---

## 15. Sign-off

**Status:** Ready for Implementation  
**Priority:** Critical for MVP deadline  
**Owner:** Development Team  

**Approvals:**
- [ ] UX approved
- [ ] PM approved
- [ ] Development team reviewed

---

*End of Specification*
