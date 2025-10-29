# Gap Analysis: Stories 2.4 - 2.9

## Overview
Analysis of Stories 2.4-2.9 for gaps, inconsistencies, missing specifications, and integration issues.

---

## Critical Gaps

### 1. Recording Auto-Add Behavior Specification (Stories 2.4, 2.5, 2.6)
**Issue**: All recording stories (2.4, 2.5, 2.6) say "Optionally add to timeline" but don't specify:
- Default behavior (auto-add or manual?)
- Which track to add to (Track 1? first video track? user selection?)
- Position on timeline (end? current playhead? start?)
- Behavior when timeline is empty

**Current Specifications**:
- Story 2.4 Task 7: "Optionally add to timeline (user preference)"
- Story 2.5 Task 8: "Optionally add to timeline (default: add to end of Track 1)"
- Story 2.6 Task 11: "Composited mode: Single clip on Track 1; Separate tracks mode: Screen on Track 1, webcam on Track 2"

**Recommendation**:
- **Decision needed**: Default auto-add behavior
- **Default recommendation**: 
  - Auto-add to end of Track 1 (first video track) by default
  - Add user preference/toggle for auto-add vs. manual add
  - If timeline empty, create Track 1 if needed
  - Add to playhead position only if user explicitly requests

### 2. Recording Format vs. Export Format Consistency (Stories 2.4, 2.5, 2.6 vs 2.7)
**Issue**: 
- Stories 2.4, 2.5, 2.6 mention recording to WebM format (MediaRecorder default)
- Story 2.7 export expects MP4 format
- Import supports MP4, MOV, WebM (Story 2.1)

**Questions**:
- Do recorded WebM files need conversion for export?
- Should recordings be converted to MP4 immediately after recording?
- Or should export handle WebM → MP4 conversion?

**Recommendation**:
- **Option 1**: Record as WebM, convert to MP4 after recording (before auto-import)
- **Option 2**: Record as WebM, keep as WebM, export handles format conversion
- **Default recommendation**: Record as WebM, keep as WebM for editing, export converts if needed (most flexible)

### 3. Audio Track Handling in Multi-Track Export (Story 2.7)
**Issue**: Story 2.7 mentions "Extract audio from base track (Track 0)" but doesn't specify:
- How to handle audio from multiple tracks
- Whether to mix audio from all tracks or use only base track
- Audio track export strategy for multi-track composition

**Current Specification**: "Extract audio from base track (Track 0)" only

**Recommendation**:
- **Decision needed**: Audio mixing strategy for multi-track export
- **Default recommendation**: Extract audio from Track 0 (base track) only for MVP
- Document that multi-track audio mixing is future enhancement
- Or: Mix all audio tracks during export (more complex but better UX)

### 4. Separate Tracks Recording Mode Export (Story 2.6 vs 2.7)
**Issue**: 
- Story 2.6 introduces "separate tracks" recording mode (saves screen and webcam as separate files)
- Story 2.7 handles multi-track export, but assumes clips are already on timeline tracks
- **Gap**: How does Story 2.7 handle exporting timeline when separate-track recordings were used?

**Questions**:
- Are separate-track recordings automatically placed on separate timeline tracks?
- How does export composite separate-track recordings that were manually arranged?
- Does export handle case where user moved separate tracks to different timeline positions?

**Recommendation**:
- Clarify that separate-track recordings auto-add to Track 1 and Track 2 (Story 2.6 Task 11)
- Story 2.7 should handle exported clips regardless of source (recorded vs imported)
- Export logic treats all clips equally (no special handling for recorded clips needed)
- Add note in Story 2.7 that it handles all clip types uniformly

### 5. Recording State Coordination and Mutex (Stories 2.4, 2.5, 2.6)
**Issue**: All three recording stories mention "Cannot start multiple recordings simultaneously" but don't specify:
- How to prevent concurrent recordings across different modes
- What happens if user tries to start screen recording while webcam is recording
- Should there be a global recording state lock?

**Current Specifications**: Each story mentions this independently

**Recommendation**:
- **Decision needed**: Recording mutex implementation
- **Default recommendation**: 
  - Single global recording state (only one recording at a time)
  - Disable all recording UI when any recording is active
  - Show clear message if user tries to start second recording
  - Add this to RecordingService as a shared concern across all recording modes

### 6. Recording File Naming Convention (Stories 2.4, 2.5, 2.6)
**Issue**: Each story specifies different filename formats:
- Story 2.4: `screen-recording-YYYY-MM-DD-HHmmss.webm`
- Story 2.5: `webcam-recording-YYYY-MM-DD-HHmmss.webm`
- Story 2.6: `screen-webcam-YYYY-MM-DD-HHmmss.webm` (composited), or separate files

**Questions**:
- Should there be consistent naming convention?
- How to handle timestamp collisions?
- Should filenames include recording mode indicator?

**Recommendation**:
- Standardize naming: `{mode}-recording-{timestamp}.webm` where mode = screen/webcam/simultaneous
- Add timestamp with milliseconds to prevent collisions
- Document naming convention in one place (architecture or Story 2.4)

### 7. Recording Format Conversion for Import (Stories 2.4, 2.5, 2.6 vs 2.1)
**Issue**: 
- Recordings saved as WebM
- Story 2.1 import supports WebM, so should work
- But need to verify: Do recorded WebM files meet import validation?
- FFmpeg processing expectations for recorded files?

**Recommendation**:
- Verify recorded WebM files pass import validation (should work, but test)
- Ensure fileService.createVideoClip() handles WebM correctly
- Test thumbnail generation for WebM files
- Document that recorded files use same import pipeline

### 8. Export Handling of Split Clips from Recordings (Story 2.7)
**Issue**: Story 2.7 mentions "Handle split clips correctly" but doesn't specify:
- Are split clips handled the same whether from imported or recorded files?
- Any special considerations for recorded clips that were split?

**Recommendation**:
- Export should treat split clips uniformly (no distinction needed)
- Story 2.7 already covers this, but add explicit note that recorded clips work the same as imported

### 9. Recording UI Integration Location (Stories 2.4, 2.5, 2.6)
**Issue**: All stories mention adding recording buttons to MediaLibrary or App.tsx, but don't specify:
- Where exactly should recording controls appear?
- Should there be a unified recording entry point or separate buttons?
- How to organize three recording modes (Screen, Webcam, Simultaneous)?

**Recommendation**:
- **Decision needed**: UI organization for recording controls
- **Default recommendation**:
  - Add "Record" button in MediaLibrary or main toolbar
  - Click opens RecordingDialog with mode selection (Screen/Webcam/Simultaneous)
  - Or: Three separate buttons (Record Screen, Record Webcam, Record Both)
  - Document decision in Story 2.4 and reference in 2.5, 2.6

### 10. Timeline Initialization for Recorded Clips (Stories 2.4, 2.5, 2.6 vs 2.3)
**Issue**: Recording stories assume timeline exists, but:
- Story 2.3 initializes 2+ tracks by default
- Recording auto-add needs to work with this
- What if user hasn't created any tracks yet?

**Current Code**: Timeline.tsx creates Track 1 if none exist (Story 2.1 context)

**Recommendation**:
- Ensure timeline initialization handles empty timeline case
- Auto-add should create Track 1 if needed (already handled in code)
- Add note in recording stories that timeline initialization is handled

### 11. Export Audio Source Selection (Story 2.7)
**Issue**: Story 2.7 says "Extract audio from base track (Track 0)" but doesn't address:
- What if Track 0 has no audio (video-only clip)?
- What if multiple tracks have audio - should they be mixed?
- What if user wants to export without audio?

**Recommendation**:
- **Decision needed**: Multi-track audio export strategy
- **Default recommendation**: 
  - Extract audio from Track 0 (base track)
  - If Track 0 has no audio, try next track
  - Document limitation: Only one audio track exported in MVP
  - Future: Add audio mixing options

### 12. Recording Preview Integration (Stories 2.4, 2.5, 2.6 vs 2.3)
**Issue**: 
- Story 2.3 implements multi-track preview composition
- Recording previews (webcam, screen) are shown in RecordingDialog
- **Gap**: Should recording previews use the same VideoPlayer component, or separate preview?

**Recommendation**:
- RecordingDialog uses its own preview (simpler, doesn't interfere with timeline preview)
- Separate preview in dialog is fine for MVP
- No integration needed - recording preview is independent

### 13. Export of Timeline with Recorded Clips (Story 2.7)
**Issue**: Story 2.7 handles multi-track export, but doesn't explicitly verify:
- Can export handle recorded WebM files the same as imported MP4/MOV files?
- Are recorded clips processed correctly in FFmpeg export pipeline?

**Recommendation**:
- Export should handle all formats uniformly (FFmpeg supports WebM, MP4, MOV)
- Add test case in Story 2.7: "Export with recorded clips works correctly"
- Verify FFmpeg can process WebM input files

### 14. Recording Error Recovery (Stories 2.4, 2.5, 2.6)
**Issue**: Stories mention error handling but don't specify:
- What happens to partial recordings if recording fails mid-way?
- Should partial files be cleaned up automatically?
- Should user be notified of cleanup?

**Recommendation**:
- Clean up partial recordings on error
- Show clear error message
- Document cleanup behavior in all recording stories

### 15. Export Performance with Recorded Files (Story 2.7)
**Issue**: Story 2.7 optimizes export performance, but doesn't address:
- Are recorded WebM files processed differently than imported MP4?
- Any performance implications of mixing recorded and imported clips?

**Recommendation**:
- FFmpeg handles all formats efficiently
- No special optimization needed
- Ensure format conversion doesn't slow export

---

## Inconsistencies

### 16. Recording Dialog Consolidation (Stories 2.4, 2.5, 2.6)
**Issue**: 
- Story 2.4 creates RecordingDialog
- Story 2.5 says "Extend RecordingDialog or create WebcamRecordingDialog"
- Story 2.6 says "Extend RecordingDialog to support simultaneous mode"
- **Potential conflict**: Should there be one unified dialog or separate dialogs?

**Recommendation**:
- **Decision needed**: Dialog architecture
- **Default recommendation**: One unified RecordingDialog with mode tabs/sections
- Stories 2.5 and 2.6 should extend the same dialog from Story 2.4
- Document decision in Story 2.4, reference in 2.5 and 2.6

### 17. Recording Service Architecture (Stories 2.4, 2.5, 2.6)
**Issue**:
- Story 2.4 creates RecordingService with screen recording
- Story 2.5 says "Extend RecordingService"
- Story 2.6 says "Extend RecordingService for simultaneous recording"
- **Question**: Should all recording modes share one service or be separate?

**Recommendation**:
- One unified RecordingService handling all modes
- Mode is a parameter, not separate services
- Document in Story 2.4 that service will be extended

### 18. Audio Source Priority in Simultaneous Recording (Story 2.6)
**Issue**: Story 2.6 mentions "system audio + microphone audio mixing" but doesn't specify:
- What if only system audio is available?
- What if only microphone is available?
- What if user selects "system audio only"?
- Priority/precedence rules?

**Recommendation**:
- Clarify audio source selection logic
- Document user choices: System only, Mic only, Both (mixed), None
- Handle all combinations explicitly

---

## Missing Specifications

### 19. Recording During Editing Session (Stories 2.4, 2.5, 2.6)
**Issue**: Stories don't specify what happens if user tries to record while:
- Editing timeline
- Preview is playing
- Export is in progress
- Importing files

**Recommendation**:
- Allow recording during editing (enable true workflow)
- Pause preview if recording starts (optional UX enhancement)
- Prevent recording during export (mutex)
- Allow recording during import (independent operations)

### 20. Export Cancellation (Story 2.7)
**Issue**: Story 2.7 mentions "Handle export cancellation" but doesn't specify:
- How to cancel FFmpeg process mid-export
- Cleanup of partial export files
- State recovery after cancellation

**Recommendation**:
- Implement export cancellation using FFmpeg process kill
- Clean up temporary files on cancellation
- Update UI state correctly after cancellation
- Add to Story 2.7 Task 7 or 11

### 21. Recording Duration Limits (Stories 2.4, 2.5, 2.6)
**Issue**: Stories mention performance considerations but don't specify:
- Maximum recording duration (if any)
- Warnings for long recordings (disk space, memory)
- Handling very long recordings (>1 hour)

**Recommendation**:
- No hard limit for MVP (rely on disk space)
- Optional: Show disk space estimate before recording
- Optional: Warning for recordings >30 minutes
- Document as optional enhancement

### 22. Export Progress Granularity (Story 2.7)
**Issue**: Story 2.7 mentions progress messages but doesn't specify:
- How frequently to update progress (per clip? per second?)
- Progress message format/level of detail
- Error recovery during multi-stage export

**Recommendation**:
- Update progress per FFmpeg progress callback (typically per second)
- Show stage: "Processing clips", "Compositing tracks", "Finalizing"
- Include clip count: "Processing clip 3/10"
- Handle partial completion gracefully

---

## Integration Gaps

### 23. Recording → Timeline → Export Workflow
**Issue**: End-to-end workflow not fully specified:
- Record → Auto-add to timeline → Edit → Export
- What if user records, doesn't auto-add, then exports empty timeline?
- Validation should prevent exporting empty timeline (Story 2.7 covers this)

**Recommendation**:
- Story 2.7 Task 9 already covers timeline validation
- Add explicit check: "Export button disabled if timeline empty"
- Or show clear error: "Timeline is empty. Add clips before exporting."

### 24. Multi-Track Preview with Recorded Clips (Story 2.3 vs 2.4-2.6)
**Issue**: 
- Story 2.3 implements multi-track preview composition
- Recorded clips can be on different tracks (Story 2.6 separate tracks mode)
- **Question**: Does Story 2.3's preview handle recorded clips correctly?

**Recommendation**:
- Preview should treat all clips uniformly (no distinction needed)
- Story 2.3 already handles this correctly
- Add note: "Preview works with both imported and recorded clips"

### 25. Recording Permissions Coordination (Stories 2.4, 2.5, 2.6)
**Issue**: Multiple permission types needed:
- Screen recording permission (macOS)
- Camera permission
- Microphone permission
- **Question**: Should permissions be requested upfront or on-demand?

**Recommendation**:
- Request permissions on-demand (when user opens recording dialog)
- Cache permission state to avoid repeated prompts
- Show clear permission guidance in dialog
- Document permission flow in all recording stories

### 26. Export with Mixed Format Clips (Story 2.7)
**Issue**: Timeline may contain:
- Imported MP4/MOV clips
- Recorded WebM clips
- **Question**: Does export handle mixed formats correctly?

**Recommendation**:
- FFmpeg handles format conversion automatically
- Export should process all formats uniformly
- Add test case: "Export with mixed format clips (MP4 + WebM)"
- Add to Story 2.7 Task 12

---

## Missing Test Cases

### 27. Cross-Story Integration Tests
**Missing test scenarios**:
- Record screen → Import files → Arrange on multi-track → Split recorded clip → Export
- Record webcam → Record screen separately → Place both on timeline → Overlay → Export
- Record simultaneous → Separate tracks mode → Edit on timeline → Export composited
- Mixed formats: Imported MP4 + Recorded WebM on same timeline → Export

**Recommendation**: Add integration test section to Story 2.9 or create separate test plan

### 28. Performance with Recorded Clips
**Issue**: Performance testing doesn't specifically address:
- Timeline responsiveness with 10+ recorded clips
- Export performance with recorded clips vs imported clips
- Memory usage with multiple large recorded files

**Recommendation**: Add to Story 2.9 performance testing

---

## Recommendations Summary

### High Priority (Must Fix)
1. **Specify recording auto-add default behavior** (Stories 2.4, 2.5, 2.6)
2. **Clarify recording format handling** (WebM recording, MP4 export compatibility)
3. **Specify audio export strategy** for multi-track (Story 2.7)
4. **Define recording state mutex** across all modes (Stories 2.4, 2.5, 2.6)

### Medium Priority (Should Fix)
5. **Standardize recording filename convention** (Stories 2.4, 2.5, 2.6)
6. **Clarify recording dialog architecture** (one dialog vs multiple)
7. **Specify audio source priority rules** (Story 2.6)
8. **Add export cancellation implementation** (Story 2.7)
9. **Add mixed format export test** (Story 2.7)

### Low Priority (Nice to Have)
10. **Add recording duration warnings** (optional enhancement)
11. **Document recording UI integration** (where controls appear)
12. **Add cross-story integration tests** (Story 2.9)

---

## Suggested Updates to Stories

### Story 2.4 Updates Needed:
- Specify default auto-add behavior (add to end of Track 1)
- Document unified RecordingDialog architecture (will be extended)
- Add recording state mutex note

### Story 2.5 Updates Needed:
- Reference unified RecordingDialog approach
- Clarify auto-add defaults match Story 2.4
- Note recording mutex from Story 2.4

### Story 2.6 Updates Needed:
- Reference unified RecordingDialog approach
- Clarify auto-add for separate tracks mode (matches Task 11)
- Add audio source priority specification
- Note recording mutex coordination

### Story 2.7 Updates Needed:
- Add note that export handles all formats uniformly (WebM, MP4, MOV)
- Specify audio extraction strategy more clearly
- Add test case for mixed format clips
- Add export cancellation implementation details

### Story 2.9 Updates Needed:
- Add cross-story integration test cases
- Add performance testing with recorded clips
- Verify recorded clips work in all export scenarios

---

*Analysis completed: 2025-01-27*
*Reviewed by: Scrum Master Bob*

