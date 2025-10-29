# Gap Analysis: Stories 2.1 - 2.4

## Overview
Analysis of Stories 2.1-2.4 for gaps, inconsistencies, missing specifications, and integration issues.

---

## Critical Gaps

### 1. Gap Handling Strategy (Story 2.2)
**Issue**: Story 2.2 Task 4 mentions "Handle timeline gaps created by deletions (adjust subsequent clips or leave gaps)" but doesn't specify which strategy to use.

**Current Code Behavior**: The `reorderClip` function in timelineStore.ts automatically closes gaps by repositioning clips sequentially (lines 435-446). However, delete operations may leave gaps.

**Recommendation**: 
- **Decision needed**: Should deletions leave gaps or close gaps automatically?
- **If close gaps**: Add task to reposition subsequent clips after deletion
- **If leave gaps**: Add task to handle gap display and preview behavior during gaps
- **Default recommendation**: Close gaps automatically to maintain sequential playback (consistent with reorder behavior)

### 2. Overlapping Clips on Same Track (Story 2.1 & 2.3)
**Issue**: 
- Story 2.1 mentions "Handle edge cases (overlapping clips, out of bounds)" but doesn't specify if overlaps should be prevented or allowed
- Story 2.3 states "Clips on different tracks can overlap in time" but doesn't clarify same-track overlap policy

**Current Code Behavior**: The `reorderClip` function prevents overlaps by automatically repositioning clips sequentially.

**Recommendation**:
- **Decision needed**: Allow overlaps on same track or prevent them?
- **Default recommendation**: Prevent overlaps on same track (enforce sequential ordering), allow overlaps across different tracks
- Add validation in Story 2.1 Task 3 to prevent overlapping clips on same track
- Add clear error feedback if user tries to create overlap

### 3. Multi-Track Preview Composition Timing (Story 2.1 vs 2.3)
**Issue**: 
- Story 2.1 Task 5 implements "Sequential Playback Preview" - only handles single-track sequential playback
- Story 2.3 Task 5-6 implements "Multi-Track Preview Composition" - handles multi-track compositing
- **Gap**: Story 2.1's VideoPlayer updates may conflict or need to be reconsidered when Story 2.3 implements composition

**Current Code Behavior**: VideoPlayer currently finds a single active clip across all tracks (flatMap), but doesn't composite multiple clips.

**Recommendation**:
- Story 2.1 should focus on sequential playback for single track only
- Story 2.3 should completely replace/override preview logic for multi-track scenarios
- Or: Story 2.1 should be aware of multi-track and handle "single track" as subset of multi-track
- **Action**: Clarify in Story 2.1 that multi-track composition is deferred to Story 2.3

### 4. Split/Delete Operations Across Tracks (Story 2.2)
**Issue**: Story 2.2 doesn't mention behavior when split/delete operations involve clips on different tracks.

**Questions**:
- Can you split a clip that's on Track 2? (Should work, but not specified)
- If you delete a clip from Track 1, does it affect Track 2? (No, but not explicit)
- Multi-select across tracks for deletion? (Task 3 mentions multi-select but not cross-track)

**Recommendation**:
- Add explicit note that split/delete work independently per track
- Clarify multi-select can work across tracks
- Add test cases for cross-track operations

### 5. Recording Auto-Add to Timeline (Story 2.4)
**Issue**: Story 2.4 Task 7 says "Optionally add to timeline (user preference)" but doesn't specify:
- Where in timeline (end? current playhead position?)
- Which track to add to (Track 1? user selection?)
- What if timeline is empty?

**Recommendation**:
- **Decision needed**: Default behavior for recorded clips
- **Default recommendation**: Add to end of Track 1 (first video track), user can move/delete later
- Add UI option/preference for auto-add vs. manual add
- Specify behavior for empty timeline (create track if needed)

---

## Inconsistencies

### 6. Track Initialization Timing (Story 2.1 vs 2.3)
**Issue**: 
- Story 2.1 doesn't mention track initialization (assumes tracks exist)
- Story 2.3 Task 1 initializes multiple tracks
- **Potential conflict**: Story 2.1 may run before Story 2.3, so tracks may not exist

**Current Code Behavior**: Timeline.tsx creates single track if none exist (lines 72-88).

**Recommendation**:
- Story 2.1 should handle track creation if none exist (already handled in code)
- Story 2.3 should upgrade single track to multiple tracks
- Or document story dependency explicitly

### 7. Drag & Drop Target Track Calculation (Story 2.1 vs 2.3)
**Issue**:
- Story 2.1 Task 3 mentions "drop zones on TimelineTrack" but doesn't specify track targeting
- Story 2.3 Task 3 specifies "Calculate which track is targeted during drag operation"
- **Potential overlap/conflict** in implementation

**Current Code Behavior**: Timeline.tsx handleDrop always adds to first track (line 180).

**Recommendation**:
- Story 2.1 can add to first/default track
- Story 2.3 should enhance to calculate specific track from mouse position
- Document that Story 2.3 extends Story 2.1's drag & drop

---

## Missing Specifications

### 8. Clip Position After Split (Story 2.2)
**Issue**: Story 2.2 doesn't specify what happens to timeline position when clip is split:
- Do both halves maintain original position (first half keeps startTime, second half starts at split)?
- Or does second half move to end of timeline?

**Recommendation**: 
- Both halves should maintain timeline continuity (first half: 0-15s, second half: 15-30s, assuming split at 15s)
- Specify in Task 2 calculation logic

### 9. Track Selection for Drag & Drop (Story 2.3)
**Issue**: Story 2.3 Task 3 says "Calculate which track is targeted" but doesn't specify:
- Visual feedback during drag (highlight target track)
- What if user drags between tracks (snap to nearest?)
- Can clips be dragged to empty area (create new track or reject?)

**Recommendation**:
- Add visual feedback (highlight target track during drag)
- Snap to nearest track within threshold
- Reject drops outside track bounds

### 10. Recording File Format Consistency (Story 2.4)
**Issue**: Story 2.4 mentions WebM format but Story 2.1 adds WebM import support. Need to ensure:
- Recorded WebM files are compatible with import
- Export may need format conversion (addressed in Story 2.7, but dependencies)

**Recommendation**:
- Ensure recording format matches import support (WebM for recording, MP4/MOV/WebM for import)
- Document format considerations

### 11. Error Handling for Recording During Editing (Story 2.4)
**Issue**: Story 2.4 doesn't specify what happens if:
- User starts recording while editing timeline
- Preview is playing during recording start
- Timeline operations during recording

**Recommendation**:
- Add validation: Prevent timeline edits during recording (optional, or allow)
- Pause preview if recording starts
- Show clear status indicator

---

## Integration Gaps

### 12. Preview Update Dependencies
**Issue**: Multiple stories update VideoPlayer:
- Story 2.1: Sequential playback
- Story 2.2: Split/delete handling
- Story 2.3: Multi-track composition
- **Potential conflicts or need for coordination**

**Recommendation**:
- Document preview update priority/order
- Ensure each story's changes are additive/compatible
- Consider refactoring preview logic into composable functions

### 13. State Management Consistency
**Issue**: Multiple stores may need coordination:
- TimelineStore: Timeline state
- ProjectStore: Clip data
- PreviewStore: Preview state
- New RecordingState? (Story 2.4)

**Recommendation**:
- Ensure state updates are synchronized
- Document state dependencies
- Add error handling for state inconsistencies

### 14. Media Library Integration (Story 2.1 & 2.4)
**Issue**: 
- Story 2.1 enhances Media Library display
- Story 2.4 adds recorded clips to media library
- Need to ensure recorded clips appear correctly with metadata

**Recommendation**:
- Verify thumbnail generation for recorded clips
- Ensure recorded clips show correct metadata (duration, resolution)
- Test Media Library display with mix of imported and recorded clips

---

## Missing Test Cases

### 15. Cross-Story Integration Tests
**Missing test scenarios**:
- Import multiple clips + record screen + arrange on multi-track + split/delete
- Record → import → add to timeline → split → delete → reorder
- Multi-track with recorded clips overlaying imported clips

**Recommendation**: Add integration test section to Story 2.9 or create separate test plan

---

## Recommendations Summary

### High Priority (Must Fix)
1. **Specify gap handling strategy** for deletions (Story 2.2)
2. **Specify overlap policy** for same-track clips (Story 2.1)
3. **Clarify recording auto-add behavior** to timeline (Story 2.4)
4. **Resolve preview composition timing** (Story 2.1 vs 2.3)

### Medium Priority (Should Fix)
5. **Clarify split/delete cross-track behavior** (Story 2.2)
6. **Specify track initialization dependencies** (Story 2.1 vs 2.3)
7. **Add drag & drop visual feedback** (Story 2.3)
8. **Specify clip position after split** (Story 2.2)

### Low Priority (Nice to Have)
9. **Add recording format consistency checks** (Story 2.4)
10. **Document preview update order** (all stories)
11. **Add cross-story integration tests** (Story 2.9)

---

## Suggested Updates to Stories

### Story 2.1 Updates Needed:
- Add note that multi-track composition deferred to Story 2.3
- Specify overlap prevention on same track
- Clarify track initialization handling

### Story 2.2 Updates Needed:
- Specify gap handling strategy (recommend: close gaps)
- Specify clip position after split (maintain continuity)
- Add cross-track operation notes

### Story 2.3 Updates Needed:
- Specify visual feedback for drag & drop target
- Clarify behavior when dropping between tracks
- Document track selection logic

### Story 2.4 Updates Needed:
- Specify default track and position for auto-add
- Add recording state coordination with timeline
- Clarify format compatibility

---

*Analysis completed: 2025-01-27*
*Reviewed by: Scrum Master Bob*

