import { ipcMain, dialog } from "electron";
import { fileService } from "../services/fileService";
import { ffmpegService } from "../services/ffmpegService";
import {
  VideoClip,
  FileCommands,
  FileEvents,
  VideoEvents,
  ExportSettings,
  Timeline,
} from "@clipforge/shared";

export class IPCHandlers {
  private mainWindow: Electron.BrowserWindow | null = null;

  constructor(mainWindow: Electron.BrowserWindow) {
    this.mainWindow = mainWindow;
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // File import handler
    ipcMain.handle(
      "import-video",
      async (event, data: FileCommands["import-video"]) => {
        try {
          const { filePath } = data;

          // Validate file
          const isValid = await fileService.validateVideoFile(filePath);
          if (!isValid) {
            throw new Error(
              "Unsupported video format. Please use MP4, MOV, or WebM files."
            );
          }

          // Create video clip
          const clip = await fileService.createVideoClip(filePath);

          // Return the clip directly
          return clip;
        } catch (error) {
          throw error;
        }
      }
    );

    // File import from buffer handler (for drag and drop)
    ipcMain.handle(
      "import-video-from-buffer",
      async (
        event,
        data: { fileName: string; mimeType: string; buffer: Uint8Array }
      ) => {
        try {
          const { fileName, mimeType, buffer } = data;

          // Convert Uint8Array to Buffer for file operations
          const fileBuffer = Buffer.from(buffer);

          // Create a temporary file from the buffer
          const tempFilePath = await fileService.createTempFileFromBuffer(
            fileBuffer,
            fileName
          );

          // Validate file
          const isValid = await fileService.validateVideoFile(tempFilePath);
          if (!isValid) {
            throw new Error(
              "Unsupported video format. Please use MP4, MOV, or WebM files."
            );
          }

          // Create video clip
          const clip = await fileService.createVideoClip(tempFilePath);

          // Return the clip directly
          return clip;
        } catch (error) {
          throw error;
        }
      }
    );

    // Native file picker handler
    ipcMain.handle("open-file-dialog", async () => {
      try {
        const result = await dialog.showOpenDialog(this.mainWindow!, {
          title: "Import Video Files",
          filters: [
            {
              name: "Video Files",
              extensions: ["mp4", "mov", "webm"],
            },
            {
              name: "All Files",
              extensions: ["*"],
            },
          ],
          properties: ["openFile", "multiSelections"],
        });

        if (result.canceled) {
          return { canceled: true };
        }

        return {
          canceled: false,
          filePaths: result.filePaths,
        };
      } catch (error) {
        console.error("Error opening file dialog:", error);
        throw error;
      }
    });

    // Save dialog handler for export
    ipcMain.handle(
      "show-save-dialog",
      async (
        event,
        options: {
          title: string;
          defaultPath: string;
          filters: Array<{ name: string; extensions: string[] }>;
        }
      ) => {
        try {
          const result = await dialog.showSaveDialog(this.mainWindow!, {
            title: options.title,
            defaultPath: options.defaultPath,
            filters: options.filters,
          });

          if (result.canceled) {
            return { canceled: true };
          }

          return {
            canceled: false,
            filePath: result.filePath,
          };
        } catch (error) {
          console.error("Error showing save dialog:", error);
          throw error;
        }
      }
    );

    // Video export handler
    ipcMain.handle(
      "export-video",
      async (
        event,
        data: {
          timeline: Timeline;
          clips: VideoClip[];
          outputPath: string;
          settings: ExportSettings;
        }
      ) => {
        try {
          const { timeline, clips, outputPath, settings } = data;

          // Export timeline with progress tracking
          await ffmpegService.exportTimeline(
            timeline,
            clips,
            outputPath,
            settings,
            (progress) => {
              // Send progress update to renderer
              this.sendVideoEvent("video-processing-progress", { progress });
            }
          );

          // Send completion event
          this.sendVideoEvent("video-processed", { outputPath });
        } catch (error) {
          console.error("Error exporting video:", error);
          this.sendVideoError(
            "video-processing-error",
            error instanceof Error ? error.message : "Failed to export video"
          );
        }
      }
    );

    // Project save handler
    ipcMain.handle(
      "save-project",
      async (event, data: FileCommands["save-project"]) => {
        try {
          const { project } = data;
          // TODO: Implement project saving logic
          this.sendEvent("project-saved", { success: true });
        } catch (error) {
          console.error("Error saving project:", error);
          this.sendError(
            "project-save-error",
            error instanceof Error ? error.message : "Failed to save project"
          );
        }
      }
    );

    // Project load handler
    ipcMain.handle(
      "load-project",
      async (event, data: FileCommands["load-project"]) => {
        try {
          const { filePath } = data;
          // TODO: Implement project loading logic
          // For now, return a mock project
          const mockProject = {
            id: "mock-project",
            name: "Mock Project",
            createdAt: new Date(),
            modifiedAt: new Date(),
            timeline: {
              duration: 0,
              playheadPosition: 0,
              zoomLevel: 1,
              tracks: [],
              snapToGrid: true,
              gridSize: 1,
            },
            exportSettings: {
              resolution: "1080p" as const,
              quality: "high" as const,
              format: "mp4" as const,
              fps: 30,
              bitrate: 5000,
              audioBitrate: 128,
            },
          };

          this.sendEvent("project-loaded", { project: mockProject });
        } catch (error) {
          console.error("Error loading project:", error);
          this.sendError(
            "project-load-error",
            error instanceof Error ? error.message : "Failed to load project"
          );
        }
      }
    );
  }

  private sendEvent<K extends keyof FileEvents>(
    event: K,
    data: FileEvents[K]
  ): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send(event as string, data);
    }
  }

  private sendVideoEvent<K extends keyof VideoEvents>(
    event: K,
    data: VideoEvents[K]
  ): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send(event as string, data);
    }
  }

  private sendError(event: string, error: string): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send(event, { error });
    }
  }

  private sendVideoError(event: string, error: string): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send(event, { error });
    }
  }
}
