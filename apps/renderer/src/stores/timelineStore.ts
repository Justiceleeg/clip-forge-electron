import { create } from "zustand";
import { Timeline, TimelineTrack, TimelineClip } from "@clipforge/shared";

interface TimelineState {
  // Timeline state
  timeline: Timeline;

  // Trim mode state
  trimMode: {
    isActive: boolean;
    clipId: string | null;
    startPosition: number | null;
    endPosition: number | null;
  };

  // Timeline actions
  setTimeline: (timeline: Timeline) => void;
  updateTimeline: (updates: Partial<Timeline>) => void;

  // Playhead actions
  setPlayheadPosition: (position: number) => void;
  seekToTime: (time: number) => void;

  // Track actions
  addTrack: (track: Omit<TimelineTrack, "id">) => void;
  removeTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<TimelineTrack>) => void;

  // Clip actions
  addClipToTrack: (trackId: string, clip: Omit<TimelineClip, "id">) => void;
  removeClipFromTrack: (trackId: string, clipId: string) => void;
  removeClip: (clipId: string) => void; // Helper that finds track automatically
  updateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  selectClip: (clipId: string) => void;
  deselectAllClips: () => void;
  
  // Split and Delete actions
  splitClip: (clipId: string, splitTime: number) => void;
  deleteClip: (clipId: string) => void;
  deleteClips: (clipIds: string[]) => void;
  getClipAtPlayhead: () => TimelineClip | null;
  selectClipMulti: (clipId: string, multiSelect: boolean) => void;

  // Trim actions
  trimClip: (clipId: string, trimStart: number, trimEnd: number) => void;
  resetClipTrim: (clipId: string) => void;
  reorderClip: (clipId: string, newStartTime: number) => void;
  reorderClipRelative: (
    clipId: string,
    targetClipId: string,
    position: "before" | "after"
  ) => void;

  // Trim mode actions
  startTrimMode: (clipId: string) => void;
  updateTrimMode: (playheadPosition: number) => void;
  cancelTrimMode: () => void;
  applyTrimMode: () => void;

  // Trim validation
  validateTrimPoints: (
    clipId: string,
    trimStart: number,
    trimEnd: number
  ) => { isValid: boolean; error?: string };
  getTrimConstraints: (clipId: string) => {
    minStart: number;
    maxStart: number;
    minEnd: number;
    maxEnd: number;
  };

  // Timeline sequence management
  createTimelineSequence: () => {
    clips: TimelineClip[];
    totalDuration: number;
    currentPosition: number;
    activeClip: TimelineClip | null;
  };
  validateSequence: () => boolean;
  getActiveClipAtPosition: (position: number) => TimelineClip | null;
  getSequenceDuration: () => number;

  // Zoom and scroll
  setZoomLevel: (zoomLevel: number) => void;
  setSnapToGrid: (snapToGrid: boolean) => void;
  setGridSize: (gridSize: number) => void;

  // Helper functions
  calculateTimelineDuration: (clips: any[]) => number;
  createTimelineTracks: (clips: any[]) => TimelineTrack[];
  
  // Multi-track helper functions
  getActiveClipsAtTime: (time: number) => TimelineClip[];
  getTracksAtTime: (time: number) => TimelineTrack[];
  moveClipToTrack: (clipId: string, newTrackId: string) => void;
}

const defaultTimeline: Timeline = {
  duration: 10,
  playheadPosition: 0,
  zoomLevel: 1,
  tracks: [],
  snapToGrid: true,
  gridSize: 1,
};

export const useTimelineStore = create<TimelineState>((set, get) => ({
  // Initial state
  timeline: defaultTimeline,
  trimMode: {
    isActive: false,
    clipId: null,
    startPosition: null,
    endPosition: null,
  },

  // Timeline actions
  setTimeline: (timeline) => set({ timeline }),

  updateTimeline: (updates) =>
    set((state) => ({
      timeline: { ...state.timeline, ...updates },
    })),

  // Playhead actions
  setPlayheadPosition: (position) =>
    set((state) => ({
      timeline: {
        ...state.timeline,
        playheadPosition: Math.max(
          0,
          Math.min(position, state.timeline.duration)
        ),
      },
    })),

  seekToTime: (time) => {
    const { timeline } = get();
    const clampedTime = Math.max(0, Math.min(time, timeline.duration));
    set((state) => ({
      timeline: {
        ...state.timeline,
        playheadPosition: clampedTime,
      },
    }));
  },

  // Track actions
  addTrack: (trackData) => {
    const newTrack: TimelineTrack = {
      ...trackData,
      id: `track-${Date.now()}`,
    };

    set((state) => ({
      timeline: {
        ...state.timeline,
        tracks: [...state.timeline.tracks, newTrack],
      },
    }));
  },

  removeTrack: (trackId) =>
    set((state) => ({
      timeline: {
        ...state.timeline,
        tracks: state.timeline.tracks.filter((track) => track.id !== trackId),
      },
    })),

  updateTrack: (trackId, updates) =>
    set((state) => ({
      timeline: {
        ...state.timeline,
        tracks: state.timeline.tracks.map((track) =>
          track.id === trackId ? { ...track, ...updates } : track
        ),
      },
    })),

  // Clip actions
  addClipToTrack: (trackId, clipData) => {
    const newClip: TimelineClip = {
      ...clipData,
      id: `timeline-clip-${Date.now()}`,
    };

    set((state) => ({
      timeline: {
        ...state.timeline,
        tracks: state.timeline.tracks.map((track) =>
          track.id === trackId
            ? { ...track, clips: [...track.clips, newClip] }
            : track
        ),
      },
    }));
  },

  removeClipFromTrack: (trackId, clipId) =>
    set((state) => {
      const updatedTracks = state.timeline.tracks.map((track) =>
        track.id === trackId
          ? {
              ...track,
              clips: track.clips.filter((clip) => clip.id !== clipId),
            }
          : track
      );

      // Recalculate timeline duration after removal
      const allClips = updatedTracks.flatMap((track) => track.clips);
      const newDuration =
        allClips.length > 0
          ? Math.max(
              state.timeline.duration,
              Math.max(...allClips.map((c) => c.endTime)) + 2
            )
          : state.timeline.duration;

      return {
        timeline: {
          ...state.timeline,
          tracks: updatedTracks,
          duration: newDuration,
        },
      };
    }),

  removeClip: (clipId) => {
    const { timeline } = get();
    const track = timeline.tracks.find((t) =>
      t.clips.some((c) => c.id === clipId)
    );
    if (track) {
      get().removeClipFromTrack(track.id, clipId);
      // Deselect the clip if it was selected
      get().deselectAllClips();
    }
  },

  updateClip: (clipId, updates) =>
    set((state) => ({
      timeline: {
        ...state.timeline,
        tracks: state.timeline.tracks.map((track) => ({
          ...track,
          clips: track.clips.map((clip) =>
            clip.id === clipId ? { ...clip, ...updates } : clip
          ),
        })),
      },
    })),

  selectClip: (clipId) =>
    set((state) => ({
      timeline: {
        ...state.timeline,
        tracks: state.timeline.tracks.map((track) => ({
          ...track,
          clips: track.clips.map((clip) => ({
            ...clip,
            selected: clip.id === clipId,
          })),
        })),
      },
    })),

  deselectAllClips: () =>
    set((state) => ({
      timeline: {
        ...state.timeline,
        tracks: state.timeline.tracks.map((track) => ({
          ...track,
          clips: track.clips.map((clip) => ({ ...clip, selected: false })),
        })),
      },
    })),
  
  // Split clip at a specific time position
  splitClip: (clipId, splitTime) => {
    set((state) => {
      const { timeline } = state;
      
      // Find the clip to split
      let trackWithClip: TimelineTrack | null = null;
      let clipToSplit: TimelineClip | null = null;
      
      for (const track of timeline.tracks) {
        const clip = track.clips.find((c) => c.id === clipId);
        if (clip) {
          trackWithClip = track;
          clipToSplit = clip;
          break;
        }
      }
      
      if (!trackWithClip || !clipToSplit) {
        console.warn(`Clip ${clipId} not found for split operation`);
        return state;
      }
      
      // Validate split time is within clip bounds
      if (splitTime <= clipToSplit.startTime || splitTime >= clipToSplit.endTime) {
        console.warn(`Split time ${splitTime} is outside clip bounds [${clipToSplit.startTime}, ${clipToSplit.endTime}]`);
        return state;
      }
      
      // Calculate split point relative to clip start
      const offsetInClip = splitTime - clipToSplit.startTime;
      
      // Ensure both resulting clips will have valid duration (> 0.1s)
      const firstClipDuration = offsetInClip;
      const secondClipDuration = (clipToSplit.endTime - clipToSplit.startTime) - offsetInClip;
      
      if (firstClipDuration < 0.1 || secondClipDuration < 0.1) {
        console.warn(`Split would create clip with duration < 0.1s. Aborting.`);
        return state;
      }
      
      // Create first clip (from start to split point)
      const firstClip: TimelineClip = {
        id: `timeline-clip-${Date.now()}-a`,
        videoClipId: clipToSplit.videoClipId,
        trackId: trackWithClip.id,
        startTime: clipToSplit.startTime,
        endTime: splitTime,
        trimStart: clipToSplit.trimStart,
        trimEnd: clipToSplit.trimStart + offsetInClip,
        originalDuration: clipToSplit.originalDuration,
        selected: false,
      };
      
      // Create second clip (from split point to end)
      const secondClip: TimelineClip = {
        id: `timeline-clip-${Date.now()}-b`,
        videoClipId: clipToSplit.videoClipId,
        trackId: trackWithClip.id,
        startTime: splitTime,
        endTime: clipToSplit.endTime,
        trimStart: clipToSplit.trimStart + offsetInClip,
        trimEnd: clipToSplit.trimEnd,
        originalDuration: clipToSplit.originalDuration,
        selected: true, // Select the second clip after split
      };
      
      // Update tracks: remove original clip and add both new clips
      const updatedTracks = timeline.tracks.map((track) => {
        if (track.id !== trackWithClip.id) return track;
        
        return {
          ...track,
          clips: track.clips
            .filter((c) => c.id !== clipId)
            .concat([firstClip, secondClip])
            .sort((a, b) => a.startTime - b.startTime),
        };
      });
      
      console.log(`✅ Split clip ${clipId} at time ${splitTime}s into ${firstClip.id} and ${secondClip.id}`);
      
      return {
        timeline: {
          ...timeline,
          tracks: updatedTracks,
        },
      };
    });
  },
  
  // Delete a single clip
  deleteClip: (clipId) => {
    get().deleteClips([clipId]);
  },
  
  // Delete multiple clips
  deleteClips: (clipIds) => {
    set((state) => {
      const { timeline } = state;
      
      // Remove all specified clips from their tracks
      const updatedTracks = timeline.tracks.map((track) => ({
        ...track,
        clips: track.clips.filter((clip) => !clipIds.includes(clip.id)),
      }));
      
      // Recalculate timeline duration
      const allClips = updatedTracks.flatMap((track) => track.clips);
      const newDuration =
        allClips.length > 0
          ? Math.max(
              timeline.duration,
              Math.max(...allClips.map((c) => c.endTime)) + 2
            )
          : timeline.duration;
      
      console.log(`✅ Deleted ${clipIds.length} clip(s)`);
      
      return {
        timeline: {
          ...timeline,
          tracks: updatedTracks,
          duration: newDuration,
        },
      };
    });
  },
  
  // Get clip at playhead position
  getClipAtPlayhead: () => {
    const { timeline } = get();
    const allClips = timeline.tracks.flatMap((track) => track.clips);
    
    return (
      allClips.find(
        (clip) =>
          timeline.playheadPosition >= clip.startTime &&
          timeline.playheadPosition <= clip.endTime
      ) || null
    );
  },
  
  // Select clip with multi-select support
  selectClipMulti: (clipId, multiSelect) => {
    if (multiSelect) {
      // Toggle selection for this clip without deselecting others
      set((state) => ({
        timeline: {
          ...state.timeline,
          tracks: state.timeline.tracks.map((track) => ({
            ...track,
            clips: track.clips.map((clip) =>
              clip.id === clipId
                ? { ...clip, selected: !clip.selected }
                : clip
            ),
          })),
        },
      }));
    } else {
      // Single select (deselect all others)
      get().selectClip(clipId);
    }
  },

  // Trim actions
  trimClip: (clipId, trimStart, trimEnd) => {
    const validation = get().validateTrimPoints(clipId, trimStart, trimEnd);
    if (!validation.isValid) {
      console.warn("Trim validation failed:", validation.error);
      return;
    }

    set((state) => {
      const { timeline } = state;
      const clip = timeline.tracks
        .flatMap((track) => track.clips)
        .find((c) => c.id === clipId);

      if (!clip) return state;

      // Calculate the trimmed duration
      const trimmedDuration = trimEnd - trimStart;

      // Calculate how much the clip will shrink
      const originalDuration = clip.endTime - clip.startTime;
      const shrinkAmount = originalDuration - trimmedDuration;

      // Calculate the new end time for the trimmed clip
      const newEndTime = clip.startTime + trimmedDuration;

      // Update the clip's timeline position and trim points
      const updatedTracks = timeline.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((c) => {
          if (c.id === clipId) {
            return {
              ...c,
              trimStart,
              trimEnd,
              // Update timeline position to reflect trimmed portion
              endTime: newEndTime,
            };
          }

          // Shift subsequent clips to fill the gap (check against OLD endTime)
          if (c.startTime >= clip.endTime) {
            return {
              ...c,
              startTime: c.startTime - shrinkAmount,
              endTime: c.endTime - shrinkAmount,
            };
          }

          return c;
        }),
      }));

      // Recalculate timeline duration
      // NOTE: We don't change duration during trim to keep zoom level stable
      // The timeline duration should only grow, never shrink
      const allClips = updatedTracks.flatMap((track) => track.clips);
      const maxClipEnd =
        allClips.length > 0 ? Math.max(...allClips.map((c) => c.endTime)) : 0;

      // Only increase duration if clips extend beyond current duration
      const newDuration = Math.max(timeline.duration, maxClipEnd + 2);

      return {
        timeline: {
          ...timeline,
          tracks: updatedTracks,
          duration: newDuration,
        },
      };
    });
  },

  resetClipTrim: (clipId) => {
    set((state) => {
      const { timeline } = state;
      const clip = timeline.tracks
        .flatMap((track) => track.clips)
        .find((c) => c.id === clipId);

      if (!clip) return state;

      // Calculate how much the clip will expand
      const currentDuration = clip.endTime - clip.startTime;
      const expandAmount = clip.originalDuration - currentDuration;

      // Reset the clip's timeline position and trim points
      const updatedTracks = timeline.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((c) => {
          if (c.id === clipId) {
            return {
              ...c,
              trimStart: 0,
              trimEnd: c.originalDuration,
              // Restore original timeline position
              endTime: c.startTime + c.originalDuration,
            };
          }

          // Shift subsequent clips to make room for expansion
          if (c.startTime > clip.endTime) {
            return {
              ...c,
              startTime: c.startTime + expandAmount,
              endTime: c.endTime + expandAmount,
            };
          }

          return c;
        }),
      }));

      // Recalculate timeline duration
      const allClips = updatedTracks.flatMap((track) => track.clips);
      const newDuration =
        allClips.length > 0
          ? Math.max(...allClips.map((c) => c.endTime)) + 2 // Add 2 seconds buffer
          : timeline.duration;

      return {
        timeline: {
          ...timeline,
          tracks: updatedTracks,
          duration: newDuration,
        },
      };
    });
  },

  reorderClip: (clipId, newStartTime) => {
    set((state) => {
      const { timeline } = state;
      const track = timeline.tracks.find((t) =>
        t.clips.some((c) => c.id === clipId)
      );

      if (!track) return state;

      const clip = track.clips.find((c) => c.id === clipId);
      if (!clip) return state;

      const clipDuration = clip.endTime - clip.startTime;

      // Get all other clips on this track
      let otherClips = track.clips.filter((c) => c.id !== clipId);
      
      // Sort clips by start time
      otherClips.sort((a, b) => a.startTime - b.startTime);

      // SNAP PRIORITY 0: Check for snap to timeline start (0s)
      const snapThreshold = 1; // 1 second threshold for all snapping
      let snappedStartTime = newStartTime;
      let snappedToClip = false;

      // Check if near timeline start
      if (Math.abs(newStartTime) < snapThreshold) {
        snappedStartTime = 0;
        snappedToClip = true; // Treat as high priority snap
      }

      // SNAP PRIORITY 1: Check for nearby clip boundaries
      if (!snappedToClip) {
        for (const otherClip of otherClips) {
          // Snap to end of this clip
          if (Math.abs(newStartTime - otherClip.endTime) < snapThreshold) {
            snappedStartTime = otherClip.endTime;
            snappedToClip = true;
            break;
          }
          
          // Snap to start of this clip (place before it)
          if (Math.abs(newStartTime + clipDuration - otherClip.startTime) < snapThreshold) {
            snappedStartTime = otherClip.startTime - clipDuration;
            snappedToClip = true;
            break;
          }
        }
      }

      // SNAP PRIORITY 2: If not snapped to clip, snap to nearest ruler tick
      // But only if tick interval is > 0.5s (don't snap when zoomed in too much)
      if (!snappedToClip) {
        // Calculate ruler tick interval (same logic as getTimeIntervals)
        const duration = timeline.duration;
        const zoomLevel = timeline.zoomLevel;
        const visibleDuration = duration / zoomLevel;
        const idealInterval = visibleDuration / 20;
        const niceIntervals = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600];
        
        let tickInterval = niceIntervals.find((interval) => interval >= idealInterval);
        if (!tickInterval) {
          tickInterval = idealInterval < 0.5 ? 0.5 : niceIntervals[niceIntervals.length - 1];
        }

        // Only snap to ruler ticks if interval > 0.5s
        if (tickInterval > 0.5) {
          snappedStartTime = Math.round(newStartTime / tickInterval) * tickInterval;
        } else {
          // When zoomed in (0.5s ticks), don't snap to ruler
          snappedStartTime = newStartTime;
        }
      }

      // Ensure no negative time
      snappedStartTime = Math.max(0, snappedStartTime);

      // Check for overlaps and prevent them
      const newEndTime = snappedStartTime + clipDuration;
      
      // Find if this position would overlap with any clips
      for (const otherClip of otherClips) {
        const wouldOverlap = (
          (snappedStartTime >= otherClip.startTime && snappedStartTime < otherClip.endTime) ||
          (newEndTime > otherClip.startTime && newEndTime <= otherClip.endTime) ||
          (snappedStartTime <= otherClip.startTime && newEndTime >= otherClip.endTime)
        );

        if (wouldOverlap) {
          // Find nearest non-overlapping position
          // Try placing after the overlapping clip
          const afterPosition = otherClip.endTime;
          const afterEndTime = afterPosition + clipDuration;
          
          // Check if placing after works (no overlap with next clip)
          const nextClipIndex = otherClips.indexOf(otherClip) + 1;
          const nextClip = nextClipIndex < otherClips.length ? otherClips[nextClipIndex] : null;
          
          if (!nextClip || afterEndTime <= nextClip.startTime) {
            snappedStartTime = afterPosition;
            break;
          } else {
            // Try placing before the overlapping clip
            const beforePosition = otherClip.startTime - clipDuration;
            if (beforePosition >= 0) {
              // Check no overlap with previous clip
              const prevClipIndex = otherClips.indexOf(otherClip) - 1;
              const prevClip = prevClipIndex >= 0 ? otherClips[prevClipIndex] : null;
              
              if (!prevClip || beforePosition >= prevClip.endTime) {
                snappedStartTime = beforePosition;
                break;
              }
            }
          }
        }
      }

      // Create repositioned clip
      const repositionedClip = {
        ...clip,
        startTime: snappedStartTime,
        endTime: snappedStartTime + clipDuration,
      };

      // Insert clip at new position
      const allClips = [...otherClips, repositionedClip].sort(
        (a, b) => a.startTime - b.startTime
      );

      // Update the track
      const updatedTracks = timeline.tracks.map((t) =>
        t.id === track.id ? { ...t, clips: allClips } : t
      );

      // Recalculate timeline duration
      const allTimelineClips = updatedTracks.flatMap((t) => t.clips);
      const newDuration =
        allTimelineClips.length > 0
          ? Math.max(
              timeline.duration,
              Math.max(...allTimelineClips.map((c) => c.endTime)) + 2
            )
          : timeline.duration;

      console.log(`✅ Repositioned clip ${clipId} to ${snappedStartTime.toFixed(2)}s (duration: ${clipDuration.toFixed(2)}s)`);

      return {
        timeline: {
          ...timeline,
          tracks: updatedTracks,
          duration: newDuration,
        },
      };
    });
  },

  // New function: reorder clip based on target clip and position (before/after)
  reorderClipRelative: (
    clipId: string,
    targetClipId: string,
    position: "before" | "after"
  ) => {
    set((state) => {
      const { timeline } = state;
      const track = timeline.tracks.find((t) =>
        t.clips.some((c) => c.id === clipId)
      );

      if (!track) return state;

      const clip = track.clips.find((c) => c.id === clipId);
      const targetClip = track.clips.find((c) => c.id === targetClipId);

      if (!clip || !targetClip || clipId === targetClipId) return state;

      // Remove the dragged clip
      let otherClips = track.clips.filter((c) => c.id !== clipId);

      // Find the target clip index
      const targetIndex = otherClips.findIndex((c) => c.id === targetClipId);
      if (targetIndex === -1) return state;

      // Insert before or after
      const insertIndex = position === "before" ? targetIndex : targetIndex + 1;
      otherClips.splice(insertIndex, 0, clip);

      // Reposition all clips to be sequential
      let currentTime = 0;
      const repositionedClips = otherClips.map((c) => {
        const duration = c.endTime - c.startTime;
        const newClip = {
          ...c,
          startTime: currentTime,
          endTime: currentTime + duration,
        };
        currentTime = newClip.endTime;
        return newClip;
      });

      // Update the track
      const updatedTracks = timeline.tracks.map((t) =>
        t.id === track.id ? { ...t, clips: repositionedClips } : t
      );

      // Recalculate timeline duration
      const allClips = updatedTracks.flatMap((t) => t.clips);
      const newDuration =
        allClips.length > 0
          ? Math.max(
              timeline.duration,
              Math.max(...allClips.map((c) => c.endTime)) + 2
            )
          : timeline.duration;

      console.log(`✅ Reordered clip ${clipId} ${position} ${targetClipId}`);

      return {
        timeline: {
          ...timeline,
          tracks: updatedTracks,
          duration: newDuration,
        },
      };
    });
  },

  // Trim mode actions
  startTrimMode: (clipId) => {
    const { timeline } = get();
    const clip = timeline.tracks
      .flatMap((track) => track.clips)
      .find((c) => c.id === clipId);

    if (!clip) return;

    set(() => ({
      trimMode: {
        isActive: true,
        clipId,
        startPosition: timeline.playheadPosition,
        endPosition: null,
      },
    }));
  },

  updateTrimMode: (playheadPosition) => {
    const { trimMode } = get();
    if (!trimMode.isActive || !trimMode.clipId) return;

    const { timeline } = get();
    const clip = timeline.tracks
      .flatMap((track) => track.clips)
      .find((c) => c.id === trimMode.clipId);

    if (!clip) {
      get().cancelTrimMode();
      return;
    }

    // Check if playhead is outside the original clip bounds
    if (playheadPosition < clip.startTime || playheadPosition > clip.endTime) {
      get().cancelTrimMode();
      return;
    }

    set((state) => ({
      trimMode: {
        ...state.trimMode,
        endPosition: playheadPosition,
      },
    }));
  },

  cancelTrimMode: () => {
    set(() => ({
      trimMode: {
        isActive: false,
        clipId: null,
        startPosition: null,
        endPosition: null,
      },
    }));
  },

  applyTrimMode: () => {
    const { trimMode } = get();
    if (
      !trimMode.isActive ||
      !trimMode.clipId ||
      !trimMode.startPosition ||
      !trimMode.endPosition
    ) {
      return;
    }

    const { timeline } = get();
    const clip = timeline.tracks
      .flatMap((track) => track.clips)
      .find((c) => c.id === trimMode.clipId);

    if (!clip) return;

    // Calculate trim points relative to clip start
    const clipStartTime = clip.startTime;
    const startTrim = Math.max(0, trimMode.startPosition - clipStartTime);
    const endTrim = Math.min(
      clip.endTime - clipStartTime,
      trimMode.endPosition - clipStartTime
    );

    // Ensure chronological order (handle backwards selection)
    const finalStartTrim = Math.min(startTrim, endTrim);
    const finalEndTrim = Math.max(startTrim, endTrim);

    // Apply the trim
    get().trimClip(trimMode.clipId, finalStartTrim, finalEndTrim);

    // Exit trim mode
    get().cancelTrimMode();
  },

  // Trim validation
  validateTrimPoints: (clipId, trimStart, trimEnd) => {
    const clip = get()
      .timeline.tracks.flatMap((track) => track.clips)
      .find((c) => c.id === clipId);

    if (!clip) {
      return { isValid: false, error: "Clip not found" };
    }

    const minDuration = 0.1; // Minimum 100ms duration

    // Validate trim start
    if (trimStart < 0) {
      return { isValid: false, error: "Trim start cannot be negative" };
    }

    if (trimStart >= clip.originalDuration) {
      return {
        isValid: false,
        error: "Trim start must be less than original clip duration",
      };
    }

    // Validate trim end
    if (trimEnd <= trimStart) {
      return {
        isValid: false,
        error: "Trim end must be greater than trim start",
      };
    }

    if (trimEnd > clip.originalDuration) {
      return {
        isValid: false,
        error: "Trim end cannot exceed original clip duration",
      };
    }

    // Validate minimum duration
    if (trimEnd - trimStart < minDuration) {
      return {
        isValid: false,
        error: `Minimum trim duration is ${minDuration}s`,
      };
    }

    return { isValid: true };
  },

  getTrimConstraints: (clipId) => {
    const clip = get()
      .timeline.tracks.flatMap((track) => track.clips)
      .find((c) => c.id === clipId);

    if (!clip) {
      return { minStart: 0, maxStart: 0, minEnd: 0, maxEnd: 0 };
    }

    const minDuration = 0.1;

    return {
      minStart: 0,
      maxStart: clip.originalDuration - minDuration,
      minEnd: minDuration,
      maxEnd: clip.originalDuration,
    };
  },

  // Timeline sequence management
  createTimelineSequence: () => {
    const { timeline } = get();
    const allClips = timeline.tracks.flatMap((track) => track.clips);
    const totalDuration = timeline.duration;
    const currentPosition = timeline.playheadPosition;
    const activeClip = get().getActiveClipAtPosition(currentPosition);

    return {
      clips: allClips,
      totalDuration,
      currentPosition,
      activeClip,
    };
  },

  validateSequence: () => {
    const { timeline } = get();
    const allClips = timeline.tracks.flatMap((track) => track.clips);

    // Sort clips by start time
    const sortedClips = [...allClips].sort((a, b) => a.startTime - b.startTime);

    // Check for overlaps and invalid trim points
    for (let i = 0; i < sortedClips.length; i++) {
      const clip = sortedClips[i];

      // Validate trim points
      if (clip.trimStart >= clip.trimEnd) {
        return false;
      }

      if (clip.trimStart < 0 || clip.trimEnd > clip.endTime - clip.startTime) {
        return false;
      }

      // Check for overlaps with next clip
      if (i < sortedClips.length - 1) {
        const nextClip = sortedClips[i + 1];
        if (clip.endTime > nextClip.startTime) {
          return false;
        }
      }
    }

    return true;
  },

  getActiveClipAtPosition: (position) => {
    const { timeline } = get();
    const allClips = timeline.tracks.flatMap((track) => track.clips);

    return (
      allClips.find(
        (clip) => position >= clip.startTime && position <= clip.endTime
      ) || null
    );
  },

  getSequenceDuration: () => {
    const { timeline } = get();
    return timeline.duration;
  },

  // Timeline calculations
  calculateTimelineDuration: (clips) => {
    const { timeline } = get();
    const hasClips = clips.length > 0;

    if (!hasClips) {
      return 60; // Default 1 minute when no clips
    }

    // Calculate the required duration based on clips
    const maxClipEnd = Math.max(...clips.map((clip) => clip.duration)) + 2;

    // Once clips are imported, maintain at least the current duration
    // This prevents timeline from shrinking during trim operations
    return Math.max(maxClipEnd, timeline.duration);
  },

  createTimelineTracks: (clips) => {
    if (clips.length === 0) {
      // Create 2 video tracks by default for multi-track support
      return [
        {
          id: "track-1",
          name: "Video Track 1",
          type: "video" as const,
          clips: [],
          muted: false,
          volume: 1.0,
        },
        {
          id: "track-2",
          name: "Video Track 2",
          type: "video" as const,
          clips: [],
          muted: false,
          volume: 1.0,
          // Default overlay position: centered, 25% scale
          overlayPosition: {
            x: 0.5, // Center X (0.5 = 50% from left)
            y: 0.5, // Center Y (0.5 = 50% from top)
            scale: 0.25, // 25% size
          },
        },
      ];
    }

    // Create 2 tracks and place all clips on track 1 for now
    const trackClips: TimelineClip[] = clips.map((clip, index) => ({
      id: `timeline-clip-${clip.id}`,
      videoClipId: clip.id,
      trackId: "track-1",
      startTime: index * 2, // Space clips 2 seconds apart
      endTime: index * 2 + clip.duration,
      trimStart: 0,
      trimEnd: clip.duration,
      originalDuration: clip.duration, // Store original duration
      selected: false,
    }));

    return [
      {
        id: "track-1",
        name: "Video Track 1",
        type: "video" as const,
        clips: trackClips,
        muted: false,
        volume: 1.0,
      },
      {
        id: "track-2",
        name: "Video Track 2",
        type: "video" as const,
        clips: [],
        muted: false,
        volume: 1.0,
      },
    ];
  },

  // Zoom and scroll
  setZoomLevel: (zoomLevel) =>
    set((state) => ({
      timeline: { ...state.timeline, zoomLevel },
    })),

  setSnapToGrid: (snapToGrid) =>
    set((state) => ({
      timeline: { ...state.timeline, snapToGrid },
    })),

  setGridSize: (gridSize) =>
    set((state) => ({
      timeline: { ...state.timeline, gridSize },
    })),

  // Multi-track helper functions
  getActiveClipsAtTime: (time) => {
    const { timeline } = get();
    const allClips = timeline.tracks.flatMap((track) => track.clips);
    
    return allClips.filter(
      (clip) => time >= clip.startTime && time <= clip.endTime
    );
  },

  getTracksAtTime: (time) => {
    const { timeline } = get();
    
    return timeline.tracks.filter((track) =>
      track.clips.some((clip) => time >= clip.startTime && time <= clip.endTime)
    );
  },

  moveClipToTrack: (clipId, newTrackId) => {
    set((state) => {
      const { timeline } = state;
      
      // Find the clip and its current track
      let sourceTrack: TimelineTrack | null = null;
      let clipToMove: TimelineClip | null = null;
      
      for (const track of timeline.tracks) {
        const clip = track.clips.find((c) => c.id === clipId);
        if (clip) {
          sourceTrack = track;
          clipToMove = clip;
          break;
        }
      }
      
      if (!sourceTrack || !clipToMove) {
        console.warn(`Clip ${clipId} not found`);
        return state;
      }
      
      // Don't move if already on target track
      if (sourceTrack.id === newTrackId) {
        return state;
      }
      
      // Find target track
      const targetTrack = timeline.tracks.find((t) => t.id === newTrackId);
      if (!targetTrack) {
        console.warn(`Target track ${newTrackId} not found`);
        return state;
      }
      
      // Remove clip from source track and add to target track
      const updatedTracks = timeline.tracks.map((track) => {
        if (track.id === sourceTrack.id) {
          // Remove from source
          return {
            ...track,
            clips: track.clips.filter((c) => c.id !== clipId),
          };
        }
        if (track.id === newTrackId) {
          // Add to target
          const updatedClip = { ...clipToMove, trackId: newTrackId };
          return {
            ...track,
            clips: [...track.clips, updatedClip].sort(
              (a, b) => a.startTime - b.startTime
            ),
          };
        }
        return track;
      });
      
      console.log(`✅ Moved clip ${clipId} from ${sourceTrack.id} to ${newTrackId}`);
      
      return {
        timeline: {
          ...timeline,
          tracks: updatedTracks,
        },
      };
    });
  },
}));
