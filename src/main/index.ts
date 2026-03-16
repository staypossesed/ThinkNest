import "dotenv/config";
import dotenv from "dotenv";
import path from "node:path";
import { app, BrowserWindow, ipcMain, shell } from "electron";

// Web search (SERPER_API_KEY) может быть в backend/.env
const backendEnv = path.join(process.cwd(), "backend", ".env");
dotenv.config({ path: backendEnv });

import { askQuestion } from "./orchestrator";
import { AskRequest } from "../shared/types";
import { backendClient, isDevMode } from "./backend";
import { setAskLocale, clearAskLocale, beginAsk, updateAskLocaleIfActive, stopAsk, getAskSignal } from "./askContext";
import {
  checkOllamaStatus,
  startOllamaServer,
  pullModel,
  type HardwareProfile
} from "./ollamaInstaller";

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

  if (isDevMode) {
    checkOllamaStatus().then(({ installed, running }) => {
      if (installed && !running) {
        startOllamaServer();
      }
    });
  }

  ipcMain.handle("ask", async (event, payload: AskRequest) => {
    setAskLocale(payload.preferredLocale ?? "ru");
    beginAsk();
    const onAnswer = (answer: import("../shared/types").AgentAnswer) => {
      event.sender.send("ask:answer", answer);
    };
    const onToken = (agentId: string, token: string) => {
      event.sender.send("ask:token", { agentId, token });
    };

    if (!isDevMode) {
      try {
        return await backendClient.ask(payload, onAnswer, onToken, getAskSignal());
      } finally {
        clearAskLocale();
      }
    }

    let filteredPayload = payload;
    const ent = await backendClient.getEntitlements();
    filteredPayload = {
      ...payload,
      useWebData: payload.useWebData && (ent.allowWebData !== false),
      forecastMode: payload.forecastMode && (ent.allowForecast !== false),
      debateMode: true,
      expertProfile: ent.allowExpertProfile !== false ? payload.expertProfile : undefined,
      memoryContext: ent.allowMemory !== false ? payload.memoryContext : undefined
    };
    try {
      return await askQuestion(
        filteredPayload,
        onAnswer,
        onToken as (agentId: import("../shared/types").AgentId, token: string) => void
      );
    } finally {
      clearAskLocale();
    }
  });
  ipcMain.handle("ask:update-locale", (_event, locale: string) => {
    updateAskLocaleIfActive(locale);
  });
  ipcMain.handle("ask:stop", () => {
    stopAsk();
    return { ok: true };
  });
  ipcMain.handle("auth:get-session", async () => backendClient.getSession());
  ipcMain.handle("isDevMode", () => isDevMode);
  ipcMain.handle("auth:google-login", async () => backendClient.loginWithGoogle());
  ipcMain.handle("auth:logout", async () => {
    await backendClient.logout();
    return { ok: true };
  });
  ipcMain.handle("entitlements:get", async () => backendClient.getEntitlements());
  ipcMain.handle("usage:can-ask", async (_event, deepResearchMode?: boolean) =>
    backendClient.canAsk(deepResearchMode)
  );
  ipcMain.handle("usage:consume", async (_event, question: string, count?: number) =>
    backendClient.consumeUsage(question, count ?? 1)
  );
  ipcMain.handle("billing:checkout", async (_event, plan: "weekly" | "monthly" | "yearly" = "monthly") => {
    const url = await backendClient.createCheckoutUrl(plan);
    await shell.openExternal(url);
    return { ok: true };
  });
  ipcMain.handle("billing:subscription", async () => backendClient.getSubscription());
  ipcMain.handle("billing:portal", async () => {
    const url = await backendClient.createPortalUrl();
    await shell.openExternal(url);
    return { ok: true };
  });
  ipcMain.handle("openExternal", async (_event, url: string) => {
    if (typeof url === "string" && /^https?:\/\//.test(url)) {
      await shell.openExternal(url);
    }
  });

  // Ollama installer IPC
  ipcMain.handle("ollama:check", () => checkOllamaStatus());
  ipcMain.handle("ollama:start", () => startOllamaServer());
  ipcMain.handle("ollama:save-profile", (_event, profile: HardwareProfile) => {
    // profile is stored in renderer localStorage, nothing to do on main side
    return { ok: true, profile };
  });
  ipcMain.handle("ollama:pull", async (event, model: string) => {
    await pullModel(model, (progress) => {
      event.sender.send("ollama:pull-progress", progress);
    });
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
