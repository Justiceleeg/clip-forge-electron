import { VideoClip, Project, FileEvents } from "@clipforge/shared";

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
   * Check if running in Electron environment
   */
  isElectronEnvironment(): boolean {
    return this.isElectron;
  }
}

export const electronService = new ElectronService();
