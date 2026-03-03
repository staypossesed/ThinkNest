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
  checkOllama: () => ipcRenderer.invoke("ollama:check"),
  startOllama: () => ipcRenderer.invoke("ollama:start"),
  saveOnboardingProfile: (profile: string) => ipcRenderer.invoke("ollama:save-profile", profile),
  pullModel: (model: string, onProgress: (p: unknown) => void) => {
    const handler = (_: unknown, progress: unknown) => onProgress(progress);
    ipcRenderer.on("ollama:pull-progress", handler);
    return ipcRenderer
      .invoke("ollama:pull", model)
      .finally(() => ipcRenderer.removeListener("ollama:pull-progress", handler));
  },
  ask: (
    payload: AskRequest,
    onAnswer?: (answer: AgentAnswer) => void,
    onToken?: (agentId: string, token: string) => void
  ): Promise<AskResponse> => {
    const answerHandler = onAnswer
      ? (_: unknown, answer: AgentAnswer) => onAnswer(answer)
      : null;
    const tokenHandler = onToken
      ? (_: unknown, data: { agentId: string; token: string }) => onToken(data.agentId, data.token)
      : null;

    if (answerHandler) ipcRenderer.on("ask:answer", answerHandler);
    if (tokenHandler) ipcRenderer.on("ask:token", tokenHandler);

    return ipcRenderer.invoke("ask", payload).finally(() => {
      if (answerHandler) ipcRenderer.removeListener("ask:answer", answerHandler);
      if (tokenHandler) ipcRenderer.removeListener("ask:token", tokenHandler);
    });
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
