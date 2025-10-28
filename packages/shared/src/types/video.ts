// Video-specific types and interfaces
// VideoClip is already defined in types.ts, so we don't redefine it here
import { VideoClip } from "../types";

// Video format validation
export const SUPPORTED_VIDEO_FORMATS = ["mp4", "mov", "webm"] as const;
export type SupportedVideoFormat = (typeof SUPPORTED_VIDEO_FORMATS)[number];

export const SUPPORTED_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

// Video metadata extraction result
export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  fps: number;
  bitrate?: number;
  codec?: string;
  hasAudio: boolean;
}

// Video processing options
export interface VideoProcessingOptions {
  inputPath: string;
  outputPath: string;
  startTime?: number;
  endTime?: number;
  quality?: "low" | "medium" | "high";
  resolution?: "720p" | "1080p" | "source";
}

// Thumbnail generation options
export interface ThumbnailOptions {
  videoPath: string;
  outputPath: string;
  timestamp?: number; // Time in seconds to capture thumbnail
  width?: number;
  height?: number;
}

// Video import result
export interface VideoImportResult {
  success: boolean;
  clip?: VideoClip;
  error?: string;
}

// Batch import result
export interface BatchImportResult {
  successful: VideoClip[];
  failed: Array<{ filePath: string; error: string }>;
  totalProcessed: number;
}
