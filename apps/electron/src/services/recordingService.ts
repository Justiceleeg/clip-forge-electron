import { desktopCapturer, DesktopCapturerSource } from "electron";
import { app } from "electron";
import { join } from "path";
import { promises as fs } from "fs";
import { writeFile } from "fs/promises";
import { ffmpegService } from "./ffmpegService";

export interface ScreenSource {
  id: string;
  name: string;
  thumbnail: string | null;
  type: "screen" | "window";
}

export interface RecordingState {
  isRecording: boolean;
  recordingStartTime: number | null;
  recordingMode: 'screen' | 'webcam' | 'screen+webcam' | null;
  selectedSource: ScreenSource | null;
  selectedWebcam: string | null; // deviceId
  selectedMicrophone: string | null; // deviceId
  outputPath: string | null;
  mediaRecorder: MediaRecorder | null;
  chunks: Blob[];
}

export class RecordingService {
  private state: RecordingState = {
    isRecording: false,
    recordingStartTime: null,
    recordingMode: null,
    selectedSource: null,
    selectedWebcam: null,
    selectedMicrophone: null,
    outputPath: null,
    mediaRecorder: null,
    chunks: [],
  };

  private recordingsDir: string;

  constructor() {
    const userDataPath = app.getPath("userData");
    this.recordingsDir = join(userDataPath, "recordings");
    this.ensureRecordingsDirectory();
  }

  /**
   * Ensure the recordings directory exists
   */
  private async ensureRecordingsDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.recordingsDir, { recursive: true });
    } catch (error) {
      console.error("Error creating recordings directory:", error);
    }
  }

  /**
   * Get available screen sources for recording
   */
  async getScreenSources(): Promise<ScreenSource[]> {
    try {
      const sources = await desktopCapturer.getSources({
        types: ["window", "screen"],
        thumbnailSize: { width: 300, height: 200 },
      });

      return sources.map((source: DesktopCapturerSource) => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL(),
        type: source.id.startsWith("screen:") ? "screen" : "window",
      }));
    } catch (error) {
      console.error("Error getting screen sources:", error);
      throw new Error("Failed to get screen sources");
    }
  }

  /**
   * Start screen recording
   */
  async startScreenRecording(
    sourceId: string,
    includeAudio: boolean = false,
    microphoneDeviceId?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (this.state.isRecording) {
      return { success: false, error: "Recording already in progress" };
    }

    try {
      // We'll set up the recording state here
      // The actual MediaRecorder will be set up in the renderer process
      // which has access to the MediaStream
      
      this.state.isRecording = true;
      this.state.recordingStartTime = Date.now();
      this.state.recordingMode = 'screen';
      this.state.selectedMicrophone = microphoneDeviceId || null;
      this.state.chunks = [];

      // Generate output file path
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .split("T")
        .join("-")
        .split("Z")[0];
      const filename = `screen-recording-${timestamp}.webm`;
      this.state.outputPath = join(this.recordingsDir, filename);

      return { success: true };
    } catch (error) {
      console.error("Error starting screen recording:", error);
      this.state.isRecording = false;
      this.state.recordingStartTime = null;
      this.state.recordingMode = null;
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to start recording",
      };
    }
  }

  /**
   * Start webcam recording
   */
  async startWebcamRecording(
    webcamDeviceId: string,
    microphoneDeviceId?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (this.state.isRecording) {
      return { success: false, error: "Recording already in progress" };
    }

    try {
      // The actual MediaRecorder will be set up in the renderer process
      // which has access to getUserMedia
      
      this.state.isRecording = true;
      this.state.recordingStartTime = Date.now();
      this.state.recordingMode = 'webcam';
      this.state.selectedWebcam = webcamDeviceId;
      this.state.selectedMicrophone = microphoneDeviceId || null;
      this.state.chunks = [];

      // Generate output file path
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .split("T")
        .join("-")
        .split("Z")[0];
      const filename = `webcam-recording-${timestamp}.webm`;
      this.state.outputPath = join(this.recordingsDir, filename);

      return { success: true };
    } catch (error) {
      console.error("Error starting webcam recording:", error);
      this.state.isRecording = false;
      this.state.recordingStartTime = null;
      this.state.recordingMode = null;
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to start webcam recording",
      };
    }
  }

  /**
   * Stop screen recording and save the file
   */
  async stopRecording(): Promise<{ filePath: string }> {
    if (!this.state.isRecording) {
      throw new Error("No recording in progress");
    }

    try {
      // The MediaRecorder will be stopped in the renderer process
      // This method will be called after the chunks are accumulated
      this.state.isRecording = false;
      this.state.recordingStartTime = null;
      this.state.recordingMode = null;
      this.state.mediaRecorder = null;

      const filePath = this.state.outputPath || "";
      
      // Reset state
      this.state.selectedSource = null;
      this.state.selectedWebcam = null;
      this.state.selectedMicrophone = null;
      this.state.outputPath = null;
      this.state.chunks = [];

      return { filePath };
    } catch (error) {
      console.error("Error stopping recording:", error);
      this.state.isRecording = false;
      this.state.recordingStartTime = null;
      throw new Error("Failed to stop recording");
    }
  }

  /**
   * Save recorded chunks to file
   */
  async saveRecording(chunks: Uint8Array[]): Promise<string> {
    if (!this.state.outputPath) {
      throw new Error("No output path specified");
    }

    try {
      // Combine all chunks into a single buffer
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const combinedBuffer = new Uint8Array(totalLength);
      
      let offset = 0;
      for (const chunk of chunks) {
        combinedBuffer.set(chunk, offset);
        offset += chunk.length;
      }

      // Write to temporary file first
      const tempPath = this.state.outputPath + ".tmp";
      await writeFile(tempPath, Buffer.from(combinedBuffer));
      
      // Fix WebM duration metadata using FFmpeg (re-mux without re-encoding)
      try {
        await ffmpegService.fixWebMDuration(tempPath, this.state.outputPath);
        
        // Delete temporary file
        await fs.unlink(tempPath);
      } catch (error) {
        console.error("Failed to fix WebM duration, using original file:", error);
        // If fixing fails, just rename the temp file to final path
        await fs.rename(tempPath, this.state.outputPath);
      }
      
      return this.state.outputPath;
    } catch (error) {
      console.error("Error saving recording:", error);
      throw new Error("Failed to save recording");
    }
  }

  /**
   * Get current recording state
   */
  getRecordingState(): {
    isRecording: boolean;
    duration: number | null;
    outputPath: string | null;
  } {
    return {
      isRecording: this.state.isRecording,
      duration: this.state.recordingStartTime
        ? Date.now() - this.state.recordingStartTime
        : null,
      outputPath: this.state.outputPath,
    };
  }

  /**
   * Clean up failed recordings
   */
  async cleanupFailedRecording(): Promise<void> {
    if (this.state.outputPath) {
      try {
        await fs.unlink(this.state.outputPath);
      } catch (error) {
        console.error("Error cleaning up failed recording:", error);
      }
    }

    this.state.isRecording = false;
    this.state.recordingStartTime = null;
    this.state.recordingMode = null;
    this.state.selectedSource = null;
    this.state.selectedWebcam = null;
    this.state.selectedMicrophone = null;
    this.state.outputPath = null;
    this.state.mediaRecorder = null;
    this.state.chunks = [];
  }
}

// Singleton instance
export const recordingService = new RecordingService();


