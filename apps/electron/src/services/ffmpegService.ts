import { spawn, ChildProcess } from "child_process";
import { join } from "path";
import { app } from "electron";
import { promises as fs } from "fs";
import {
  ExportSettings,
  VideoClip,
  Timeline,
  TimelineClip,
} from "@clipforge/shared";

export class FFmpegService {
  private ffmpegPath: string;
  private ffprobePath: string;
  private activeProcess: ChildProcess | null = null;

  constructor() {
    // Set FFmpeg binary paths
    const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

    if (isDev) {
      // Development: use binaries from bin directory
      this.ffmpegPath = join(__dirname, "../../bin/ffmpeg");
      this.ffprobePath = join(__dirname, "../../bin/ffprobe");
    } else {
      // Production: use bundled binaries
      this.ffmpegPath = join(process.resourcesPath, "bin/ffmpeg");
      this.ffprobePath = join(process.resourcesPath, "bin/ffprobe");
    }
  }

  /**
   * Check if FFmpeg binaries are accessible
   */
  async checkFFmpegAvailability(): Promise<boolean> {
    try {
      await this.runCommand(this.ffmpegPath, ["-version"]);
      await this.runCommand(this.ffprobePath, ["-version"]);
      return true;
    } catch (error) {
      console.error("FFmpeg not available:", error);
      return false;
    }
  }

  /**
   * Extract video metadata using FFprobe
   */
  async extractVideoMetadata(videoPath: string): Promise<{
    duration: number;
    width: number;
    height: number;
    fps: number;
    bitrate?: number;
    codec?: string;
    hasAudio: boolean;
  }> {
    const args = [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      videoPath,
    ];

    try {
      const output = await this.runCommand(this.ffprobePath, args);
      const data = JSON.parse(output);

      const videoStream = data.streams.find(
        (stream: any) => stream.codec_type === "video"
      );
      const audioStream = data.streams.find(
        (stream: any) => stream.codec_type === "audio"
      );

      if (!videoStream) {
        throw new Error("No video stream found in file");
      }

      return {
        duration: parseFloat(data.format.duration) || 0,
        width: parseInt(videoStream.width) || 0,
        height: parseInt(videoStream.height) || 0,
        fps: this.parseFPS(videoStream.r_frame_rate) || 0,
        bitrate: parseInt(data.format.bit_rate) || undefined,
        codec: videoStream.codec_name,
        hasAudio: !!audioStream,
      };
    } catch (error) {
      console.error("Error extracting video metadata:", error);
      throw new Error(`Failed to extract metadata from ${videoPath}: ${error}`);
    }
  }

  /**
   * Generate thumbnail from video
   */
  async generateThumbnail(
    videoPath: string,
    outputPath: string,
    timestamp: number = 1
  ): Promise<void> {
    const args = [
      "-i",
      videoPath,
      "-ss",
      timestamp.toString(),
      "-vframes",
      "1",
      "-q:v",
      "2",
      "-y", // Overwrite output file
      outputPath,
    ];

    try {
      await this.runCommand(this.ffmpegPath, args);
    } catch (error) {
      console.error("Error generating thumbnail:", error);
      throw new Error(`Failed to generate thumbnail: ${error}`);
    }
  }

  /**
   * Trim video file
   */
  async trimVideo(
    inputPath: string,
    outputPath: string,
    startTime: number,
    endTime: number
  ): Promise<void> {
    const duration = endTime - startTime;

    const args = [
      "-i",
      inputPath,
      "-ss",
      startTime.toString(),
      "-t",
      duration.toString(),
      "-c",
      "copy", // Copy streams without re-encoding
      "-y", // Overwrite output file
      outputPath,
    ];

    try {
      await this.runCommand(this.ffmpegPath, args);
    } catch (error) {
      console.error("Error trimming video:", error);
      throw new Error(`Failed to trim video: ${error}`);
    }
  }

  /**
   * Export timeline to video file
   * Handles multiple clips arranged on the timeline
   */
  async exportTimeline(
    timeline: Timeline,
    clips: VideoClip[],
    outputPath: string,
    settings: ExportSettings,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    // Get all video clips from the first video track
    const videoTrack = timeline.tracks.find((track) => track.type === "video");
    if (!videoTrack || videoTrack.clips.length === 0) {
      throw new Error("No video clips found on timeline");
    }

    // Sort clips by start time
    const sortedClips = [...videoTrack.clips].sort(
      (a, b) => a.startTime - b.startTime
    );

    // If there's only one clip, use simple export
    if (sortedClips.length === 1) {
      const timelineClip = sortedClips[0];
      const sourceClip = clips.find((c) => c.id === timelineClip.videoClipId);
      if (!sourceClip) {
        throw new Error("Source clip not found");
      }

      return this.exportSingleClip(
        sourceClip,
        timelineClip.trimStart,
        timelineClip.trimEnd,
        outputPath,
        settings,
        onProgress
      );
    }

    // For multiple clips, we need to use FFmpeg concat
    return this.exportMultipleClips(
      sortedClips,
      clips,
      outputPath,
      settings,
      onProgress
    );
  }

  /**
   * Export a single clip with trim points
   */
  private async exportSingleClip(
    clip: VideoClip,
    trimStart: number,
    trimEnd: number,
    outputPath: string,
    settings: ExportSettings,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    const duration = trimEnd - trimStart;

    // Build FFmpeg arguments based on settings
    const args = [
      "-i",
      clip.filePath,
      "-ss",
      trimStart.toString(),
      "-t",
      duration.toString(),
    ];

    // Add resolution scaling if needed
    if (settings.resolution !== "source") {
      const resolutionMap = {
        "720p": "1280:720",
        "1080p": "1920:1080",
      };
      args.push("-vf", `scale=${resolutionMap[settings.resolution]}`);
    }

    // Add quality settings - using CRF for quality control
    const qualityMap = {
      low: { crf: "28", preset: "veryfast" },
      medium: { crf: "23", preset: "medium" },
      high: { crf: "18", preset: "slow" },
    };
    const quality = qualityMap[settings.quality];

    args.push(
      "-c:v",
      "libx264",
      "-crf",
      quality.crf,
      "-preset",
      quality.preset,
      "-c:a",
      "aac",
      "-b:a",
      `${settings.audioBitrate}k`,
      "-r",
      settings.fps.toString(),
      "-movflags",
      "+faststart", // Optimize for streaming
      "-y", // Overwrite output file
      outputPath
    );

    try {
      await this.runCommandWithProgress(
        this.ffmpegPath,
        args,
        duration,
        onProgress
      );
    } catch (error) {
      console.error("Error exporting video:", error);
      throw new Error(`Failed to export video: ${error}`);
    }
  }

  /**
   * Export multiple clips as a concatenated video
   */
  private async exportMultipleClips(
    timelineClips: TimelineClip[],
    sourceClips: VideoClip[],
    outputPath: string,
    settings: ExportSettings,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    const { app } = require("electron");
    const tempDir = app.getPath("temp");
    const tempFiles: string[] = [];
    const concatListPath = join(tempDir, `concat_list_${Date.now()}.txt`);

    try {
      // Step 1: Process each clip segment
      for (let i = 0; i < timelineClips.length; i++) {
        const timelineClip = timelineClips[i];
        const sourceClip = sourceClips.find(
          (c) => c.id === timelineClip.videoClipId
        );

        if (!sourceClip) {
          throw new Error(`Source clip ${timelineClip.videoClipId} not found`);
        }

        const tempOutput = join(tempDir, `temp_clip_${i}_${Date.now()}.mp4`);
        tempFiles.push(tempOutput);

        // Export each segment with consistent encoding
        await this.exportSingleClip(
          sourceClip,
          timelineClip.trimStart,
          timelineClip.trimEnd,
          tempOutput,
          settings,
          (progress) => {
            // Calculate overall progress (each clip is a fraction of total)
            const overallProgress =
              ((i + progress / 100) / timelineClips.length) * 90; // 90% for processing clips
            if (onProgress) onProgress(overallProgress);
          }
        );
      }

      // Step 2: Create concat list file
      const concatList = tempFiles.map((file) => `file '${file}'`).join("\n");
      await fs.writeFile(concatListPath, concatList, "utf-8");

      // Step 3: Concatenate all clips
      const concatArgs = [
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatListPath,
        "-c",
        "copy", // Copy streams without re-encoding
        "-y",
        outputPath,
      ];

      await this.runCommand(this.ffmpegPath, concatArgs);

      if (onProgress) onProgress(100);
    } finally {
      // Cleanup temporary files
      for (const tempFile of tempFiles) {
        try {
          await fs.unlink(tempFile);
        } catch (error) {
          console.error(`Failed to delete temp file ${tempFile}:`, error);
        }
      }

      try {
        await fs.unlink(concatListPath);
      } catch (error) {
        console.error(`Failed to delete concat list:`, error);
      }
    }
  }

  /**
   * Cancel active FFmpeg process
   */
  cancelExport(): void {
    if (this.activeProcess) {
      this.activeProcess.kill("SIGTERM");
      this.activeProcess = null;
    }
  }

  /**
   * Run FFmpeg command and return output
   */
  private async runCommand(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args);

      let stdout = "";
      let stderr = "";

      process.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      process.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      process.on("close", (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      process.on("error", (error) => {
        reject(new Error(`Failed to start process: ${error.message}`));
      });
    });
  }

  /**
   * Run FFmpeg command with progress tracking
   */
  private async runCommandWithProgress(
    command: string,
    args: string[],
    totalDuration: number,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      this.activeProcess = spawn(command, args);

      let stdout = "";
      let stderr = "";

      this.activeProcess.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      this.activeProcess.stderr?.on("data", (data) => {
        const output = data.toString();
        stderr += output;

        // Parse FFmpeg progress from stderr (FFmpeg outputs progress to stderr)
        if (onProgress) {
          const timeMatch = output.match(/time=(\d+):(\d+):(\d+\.\d+)/);
          if (timeMatch) {
            const hours = parseInt(timeMatch[1]);
            const minutes = parseInt(timeMatch[2]);
            const seconds = parseFloat(timeMatch[3]);
            const currentTime = hours * 3600 + minutes * 60 + seconds;
            const progress = Math.min(100, (currentTime / totalDuration) * 100);
            onProgress(progress);
          }
        }
      });

      this.activeProcess.on("close", (code) => {
        this.activeProcess = null;
        if (code === 0) {
          if (onProgress) onProgress(100);
          resolve(stdout);
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      this.activeProcess.on("error", (error) => {
        this.activeProcess = null;
        reject(new Error(`Failed to start process: ${error.message}`));
      });
    });
  }

  /**
   * Parse FPS from FFprobe output
   */
  private parseFPS(frameRate: string): number {
    if (!frameRate || frameRate === "0/0") {
      return 0;
    }

    const parts = frameRate.split("/");
    if (parts.length === 2) {
      const numerator = parseFloat(parts[0]);
      const denominator = parseFloat(parts[1]);
      return denominator !== 0 ? numerator / denominator : 0;
    }

    return parseFloat(frameRate) || 0;
  }

  /**
   * Fix WebM duration metadata by re-muxing the file
   * This is needed because browser MediaRecorder doesn't write duration properly
   */
  async fixWebMDuration(inputPath: string, outputPath: string): Promise<void> {
    const args = [
      "-i",
      inputPath,
      "-c",
      "copy", // Copy without re-encoding (fast)
      "-y", // Overwrite output
      outputPath,
    ];

    try {
      await this.runCommand(this.ffmpegPath, args);
    } catch (error) {
      console.error("Error fixing WebM duration:", error);
      throw new Error(`Failed to fix WebM duration: ${error}`);
    }
  }
}

export const ffmpegService = new FFmpegService();
