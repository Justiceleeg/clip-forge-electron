import { create } from "zustand";

export interface PreviewState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  isMuted: boolean;
  selectedClipId: string | null;
}

interface PreviewStore {
  preview: PreviewState;
  setPreview: (preview: PreviewState) => void;
  updatePreview: (updates: Partial<PreviewState>) => void;
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  seekToTime: (time: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  toggleMute: () => void;
  selectClip: (clipId: string | null) => void;
}

const defaultPreview: PreviewState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  playbackRate: 1,
  isMuted: false,
  selectedClipId: null,
};

export const usePreviewStore = create<PreviewStore>((set) => ({
  // Initial state
  preview: defaultPreview,

  // Preview actions
  setPreview: (preview) => set({ preview }),

  updatePreview: (updates) =>
    set((state) => ({
      preview: { ...state.preview, ...updates },
    })),

  // Playback controls
  play: () =>
    set((state) => ({
      preview: { ...state.preview, isPlaying: true },
    })),

  pause: () =>
    set((state) => ({
      preview: { ...state.preview, isPlaying: false },
    })),

  togglePlayPause: () =>
    set((state) => ({
      preview: { ...state.preview, isPlaying: !state.preview.isPlaying },
    })),

  seekToTime: (time) =>
    set((state) => ({
      preview: { ...state.preview, currentTime: time },
    })),

  setVolume: (volume) =>
    set((state) => ({
      preview: { ...state.preview, volume: Math.max(0, Math.min(1, volume)) },
    })),

  setPlaybackRate: (rate) =>
    set((state) => ({
      preview: { ...state.preview, playbackRate: rate },
    })),

  toggleMute: () =>
    set((state) => ({
      preview: { ...state.preview, isMuted: !state.preview.isMuted },
    })),

  selectClip: (clipId) =>
    set((state) => ({
      preview: { ...state.preview, selectedClipId: clipId },
    })),
}));
