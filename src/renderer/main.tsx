import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./ErrorBoundary";
import { isWebMode, createWebApi, handleWebAuthRedirect } from "./webApi";
import "./styles.css";

const win = window as unknown as { api?: unknown; __THINKNEST_WEB_MODE__?: boolean };
if (typeof win.api === "undefined") {
  win.__THINKNEST_WEB_MODE__ = true;
  if (handleWebAuthRedirect()) {
    document.body.innerHTML = "<p>Вход выполнен, перезагрузка…</p>";
  } else {
    win.api = createWebApi();
    document.body.classList.add("web-mode");
  }
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
