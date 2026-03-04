import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./ErrorBoundary";
import { isWebMode, createWebApi } from "./webApi";
import "./styles.css";

// Web mode (PWA в браузере): подменяем Electron API заглушками
const win = window as unknown as { api?: unknown; __THINKNEST_WEB_MODE__?: boolean };
if (typeof win.api === "undefined") {
  win.__THINKNEST_WEB_MODE__ = true;
  win.api = createWebApi();
  document.body.classList.add("web-mode");
}

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
