# ClipForge Product Requirements Document (PRD)

## Goals and Background Context

### Goals
* Deliver a functional MVP (basic import, timeline, preview, trim, export, packaged app) by Tuesday, October 28th at 10:59 PM CT.
* Ship a production-grade desktop video editor (including recording, full timeline editing) by Wednesday, October 29th at 10:59 PM CT.
* Provide an intuitive, streamlined desktop video editing experience inspired by CapCut.
* Enable creators, educators, and professionals to quickly record, edit, and export videos without complex software.
* Meet specific performance targets for UI responsiveness, playback smoothness, and export reliability.

### Background Context
Current desktop video editing often involves complex software with steep learning curves. CapCut proved a simplified, mobile-first approach could make editing accessible. This project aims to bring that streamlined, intuitive experience to a native desktop application, allowing users to handle the entire workflow (recording, importing, arranging, exporting) in one place, optimized for speed and essential features under an extremely tight 72-hour deadline.

### Change Log
| Date       | Version | Description              | Author   |
| :--------- | :------ | :----------------------- | :------- |
| 2025-10-27 | 1.0     | Initial PRD draft (YOLO) | PM John  |

---

## Requirements

### Functional
* **FR1**: The application MUST build and package into a runnable native desktop application (Electron or Tauri). (MVP)
* **FR2**: Users MUST be able to import video files (MP4, MOV initially) into the application via drag & drop or a file picker. (MVP)
* **FR3**: Imported video clips MUST be visually represented on a timeline interface. (MVP)
* **FR4**: Users MUST be able to preview imported video clips within the application. (MVP)
* **FR5**: Users MUST be able to set in and out points (basic trim) on a single imported clip. (MVP)
* **FR6**: Users MUST be able to export a single clip (potentially trimmed) to an MP4 file. (MVP)
* **FR7**: Users MUST be able to record their screen (full screen or selected window). (Phase 2)
* **FR8**: Users MUST be able to record video from their webcam. (Phase 2)
* **FR9**: Users MUST be able to record screen and webcam simultaneously (Picture-in-Picture style). (Phase 2)
* **FR10**: Users MUST be able to capture audio from a microphone during recording. (Phase 2)
* **FR11**: Users MUST be able to start and stop recordings. (Phase 2)
* **FR12**: Completed recordings MUST be automatically added to the timeline or media library. (Phase 2)
* **FR13**: Users MUST be able to import WebM video files. (Phase 2)
* **FR14**: The application SHOULD provide a media library panel showing imported clips with thumbnails and basic metadata (duration, resolution). (Phase 2)
* **FR15**: Users MUST be able to drag clips onto the timeline. (Phase 2)
* **FR16**: Users MUST be able to arrange clips sequentially on the timeline. (Phase 2)
* **FR17**: Users MUST be able to split a clip at the current playhead position. (Phase 2)
* **FR18**: Users MUST be able to delete clips from the timeline. (Phase 2)
* **FR19**: The timeline MUST support at least two tracks (e.g., main video + overlay/PiP). (Phase 2)
* **FR20**: Users SHOULD be able to zoom in and out on the timeline. (Phase 2)
* **FR21**: Clips on the timeline SHOULD snap to edges or a grid for easier alignment. (Phase 2)
* **FR22**: The preview window MUST show a real-time composition of the clips on the timeline at the playhead position. (Phase 2)
* **FR23**: Users MUST have play/pause controls for the preview. (Phase 2)
* **FR24**: Users MUST be able to scrub the playhead along the timeline to preview specific frames. (Phase 2)
* **FR25**: Audio playback MUST be synchronized with the video preview. (Phase 2)
* **FR26**: Users MUST be able to export the entire timeline composition (multiple clips) to an MP4 file. (Phase 2)
* **FR27**: Users MUST be able to select export resolution (at least 720p, 1080p, or source resolution). (Phase 2)
* **FR28**: The application MUST display a progress indicator during export. (Phase 2)
* **FR29**: Users MUST be able to choose the save location for exported files. (Phase 2)

### Non Functional
* **NFR1**: The timeline UI MUST remain responsive even with 10+ clips loaded.
* **NFR2**: Video preview playback MUST be smooth (minimum 30 fps target).
* **NFR3**: The export process MUST complete without crashing.
* **NFR4**: Application launch time SHOULD be under 5 seconds.
* **NFR5**: The application MUST NOT exhibit memory leaks during extended editing sessions (tested for 15+ minutes).
* **NFR6**: Exported video file sizes MUST be reasonable for their resolution/duration, avoiding unnecessary bloat.
* **NFR7**: The application MUST function correctly on target desktop OS (Mac/Windows where possible).
* **NFR8**: The user interface SHOULD be intuitive and easy to learn, inspired by CapCut's model.

---

## User Interface Design Goals

### Overall UX Vision
To provide a simple, intuitive, and efficient desktop video editing experience focused on the core workflow of recording, importing, arranging, and exporting. The UI should feel native to the desktop while borrowing the streamlined accessibility of tools like CapCut.

### Key Interaction Paradigms
* Direct manipulation timeline (drag & drop, click & drag to trim/move).
* Visual preview synchronized with a timeline playhead.
* Clear modes/buttons for Record, Import, Export actions.
* Contextual controls appearing on selected clips/timeline elements.

### Core Screens and Views
* **Main Editor View**: Containing Media Library (Phase 2), Preview Player, and Timeline Editor.
* **Recording Setup**: Interface for selecting screen/window/webcam source and audio input before recording (Phase 2).
* **Export Settings**: Modal or panel for choosing resolution and output location (MVP basic, Phase 2 advanced).
* **File Picker**: Native OS file picker for import.

### Accessibility: None
* (Assumption: Accessibility is out of scope for the 72hr sprint, can be added later).

### Branding
* TBD - Focus on clean, functional native-like UI first.

### Target Device and Platforms: Web Responsive
* (Note: "Web Responsive" applied to Desktop context means resizable windows and adapting layout). Primarily Mac/Windows.

---

## Technical Assumptions

### Repository Structure: Monorepo
* (Assumption: A monorepo might be efficient for managing the shared logic (e.g., FFmpeg interaction) and the Electron/Tauri shell + frontend UI code, given the short timeframe).

### Service Architecture
* Monolithic Desktop Application: All functionality contained within the single packaged app. No external backend services required for core features.

### Testing Requirements
* Focus on manual testing for core workflows due to time constraints.
* Automated tests (unit/integration) are desirable but likely a stretch goal. Aim for basic stability checks if time permits.

### Additional Technical Assumptions and Requests
* FFmpeg is available and can be bundled/accessed reliably by the chosen framework (Electron/Tauri).
* Platform APIs for screen/webcam capture are accessible and performant enough for simultaneous recording.
* Chosen frontend framework is suitable for building a responsive timeline UI.

---

## Epic List

Given the extremely tight deadline and the hard MVP gate, the epics focus on delivering demonstrable value quickly.

* **Epic 1**: MVP Core Media Pipeline (Deadline: Tue Oct 28th, 10:59 PM CT)
    * Goal: Establish the fundamental ability to import, display, preview, trim (single clip), export (single clip), and package the desktop app.
* **Epic 2**: Recording & Full Timeline Editing (Deadline: Wed Oct 29th, 10:59 PM CT)
    * Goal: Implement native recording features (screen, webcam, audio, PiP) and the full timeline editing capabilities (multi-clip arrange, split, delete, multi-track, export composition).

---

## Epic 1 MVP Core Media Pipeline

**Epic Goal**: Establish the fundamental ability to import, display, preview, trim (single clip), export (single clip), and package the desktop app by the Tuesday deadline. This proves the core technical challenge of handling media within the chosen desktop framework.

### Story 1.1 Setup Project & Basic Window
As a developer, I want to set up the initial Electron/Tauri project structure with a basic application window, so that I have a foundation to build upon.
#### Acceptance Criteria
1.  Project structure (Electron or Tauri) is created.
2.  Dependencies for the chosen framework are installed.
3.  A basic, empty main application window launches successfully.
4.  Basic build/packaging script is functional, producing a runnable app.

### Story 1.2 Implement Basic Video Import
As a user, I want to import an MP4 or MOV video file into the application, so that I can begin editing it.
#### Acceptance Criteria
1.  Application allows importing MP4/MOV via a native file picker.
2.  (Stretch for MVP) Application allows importing MP4/MOV via drag and drop onto a designated area.
3.  Successfully imported video file information (e.g., path, basic metadata if easily available) is stored internally.
4.  No crashes occur with valid MP4/MOV files.

### Story 1.3 Display Clip on Simple Timeline
As a user, I want to see my imported video clip represented visually on a simple timeline, so that I have a context for editing.
#### Acceptance Criteria
1.  After import, a visual block representing the video clip appears on a timeline UI element.
2.  The length of the block visually corresponds (approximately) to the clip's duration.
3.  The timeline displays at least one track.

### Story 1.4 Implement Video Preview Player
As a user, I want to play back the imported video clip in a preview window, so that I can see its content.
#### Acceptance Criteria
1.  A video player element is present in the UI.
2.  Selecting or loading the clip on the timeline loads it into the preview player.
3.  The preview player can play and pause the selected video clip.
4.  Audio plays back synchronized with the video (if available in the clip).

### Story 1.5 Implement Basic Trim Functionality
As a user, I want to define start and end points for a single clip on the timeline, so that I can select a portion of the video.
#### Acceptance Criteria
1.  User can interact with the clip representation on the timeline (e.g., dragging handles, entering timecodes) to set an in-point.
2.  User can interact with the clip representation on the timeline to set an out-point.
3.  The preview player respects the set in/out points during playback (plays only the selected portion).
4.  The visual representation on the timeline updates to indicate the trimmed section.

### Story 1.6 Implement Basic Single-Clip Export
As a user, I want to export the currently selected (and potentially trimmed) video clip to an MP4 file, so that I have a usable output.
#### Acceptance Criteria
1.  An "Export" button or menu option is available.
2.  Activating export prompts the user to choose a save location and filename.
3.  The application uses FFmpeg (or chosen library) to process the selected clip, applying the trim (in/out points).
4.  An MP4 file is successfully created at the specified location.
5.  The exported MP4 file contains only the selected (trimmed) portion of the video and corresponding audio.
6.  The export process provides some basic feedback (start/end, success/failure).

### Story 1.7 Build and Package MVP Application
As a developer, I want to build and package the application into a distributable native format, so that the MVP can be submitted and tested as a real desktop app.
#### Acceptance Criteria
1.  Build scripts are configured for the chosen framework (Electron/Tauri).
2.  A successful build produces native installers/packages (e.g., .dmg, .exe, .AppImage).
3.  The packaged application launches and runs correctly, demonstrating all MVP features (Import, Timeline Display, Preview, Trim, Export).
4.  The application meets the MVP deadline (Tue Oct 28th, 10:59 PM CT).

---

## Epic 2 Recording & Full Timeline Editing

**Epic Goal**: Implement native recording features (screen, webcam, audio, PiP) and the full timeline editing capabilities (multi-clip arrange, split, delete, multi-track, export composition) by the Wednesday deadline.

*(Note: Stories below assume MVP completion. Sequence prioritizes core editing over recording, but flexibility needed based on dev progress)*

### Story 2.1 Implement Multi-Clip Import & Timeline Arrangement
As a user, I want to import multiple clips and arrange them sequentially on the timeline, so that I can build a basic video sequence.
#### Acceptance Criteria
1.  Multiple clips (MP4, MOV, WebM) can be imported [FR13].
2.  Clips can be dragged from a source (Media Library or directly after import) onto the timeline [FR15].
3.  Clips can be reordered by dragging them on the timeline track [FR16].
4.  Clips play back sequentially in the preview window based on their timeline order [FR22].

### Story 2.2 Implement Split and Delete Clip Functionality
As a user, I want to split a clip at the playhead and delete clips from the timeline, so that I have more precise editing control.
#### Acceptance Criteria
1.  A "Split" action is available that divides the selected clip at the current playhead position into two independent clips [FR17].
2.  A "Delete" action is available that removes the selected clip(s) from the timeline [FR18].
3.  The preview updates correctly reflect splits and deletions [FR22].

### Story 2.3 Implement Multiple Timeline Tracks
As a user, I want to place clips on at least two different tracks, so that I can create overlays or Picture-in-Picture effects.
#### Acceptance Criteria
1.  The timeline interface displays at least two distinct video tracks [FR19].
2.  Users can drag clips onto either track.
3.  The preview window correctly composites video from multiple tracks (e.g., top track overlays bottom track) [FR22].

### Story 2.4 Implement Screen Recording
As a user, I want to record my computer screen (full screen or a specific window), so that I can capture software demonstrations or presentations.
#### Acceptance Criteria
1.  User can initiate screen recording from the application [FR7].
2.  User can choose between recording the full screen or selecting a specific application window [FR7].
3.  Recording includes system audio (if technically feasible and configured).
4.  User can stop the recording [FR11].
5.  The resulting video file is saved and added to the media library/timeline [FR12].

### Story 2.5 Implement Webcam and Audio Recording
As a user, I want to record video from my webcam and audio from my microphone, so that I can capture direct-to-camera footage or voiceovers.
#### Acceptance Criteria
1.  User can select an available webcam and initiate recording [FR8].
2.  User can select an available microphone and capture audio during webcam or screen recording [FR10].
3.  User can stop the recording [FR11].
4.  The resulting video/audio files are saved and added to the media library/timeline [FR12].

### Story 2.6 Implement Simultaneous Screen + Webcam Recording
As a user, I want to record my screen and webcam at the same time, with the webcam appearing as a Picture-in-Picture overlay, so that I can create engaging tutorials or presentations.
#### Acceptance Criteria
1.  User can select both a screen/window source and a webcam source for simultaneous recording [FR9].
2.  The recording captures both sources concurrently.
3.  The resulting output places the webcam feed as a configurable PiP element over the screen recording (or saves as separate tracks for editing) [FR9].
4.  Audio is captured correctly during simultaneous recording [FR10].
5.  Recording can be stopped, saved, and added to the project [FR11, FR12].

### Story 2.7 Implement Full Timeline Export
As a user, I want to export the entire sequence of clips arranged on the timeline, including cuts and overlays, into a single MP4 file, so that I can share my final video.
#### Acceptance Criteria
1.  The export function processes all clips on the timeline in their arranged sequence [FR26].
2.  Trims, splits, and deletions applied on the timeline are reflected in the output [FR26].
3.  Video from multiple tracks is correctly composited in the output [FR19, FR26].
4.  Users can select the export resolution (720p, 1080p, source) [FR27].
5.  A progress indicator is shown during export [FR28].
6.  The final MP4 is saved to the user's chosen location [FR29].

### Story 2.8 Enhance Timeline Usability (Zoom/Snap)
As a user, I want to zoom in/out on the timeline and have clips snap to edges, so that I can perform more precise edits efficiently.
#### Acceptance Criteria
1.  Controls (e.g., slider, buttons, shortcuts) allow zooming the timeline view horizontally [FR20].
2.  When dragging clips, their edges automatically align (snap) with the edges of adjacent clips or the playhead [FR21].

### Story 2.9 Final Polish & Packaging
As a developer, I want to ensure all core features are working, performance targets are reasonably met, and the final application is packaged correctly for submission.
#### Acceptance Criteria
1.  All core features (recording, import, timeline editing, preview, export) are functional.
2.  Performance meets targets (responsive UI, smooth preview, stable export) [NFR1-NFR6].
3.  Key testing scenarios are passed.
4.  Final application is built and packaged for submission by Wed Oct 29th, 10:59 PM CT.

---

## Checklist Results Report
_(To be populated after PM checklist execution)_

---

## Next Steps

### UX Expert Prompt
_(Placeholder: Prompt for UX Expert based on UI Goals section)_

### Architect Prompt
This PRD, along with the Project Brief, defines the requirements for ClipForge. Please create the Fullstack Architecture document (`fullstack-architecture-tmpl.yaml`), focusing on the chosen desktop framework (Electron/Tauri), FFmpeg integration for media processing, the timeline UI component, preview player, and the recording/export pipelines. Pay close attention to the tight deadline and MVP requirements, prioritizing a solid foundation for the core media workflow.