import { create } from 'zustand';
import { Timeline, TimelineTrack, TimelineClip } from '@clipforge/shared';

interface TimelineState {
  // Timeline state
  timeline: Timeline;
  
  // Timeline actions
  setTimeline: (timeline: Timeline) => void;
  updateTimeline: (updates: Partial<Timeline>) => void;
  
  // Playhead actions
  setPlayheadPosition: (position: number) => void;
  seekToTime: (time: number) => void;
  
  // Track actions
  addTrack: (track: Omit<TimelineTrack, 'id'>) => void;
  removeTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<TimelineTrack>) => void;
  
  // Clip actions
  addClipToTrack: (trackId: string, clip: Omit<TimelineClip, 'id'>) => void;
  removeClipFromTrack: (trackId: string, clipId: string) => void;
  updateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  selectClip: (clipId: string) => void;
  deselectAllClips: () => void;
  
  // Timeline calculations
  calculateTimelineDuration: (clips: any[]) => number;
  createTimelineTracks: (clips: any[]) => TimelineTrack[];
  
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
        playheadPosition: Math.max(0, Math.min(position, state.timeline.duration)),
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
            ? { ...track, clips: track.clips.filter((clip) => clip.id !== clipId) }
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
  
  // Timeline calculations
  calculateTimelineDuration: (clips) => {
    if (clips.length === 0) return 10; // Default 10 seconds
    return Math.max(...clips.map((clip) => clip.duration)) + 2; // Add 2 seconds buffer
  },
  
  createTimelineTracks: (clips) => {
    if (clips.length === 0) {
      return [{
        id: 'track-1',
        name: 'Video Track 1',
        type: 'video' as const,
        clips: [],
        muted: false,
        volume: 1.0
      }];
    }

    // For now, put all clips on a single track
    const trackClips: TimelineClip[] = clips.map((clip, index) => ({
      id: `timeline-clip-${clip.id}`,
      videoClipId: clip.id,
      trackId: 'track-1',
      startTime: index * 2, // Space clips 2 seconds apart
      endTime: index * 2 + clip.duration,
      trimStart: 0,
      trimEnd: clip.duration,
      selected: false
    }));

    return [{
      id: 'track-1',
      name: 'Video Track 1',
      type: 'video' as const,
      clips: trackClips,
      muted: false,
      volume: 1.0
    }];
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
