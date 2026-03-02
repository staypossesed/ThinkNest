import { contextBridge, ipcRenderer } from "electron";
import {
  AgentAnswer,
  AskRequest,
  AskResponse,
  CanAskResponse,
  ConsumeUsageResponse,
  Entitlements,
  SessionState
} from "../shared/types";

contextBridge.exposeInMainWorld("api", {
  ask: (
    payload: AskRequest,
    onAnswer?: (answer: AgentAnswer) => void
  ): Promise<AskResponse> => {
    if (onAnswer) {
      const handler = (_: unknown, answer: AgentAnswer) => onAnswer(answer);
      ipcRenderer.on("ask:answer", handler);
      return ipcRenderer
        .invoke("ask", payload)
        .finally(() => ipcRenderer.removeListener("ask:answer", handler));
    }
    return ipcRenderer.invoke("ask", payload);
  },
  getSession: (): Promise<SessionState> => ipcRenderer.invoke("auth:get-session"),
  loginWithGoogle: (): Promise<SessionState> => ipcRenderer.invoke("auth:google-login"),
  logout: (): Promise<{ ok: true }> => ipcRenderer.invoke("auth:logout"),
  getEntitlements: (): Promise<Entitlements> => ipcRenderer.invoke("entitlements:get"),
  canAsk: (): Promise<CanAskResponse> => ipcRenderer.invoke("usage:can-ask"),
  consumeUsage: (question: string): Promise<ConsumeUsageResponse> =>
    ipcRenderer.invoke("usage:consume", question),
  openCheckout: (): Promise<{ ok: true }> => ipcRenderer.invoke("billing:checkout"),
  openPortal: (): Promise<{ ok: true }> => ipcRenderer.invoke("billing:portal"),
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke("openExternal", url),
  isDevMode: (): Promise<boolean> => ipcRenderer.invoke("isDevMode"),
  setAskLocale: (locale: string): Promise<void> =>
    ipcRenderer.invoke("ask:update-locale", locale)
});
