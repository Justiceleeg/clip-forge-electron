import { VideoClip, ExportSettings, Timeline } from "@clipforge/shared";

export interface ScreenSource {
  id: string;
  name: string;
  thumbnail: string | null;
  type: "screen" | "window";
}

export interface ElectronAPI {
  // File operations
  importVideo: (filePath: string) => Promise<VideoClip>;
  importVideoFromBuffer: (fileData: {
    fileName: string;
    mimeType: string;
    buffer: Uint8Array;
  }) => Promise<VideoClip>;
  openFileDialog: () => Promise<{ canceled: boolean; filePaths?: string[] }>;
  showSaveDialog: (options: {
    title: string;
    defaultPath: string;
    filters: Array<{ name: string; extensions: string[] }>;
  }) => Promise<{ canceled: boolean; filePath?: string }>;
  saveProject: (project: any) => Promise<void>;
  loadProject: (filePath: string) => Promise<void>;

  // Video export - export timeline instead of single clip
  exportVideo: (data: {
    timeline: Timeline;
    clips: VideoClip[];
    outputPath: string;
    settings: ExportSettings;
  }) => Promise<void>;

  // Recording operations
  getScreenSources: () => Promise<ScreenSource[]>;
  startScreenRecording: (data: {
    sourceId: string;
    includeAudio?: boolean;
    microphoneDeviceId?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  startWebcamRecording: (data: {
    webcamDeviceId: string;
    microphoneDeviceId?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  stopRecording: () => Promise<{ filePath: string }>;
  saveRecording: (chunks: Uint8Array[]) => Promise<{ filePath: string }>;
  getRecordingState: () => Promise<{
    isRecording: boolean;
    duration: number | null;
    outputPath: string | null;
  }>;

  // Event listeners
  onFileImported: (callback: (event: any, data: any) => void) => void;
  onFileImportError: (callback: (event: any, data: any) => void) => void;
  onProjectSaved: (callback: (event: any, data: any) => void) => void;
  onProjectLoadError: (callback: (event: any, data: any) => void) => void;
  onProjectLoaded: (callback: (event: any, data: any) => void) => void;
  onVideoProcessed: (callback: (event: any, data: any) => void) => void;
  onVideoProcessingProgress: (
    callback: (event: any, data: any) => void
  ) => void;
  onVideoProcessingError: (callback: (event: any, data: any) => void) => void;

  // Recording event listeners
  onRecordingStarted: (callback: (event: any, data: any) => void) => void;
  onRecordingStopped: (callback: (event: any, data: any) => void) => void;
  onRecordingError: (callback: (event: any, data: any) => void) => void;

  // Remove listeners
  removeAllListeners: (channel: string) => void;

  // Send events
  sendImportVideo: (filePath: string) => void;
  sendSaveProject: (project: any) => void;
  sendLoadProject: (filePath: string) => void;
  sendExportVideo: (data: {
    timeline: Timeline;
    clips: VideoClip[];
    outputPath: string;
    settings: ExportSettings;
  }) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    electron: ElectronAPI;
  }
}

export {};
