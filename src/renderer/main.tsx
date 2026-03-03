import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./ErrorBoundary";
import { isWebMode, createWebApi } from "./webApi";
import "./styles.css";

// Web mode (PWA в браузере): подменяем Electron API заглушками
if (isWebMode()) {
  (window as unknown as { api: unknown }).api = createWebApi();
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
