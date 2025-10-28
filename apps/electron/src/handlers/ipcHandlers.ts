import { ipcMain, dialog } from "electron";
import { fileService } from "../services/fileService";
import { VideoClip, FileCommands, FileEvents } from "@clipforge/shared";

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

  private sendError(event: string, error: string): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send(event, { error });
    }
  }
}
