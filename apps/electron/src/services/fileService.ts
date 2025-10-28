import { promises as fs } from "fs";
import { join, extname, basename } from "path";
import { app } from "electron";
import { VideoClip } from "@clipforge/shared";
import { ffmpegService } from "./ffmpegService";

export class FileService {
  private readonly SUPPORTED_EXTENSIONS = [".mp4", ".mov", ".webm"];
  private readonly SUPPORTED_MIME_TYPES = [
    "video/mp4",
    "video/quicktime",
    "video/webm",
  ];

  /**
   * Validates if a file is a supported video format
   */
  async validateVideoFile(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        return false;
      }

      const extension = extname(filePath).toLowerCase();
      return this.SUPPORTED_EXTENSIONS.includes(extension);
    } catch (error) {
      console.error("Error validating video file:", error);
      return false;
    }
  }

  /**
   * Extracts basic metadata from a video file using FFmpeg
   */
  async extractVideoMetadata(filePath: string): Promise<Partial<VideoClip>> {
    try {
      const fileName = basename(filePath);

      // Check if FFmpeg is available
      const ffmpegAvailable = await ffmpegService.checkFFmpegAvailability();

      if (!ffmpegAvailable) {
        console.warn("FFmpeg not available, using basic metadata");
        return {
          filePath,
          name: fileName,
          duration: 0,
          width: 0,
          height: 0,
          fps: 0,
          trimStart: 0,
          trimEnd: 0,
          thumbnailPath: "",
        };
      }

      // Extract metadata using FFmpeg
      const metadata = await ffmpegService.extractVideoMetadata(filePath);

      // Generate thumbnail
      const thumbnailPath = await this.generateThumbnailPath(filePath);
      try {
        await ffmpegService.generateThumbnail(filePath, thumbnailPath);
      } catch (error) {
        console.warn("Failed to generate thumbnail:", error);
      }

      return {
        filePath,
        name: fileName,
        duration: metadata.duration,
        width: metadata.width,
        height: metadata.height,
        fps: metadata.fps,
        trimStart: 0,
        trimEnd: metadata.duration,
        thumbnailPath,
      };
    } catch (error) {
      console.error("Error extracting video metadata:", error);
      throw new Error(`Failed to extract metadata from ${filePath}`);
    }
  }

  /**
   * Creates a VideoClip object from a file path
   */
  async createVideoClip(filePath: string): Promise<VideoClip> {
    const isValid = await this.validateVideoFile(filePath);
    if (!isValid) {
      throw new Error(`Unsupported video format: ${filePath}`);
    }

    const metadata = await this.extractVideoMetadata(filePath);

    const clip: VideoClip = {
      id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      filePath: metadata.filePath!,
      name: metadata.name!,
      duration: metadata.duration!,
      width: metadata.width!,
      height: metadata.height!,
      fps: metadata.fps!,
      trimStart: metadata.trimStart!,
      trimEnd: metadata.trimEnd!,
      thumbnailPath: metadata.thumbnailPath!,
    };

    return clip;
  }

  /**
   * Creates a temporary file from a buffer (for drag and drop)
   */
  async createTempFileFromBuffer(
    buffer: Buffer,
    fileName: string
  ): Promise<string> {
    const userDataPath = this.getUserDataPath();
    const tempDir = join(userDataPath, "temp");

    // Ensure temp directory exists
    await fs.mkdir(tempDir, { recursive: true });

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    const tempFileName = `temp-${timestamp}-${randomId}-${fileName}`;
    const tempFilePath = join(tempDir, tempFileName);

    // Write buffer to file
    await fs.writeFile(tempFilePath, buffer);

    return tempFilePath;
  }

  /**
   * Gets the user data directory path
   */
  getUserDataPath(): string {
    return app.getPath("userData");
  }

  /**
   * Creates necessary directories for the application
   */
  async ensureDirectoriesExist(): Promise<void> {
    const userDataPath = this.getUserDataPath();
    const directories = [
      join(userDataPath, "projects"),
      join(userDataPath, "thumbnails"),
      join(userDataPath, "temp"),
      join(userDataPath, "recordings"),
    ];

    for (const dir of directories) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        console.error(`Error creating directory ${dir}:`, error);
        throw new Error(`Failed to create directory: ${dir}`);
      }
    }
  }

  /**
   * Checks if a file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gets file size in bytes
   */
  async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch (error) {
      console.error("Error getting file size:", error);
      throw new Error(`Failed to get file size: ${filePath}`);
    }
  }

  /**
   * Generates thumbnail path for a video file
   */
  private async generateThumbnailPath(videoPath: string): Promise<string> {
    const userDataPath = this.getUserDataPath();
    const thumbnailsDir = join(userDataPath, "thumbnails");

    // Ensure thumbnails directory exists
    await fs.mkdir(thumbnailsDir, { recursive: true });

    // Generate unique filename based on video path
    const videoName = basename(videoPath, extname(videoPath));
    const timestamp = Date.now();
    const thumbnailName = `${videoName}-${timestamp}.jpg`;

    return join(thumbnailsDir, thumbnailName);
  }
}

export const fileService = new FileService();
