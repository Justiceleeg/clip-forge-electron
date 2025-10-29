import { create } from "zustand";
import {
  VideoClip,
  Project,
  Timeline,
  ExportSettings,
} from "@clipforge/shared";

interface ProjectState {
  // Current project
  currentProject: Project | null;

  // Video clips
  clips: VideoClip[];
  selectedClip: VideoClip | null;

  // Timeline state
  timeline: Timeline;

  // Export settings
  exportSettings: ExportSettings;

  // UI state
  isLoading: boolean;
  error: string | null;

  // Import state
  isImporting: boolean;
  importProgress: number;

  // Export state
  isExporting: boolean;
  exportProgress: number;
  exportStatus: string;

  // Actions
  setCurrentProject: (project: Project | null) => void;
  addClip: (clip: VideoClip) => void;
  removeClip: (clipId: string) => void;
  updateClip: (clipId: string, updates: Partial<VideoClip>) => void;
  selectClip: (clip: VideoClip | null) => void;
  setTimeline: (timeline: Timeline) => void;
  updateTimeline: (updates: Partial<Timeline>) => void;
  setExportSettings: (settings: ExportSettings) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setImporting: (importing: boolean) => void;
  setImportProgress: (progress: number) => void;
  setExporting: (exporting: boolean) => void;
  setExportProgress: (progress: number) => void;
  setExportStatus: (status: string) => void;
  clearError: () => void;
  reset: () => void;
}

const defaultTimeline: Timeline = {
  duration: 0,
  playheadPosition: 0,
  zoomLevel: 1,
  tracks: [],
  snapToGrid: true,
  gridSize: 1,
};

const defaultExportSettings: ExportSettings = {
  resolution: "1080p",
  quality: "high",
  format: "mp4",
  fps: 30,
  bitrate: 5000,
  audioBitrate: 128,
};

export const useProjectStore = create<ProjectState>((set) => ({
  // Initial state
  currentProject: null,
  clips: [],
  selectedClip: null,
  timeline: defaultTimeline,
  exportSettings: defaultExportSettings,
  isLoading: false,
  error: null,
  isImporting: false,
  importProgress: 0,
  isExporting: false,
  exportProgress: 0,
  exportStatus: "",

  // Actions
  setCurrentProject: (project) => set({ currentProject: project }),

  addClip: (clip) =>
    set((state) => ({
      clips: [...state.clips, clip],
    })),

  removeClip: (clipId) =>
    set((state) => ({
      clips: state.clips.filter((clip) => clip.id !== clipId),
    })),

  updateClip: (clipId, updates) =>
    set((state) => ({
      clips: state.clips.map((clip) =>
        clip.id === clipId ? { ...clip, ...updates } : clip
      ),
    })),

  selectClip: (clip) => set({ selectedClip: clip }),

  setTimeline: (timeline) => set({ timeline }),

  updateTimeline: (updates) =>
    set((state) => ({
      timeline: { ...state.timeline, ...updates },
    })),

  setExportSettings: (settings) => set({ exportSettings: settings }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  setImporting: (importing) => set({ isImporting: importing }),

  setImportProgress: (progress) => set({ importProgress: progress }),

  setExporting: (exporting) => set({ isExporting: exporting }),

  setExportProgress: (progress) => set({ exportProgress: progress }),

  setExportStatus: (status) => set({ exportStatus: status }),

  clearError: () => set({ error: null }),

  reset: () =>
    set({
      currentProject: null,
      clips: [],
      selectedClip: null,
      timeline: defaultTimeline,
      exportSettings: defaultExportSettings,
      isLoading: false,
      error: null,
      isImporting: false,
      importProgress: 0,
      isExporting: false,
      exportProgress: 0,
      exportStatus: "",
    }),
}));
