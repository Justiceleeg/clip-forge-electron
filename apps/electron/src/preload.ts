import { contextBridge, ipcRenderer } from "electron";

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  // File operations
  importVideo: async (filePath: string) => {
    try {
      const result = await ipcRenderer.invoke("import-video", { filePath });
      return result;
    } catch (error) {
      throw error;
    }
  },
  importVideoFromBuffer: async (fileData: {
    fileName: string;
    mimeType: string;
    buffer: Uint8Array;
  }) => {
    try {
      const result = await ipcRenderer.invoke(
        "import-video-from-buffer",
        fileData
      );
      return result;
    } catch (error) {
      throw error;
    }
  },
  openFileDialog: () => ipcRenderer.invoke("open-file-dialog"),
  saveProject: (project: any) =>
    ipcRenderer.invoke("save-project", { project }),
  loadProject: (filePath: string) =>
    ipcRenderer.invoke("load-project", { filePath }),

  // Event listeners
  onFileImported: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on("file-imported", callback);
  },
  onFileImportError: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on("file-import-error", callback);
  },
  onProjectSaved: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on("project-saved", callback);
  },
  onProjectLoadError: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on("project-load-error", callback);
  },
  onProjectLoaded: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on("project-loaded", callback);
  },

  // Remove listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },

  // Send events
  sendImportVideo: (filePath: string) => {
    ipcRenderer.send("import-video", { filePath });
  },
  sendSaveProject: (project: any) => {
    ipcRenderer.send("save-project", { project });
  },
  sendLoadProject: (filePath: string) => {
    ipcRenderer.send("load-project", { filePath });
  },
});
