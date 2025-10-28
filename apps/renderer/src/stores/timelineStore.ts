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
  updateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  selectClip: (clipId: string) => void;
  deselectAllClips: () => void;

  // Trim actions
  trimClip: (clipId: string, trimStart: number, trimEnd: number) => void;
  resetClipTrim: (clipId: string) => void;

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
    set((state) => ({
      timeline: {
        ...state.timeline,
        tracks: state.timeline.tracks.map((track) =>
          track.id === trackId
            ? {
                ...track,
                clips: track.clips.filter((clip) => clip.id !== clipId),
              }
            : track
        ),
      },
    })),

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
              endTime: c.startTime + trimmedDuration,
            };
          }

          // Shift subsequent clips to fill the gap
          if (c.startTime > clip.endTime) {
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

  // Trim mode actions
  startTrimMode: (clipId) => {
    const { timeline } = get();
    const clip = timeline.tracks
      .flatMap((track) => track.clips)
      .find((c) => c.id === clipId);

    if (!clip) return;

    set((state) => ({
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
    set((state) => ({
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
      return [
        {
          id: "track-1",
          name: "Video Track 1",
          type: "video" as const,
          clips: [],
          muted: false,
          volume: 1.0,
        },
      ];
    }

    // For now, put all clips on a single track
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
}));
