// Project types
export interface Project {
  id: string;
  name: string;
  createdAt: Date;
  modifiedAt: Date;
  timeline: Timeline;
  exportSettings: ExportSettings;
}

// Video clip types
export interface VideoClip {
  id: string;
  filePath: string;
  name: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  trimStart: number;
  trimEnd: number;
  thumbnailPath: string;
}

// Timeline types
export interface Timeline {
  duration: number;
  playheadPosition: number;
  zoomLevel: number;
  tracks: TimelineTrack[];
  snapToGrid: boolean;
  gridSize: number;
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: "video" | "audio";
  clips: TimelineClip[];
  muted: boolean;
  volume: number;
  // Overlay positioning for video tracks (used for PiP/overlay effects)
  overlayPosition?: {
    x: number; // Center X position (0-1, as fraction of bottom video width)
    y: number; // Center Y position (0-1, as fraction of bottom video height)
    scale: number; // Size scale (0-1, where 1 = full size of bottom video)
  };
}

export interface TimelineClip {
  id: string;
  videoClipId: string;
  trackId: string;
  startTime: number;
  endTime: number;
  trimStart: number;
  trimEnd: number;
  originalDuration: number; // Original clip duration before any trimming
  selected: boolean;
}

export interface TimelineSequence {
  clips: TimelineClip[];
  totalDuration: number;
  currentPosition: number;
  activeClip: TimelineClip | null;
}

// Export settings types
export interface ExportSettings {
  resolution: "720p" | "1080p" | "source";
  quality: "low" | "medium" | "high";
  format: "mp4";
  fps: number;
  bitrate: number;
  audioBitrate: number;
  includeTranscription?: boolean;
}

// IPC event types
export interface FileEvents {
  "file-imported": { clip: VideoClip };
  "file-import-error": { error: string };
  "project-saved": { success: boolean };
  "project-loaded": { project: Project };
}

export interface VideoEvents {
  "video-processed": { outputPath: string };
  "video-processing-progress": { progress: number; message?: string };
  "video-processing-error": { error: string };
  "thumbnail-generated": { clipId: string; thumbnailPath: string };
}

export interface RecordingEvents {
  "recording-started": { success: boolean };
  "recording-stopped": { outputPath: string; secondaryOutputPath?: string };
  "recording-error": { error: string };
}

export interface TranscriptionEvents {
  "transcription-progress": TranscriptionProgress;
  "transcription-complete": { transcriptionFilePath: string };
  "transcription-error": { error: string };
}

export interface FileCommands {
  "import-video": { filePath: string };
  "save-project": { project: Project };
  "load-project": { filePath: string };
  "export-video": {
    project: Project;
    outputPath: string;
    settings: ExportSettings;
  };
  "transcribe-video": {
    videoFilePath: string;
    transcriptionConfig: TranscriptionConfig;
  };
}

export interface VideoCommands {
  "generate-thumbnail": { clipId: string; videoPath: string };
  "trim-video": {
    inputPath: string;
    outputPath: string;
    startTime: number;
    endTime: number;
  };
}

export interface RecordingCommands {
  "start-screen-recording": {
    source: "fullscreen" | "window";
    windowId?: string;
  };
  "start-webcam-recording": { deviceId: string };
  "start-simultaneous-recording": {
    screenSourceId: string;
    webcamDeviceId: string;
    microphoneDeviceId?: string;
    pipConfig: PipConfig;
    recordingMode: 'composited' | 'separate-tracks';
  };
  "stop-recording": void;
}

// PiP configuration for simultaneous recording
export interface PipConfig {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  size: 'small' | 'medium' | 'large';
  customWidth?: number;
  customHeight?: number;
}

// Transcription types
export interface TranscriptionConfig {
  apiKey: string;
  model?: string;
}

export interface TranscriptionResult {
  text: string;
}

export interface TranscriptionProgress {
  stage: 'extracting' | 'transcribing' | 'formatting' | 'complete';
  progress: number; // 0-100
  message: string;
}
