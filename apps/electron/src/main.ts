import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "path";
import { IPCHandlers } from "./handlers/ipcHandlers";
import { fileService } from "./services/fileService";

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

let mainWindow: BrowserWindow;
let ipcHandlers: IPCHandlers;

function createWindow(): void {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, "preload.js"),
      webSecurity: false, // Allow local file access for video playback
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      // Enable file access for drag and drop
      sandbox: false,
    },
    titleBarStyle: "default",
    show: false,
  });

  // Load the app
  if (isDev) {
    // Load from Vite dev server
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  // Show window when ready
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Handle window closed
  mainWindow.on("closed", () => {
    mainWindow = null as any;
  });
}

// App event handlers
app.whenReady().then(async () => {
  // Ensure directories exist
  await fileService.ensureDirectoriesExist();

  createWindow();

  // Initialize IPC handlers
  ipcHandlers = new IPCHandlers(mainWindow);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// IPC handlers
ipcMain.handle("app-version", () => {
  return app.getVersion();
});

ipcMain.handle("app-name", () => {
  return app.getName();
});
