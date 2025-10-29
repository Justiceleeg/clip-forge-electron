import {
  VideoClip,
  Project,
  FileEvents,
  ExportSettings,
} from "@clipforge/shared";

// Type-safe IPC communication with Electron main process
export class ElectronService {
  private isElectron: boolean;

  constructor() {
    // Check for Electron environment using the exposed API
    this.isElectron =
      typeof window !== "undefined" && !!(window as any).electronAPI;
  }

  /**
   * Import a video file using native file picker
   */
  async openFileDialog(): Promise<{ canceled: boolean; filePaths?: string[] }> {
    if (!this.isElectron) {
      throw new Error("Electron service not available in web environment");
    }

    try {
      return await (window as any).electronAPI.openFileDialog();
    } catch (error) {
      console.error("Error opening file dialog:", error);
      throw error;
    }
  }

  /**
   * Show save dialog for export
   */
  async showSaveDialog(options: {
    title: string;
    defaultPath: string;
    filters: Array<{ name: string; extensions: string[] }>;
  }): Promise<{ canceled: boolean; filePath?: string }> {
    if (!this.isElectron) {
      throw new Error("Electron service not available in web environment");
    }

    try {
      return await (window as any).electronAPI.showSaveDialog(options);
    } catch (error) {
      console.error("Error showing save dialog:", error);
      throw error;
    }
  }

  /**
   * Import a video file by File object (for drag and drop)
   */
  async importVideoFromFile(file: File): Promise<VideoClip> {
    if (!this.isElectron) {
      throw new Error("Electron service not available in web environment");
    }

    try {
      // Convert File to ArrayBuffer, then to Uint8Array for IPC
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Send the file data to the main process
      const result = await (window as any).electronAPI.importVideoFromBuffer({
        fileName: file.name,
        mimeType: file.type,
        buffer: uint8Array,
      });
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Import a video file by file path
   */
  async importVideo(filePath: string): Promise<VideoClip> {
    if (!this.isElectron) {
      throw new Error("Electron service not available in web environment");
    }

    try {
      const result = await (window as any).electronAPI.importVideo(filePath);
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Save a project
   */
  async saveProject(project: Project): Promise<void> {
    if (!this.isElectron) {
      throw new Error("Electron service not available in web environment");
    }

    return new Promise((resolve, reject) => {
      const handleSuccess = () => {
        (window as any).electronAPI.removeAllListeners("project-saved");
        (window as any).electronAPI.removeAllListeners("project-save-error");
        resolve();
      };

      const handleError = (_event: any, data: { error: string }) => {
        (window as any).electronAPI.removeAllListeners("project-saved");
        (window as any).electronAPI.removeAllListeners("project-save-error");
        reject(new Error(data.error));
      };

      (window as any).electronAPI.onProjectSaved(handleSuccess);
      (window as any).electronAPI.onProjectLoadError(handleError);

      (window as any).electronAPI.sendSaveProject(project);
    });
  }

  /**
   * Load a project
   */
  async loadProject(filePath: string): Promise<Project> {
    if (!this.isElectron) {
      throw new Error("Electron service not available in web environment");
    }

    return new Promise((resolve, reject) => {
      const handleSuccess = (
        _event: any,
        data: FileEvents["project-loaded"]
      ) => {
        (window as any).electronAPI.removeAllListeners("project-loaded");
        (window as any).electronAPI.removeAllListeners("project-load-error");
        resolve(data.project);
      };

      const handleError = (_event: any, data: { error: string }) => {
        (window as any).electronAPI.removeAllListeners("project-loaded");
        (window as any).electronAPI.removeAllListeners("project-load-error");
        reject(new Error(data.error));
      };

      (window as any).electronAPI.onProjectLoaded(handleSuccess);
      (window as any).electronAPI.onProjectLoadError(handleError);

      (window as any).electronAPI.sendLoadProject(filePath);
    });
  }

  /**
   * Export timeline with progress tracking
   */
  async exportTimeline(
    timeline: any,
    clips: any[],
    outputPath: string,
    settings: ExportSettings,
    onProgress?: (progress: number, status: string) => void
  ): Promise<void> {
    if (!this.isElectron) {
      throw new Error("Electron service not available in web environment");
    }

    // Set up progress listener before invoking
    if (onProgress) {
      const progressHandler = (_event: any, data: { progress: number }) => {
        onProgress(data.progress, "Exporting...");
      };
      (window as any).electronAPI.onVideoProcessingProgress(progressHandler);
    }

    // Set up completion/error listeners
    const successHandler = (_event: any, _data: { outputPath: string }) => {
      (window as any).electronAPI.removeAllListeners("video-processed");
      (window as any).electronAPI.removeAllListeners("video-processing-error");
      (window as any).electronAPI.removeAllListeners(
        "video-processing-progress"
      );
    };

    const errorHandler = (_event: any, data: { error: string }) => {
      (window as any).electronAPI.removeAllListeners("video-processed");
      (window as any).electronAPI.removeAllListeners("video-processing-error");
      (window as any).electronAPI.removeAllListeners(
        "video-processing-progress"
      );
    };

    (window as any).electronAPI.onVideoProcessed(successHandler);
    (window as any).electronAPI.onVideoProcessingError(errorHandler);

    try {
      // Use invoke to call the handler - this will wait for completion
      await (window as any).electronAPI.exportVideo({
        timeline,
        clips,
        outputPath,
        settings,
      });
    } catch (error) {
      // Clean up listeners on error
      (window as any).electronAPI.removeAllListeners("video-processed");
      (window as any).electronAPI.removeAllListeners("video-processing-error");
      (window as any).electronAPI.removeAllListeners(
        "video-processing-progress"
      );
      throw error;
    }
  }

  /**
   * Check if running in Electron environment
   */
  isElectronEnvironment(): boolean {
    return this.isElectron;
  }
}

export const electronService = new ElectronService();
