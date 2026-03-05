import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig(({ command }) => ({
  root: path.resolve(__dirname, "src/renderer"),
  plugins: [
    react(),
    // PWA только при build — в dev пропускаем для быстрого старта
    ...(command === "build"
      ? [
          VitePWA({
            registerType: "autoUpdate",
            manifest: {
              name: "Multi Agent",
              short_name: "Multi Agent",
              description: "4 эксперта отвечают на ваш вопрос",
              theme_color: "#0c0e12",
              background_color: "#0c0e12",
              display: "standalone",
              orientation: "portrait",
              scope: "/",
              start_url: "/",
              icons: [
                {
                  src: "/logo.svg",
                  sizes: "64x64",
                  type: "image/svg+xml",
                  purpose: "any"
                }
              ]
            },
            workbox: {
              globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
              navigateFallback: "/index.html"
            }
          })
        ]
      : [])
  ],
  publicDir: path.resolve(__dirname, "public"),
  server: {
    port: 5173,
    host: true,
    // Прокси бэкенда — для ngrok с одним туннелем (VITE_BACKEND_URL=)
    proxy: {
      "/health": "http://localhost:8787",
      "/auth": "http://localhost:8787",
      "/me": "http://localhost:8787",
      "/ask": "http://localhost:8787",
      "/entitlements": "http://localhost:8787",
      "/usage": "http://localhost:8787",
      "/billing": "http://localhost:8787",
      "/portal": "http://localhost:8787",
      "/webhooks": "http://localhost:8787"
    }
  },
  optimizeDeps: {
    // Не пребандлить transformers — загружается по требованию при голосовом вводе
    exclude: ["@huggingface/transformers"],
    include: ["react", "react-dom", "react-markdown", "remark-gfm"]
  },
  build: {
    outDir: path.resolve(__dirname, "dist/renderer"),
    emptyOutDir: true
  }
}));
