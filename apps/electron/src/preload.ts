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
  showSaveDialog: (options: {
    title: string;
    defaultPath: string;
    filters: Array<{ name: string; extensions: string[] }>;
  }) => ipcRenderer.invoke("show-save-dialog", options),
  saveProject: (project: any) =>
    ipcRenderer.invoke("save-project", { project }),
  loadProject: (filePath: string) =>
    ipcRenderer.invoke("load-project", { filePath }),

  // Video export
  exportVideo: (data: {
    timeline: any;
    clips: any[];
    outputPath: string;
    settings: any;
  }) => ipcRenderer.invoke("export-video", data),

  // Recording operations
  getScreenSources: () => ipcRenderer.invoke("get-screen-sources"),
  startScreenRecording: (data: { 
    sourceId: string; 
    includeAudio?: boolean;
    microphoneDeviceId?: string;
  }) =>
    ipcRenderer.invoke("start-screen-recording", data),
  startWebcamRecording: (data: {
    webcamDeviceId: string;
    microphoneDeviceId?: string;
  }) =>
    ipcRenderer.invoke("start-webcam-recording", data),
  stopRecording: () => ipcRenderer.invoke("stop-recording"),
  saveRecording: (chunks: Uint8Array[]) =>
    ipcRenderer.invoke("save-recording", { chunks }),
  getRecordingState: () => ipcRenderer.invoke("get-recording-state"),

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
  onVideoProcessed: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on("video-processed", callback);
  },
  onVideoProcessingProgress: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on("video-processing-progress", callback);
  },
  onVideoProcessingError: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on("video-processing-error", callback);
  },

  // Recording event listeners
  onRecordingStarted: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on("recording-started", callback);
  },
  onRecordingStopped: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on("recording-stopped", callback);
  },
  onRecordingError: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on("recording-error", callback);
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
  sendExportVideo: (data: {
    timeline: any;
    clips: any[];
    outputPath: string;
    settings: any;
  }) => {
    ipcRenderer.send("export-video", data);
  },
});
