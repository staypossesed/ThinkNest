import "dotenv/config";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import { askQuestion } from "./orchestrator";
import { AskRequest } from "../shared/types";
import { backendClient, isDevMode } from "./backend";

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  const preloadPath = path.join(__dirname, "preload.js");
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    const indexPath = path.join(__dirname, "../renderer/index.html");
    mainWindow.loadFile(indexPath);
  }
}

app.whenReady().then(() => {
  backendClient.init().catch(() => {
    // Ignore session init failures and continue with fresh session.
  });

  ipcMain.handle("ask", async (event, payload: AskRequest) => {
    const onAnswer = (answer: import("../shared/types").AgentAnswer) => {
      event.sender.send("ask:answer", answer);
    };
    return askQuestion(payload, onAnswer);
  });
  ipcMain.handle("auth:get-session", async () => backendClient.getSession());
  ipcMain.handle("isDevMode", () => isDevMode);
  ipcMain.handle("auth:google-login", async () => backendClient.loginWithGoogle());
  ipcMain.handle("auth:logout", async () => {
    await backendClient.logout();
    return { ok: true };
  });
  ipcMain.handle("entitlements:get", async () => backendClient.getEntitlements());
  ipcMain.handle("usage:can-ask", async () => backendClient.canAsk());
  ipcMain.handle("usage:consume", async (_event, question: string) =>
    backendClient.consumeUsage(question)
  );
  ipcMain.handle("billing:checkout", async () => {
    const url = await backendClient.createCheckoutUrl();
    await shell.openExternal(url);
    return { ok: true };
  });
  ipcMain.handle("billing:portal", async () => {
    const url = await backendClient.createPortalUrl();
    await shell.openExternal(url);
    return { ok: true };
  });

  createWindow();

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
