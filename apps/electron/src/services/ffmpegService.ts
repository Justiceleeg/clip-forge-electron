import { spawn } from "child_process";
import { join } from "path";
import { app } from "electron";
import { promises as fs } from "fs";

export class FFmpegService {
  private ffmpegPath: string;
  private ffprobePath: string;

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
}

export const ffmpegService = new FFmpegService();
