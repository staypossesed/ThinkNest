#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DOWNLOADS = path.dirname(ROOT);
const SCHEDULE = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/commit-schedule.json"), "utf8"));

const DOTFILES = [
  { path: "README.md", content: "# ThinkNest Dotfiles\n\nPersonal config files for development.\n" },
  { path: ".gitignore", content: ".DS_Store\nThumbs.db\n*.local\n" },
  { path: ".editorconfig", content: "root = true\n\n[*]\nindent_style = space\nindent_size = 2\nend_of_line = lf\n" },
  { path: ".prettierrc", content: '{"semi":true,"singleQuote":false,"tabWidth":2,"printWidth":100}\n' },
  { path: "vscode/settings.json", content: '{"editor.formatOnSave":true,"editor.tabSize":2}\n' },
  { path: "vscode/extensions.json", content: '{"recommendations":["editorconfig.editorconfig"]}\n' },
  { path: "scripts/setup.sh", content: "#!/bin/sh\n# Symlink dotfiles to home\nset -e\necho 'Setup complete'\n" },
  { path: "scripts/backup.sh", content: "#!/bin/sh\n# Backup dotfiles\ncp -r ~/.config ./backup 2>/dev/null || true\n" },
  { path: "shell/aliases", content: "alias ll='ls -la'\nalias gs='git status'\n" },
  { path: "shell/functions", content: "mkcd() { mkdir -p \"$1\" && cd \"$1\"; }\n" },
  { path: "git/attributes", content: "* text=auto\n*.md text\n" },
  { path: "git/config", content: "[core]\n  autocrlf = input\n" },
  { path: "npm/.npmrc", content: "save-exact=true\n" },
  { path: "neovim/init.vim", content: "set number\nset relativenumber\nsyntax on\n" },
  { path: "tmux/.tmux.conf", content: "set -g prefix C-a\nbind C-a send-prefix\n" },
  { path: "zsh/.zshrc", content: "export PATH=$HOME/.local/bin:$PATH\n" },
  { path: "fish/config.fish", content: "set -gx EDITOR nvim\n" },
];

const SNIPPETS = [
  { path: "README.md", content: "# ThinkNest Snippets\n\nReusable code snippets and utilities.\n" },
  { path: "typescript/useDebounce.ts", content: "import { useState, useEffect } from 'react';\n\nexport function useDebounce<T>(value: T, delay: number): T {\n  const [debounced, setDebounced] = useState(value);\n  useEffect(() => {\n    const t = setTimeout(() => setDebounced(value), delay);\n    return () => clearTimeout(t);\n  }, [value, delay]);\n  return debounced;\n}\n" },
  { path: "typescript/formatDate.ts", content: "export function formatDate(d: Date, locale = 'en'): string {\n  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });\n}\n" },
  { path: "typescript/clamp.ts", content: "export function clamp(n: number, min: number, max: number): number {\n  return Math.min(Math.max(n, min), max);\n}\n" },
  { path: "react/useLocalStorage.ts", content: "import { useState, useEffect } from 'react';\n\nexport function useLocalStorage<T>(key: string, init: T): [T, (v: T) => void] {\n  const [state, setState] = useState<T>(() => {\n    try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? init; }\n    catch { return init; }\n  });\n  useEffect(() => { localStorage.setItem(key, JSON.stringify(state)); }, [key, state]);\n  return [state, setState];\n}\n" },
  { path: "react/useEventListener.ts", content: "import { useEffect } from 'react';\n\nexport function useEventListener<K extends keyof WindowEventMap>(event: K, handler: (e: WindowEventMap[K]) => void) {\n  useEffect(() => {\n    window.addEventListener(event, handler);\n    return () => window.removeEventListener(event, handler);\n  }, [event, handler]);\n}\n" },
  { path: "css/glassmorphism.css", content: ".glass {\n  background: rgba(255,255,255,0.1);\n  backdrop-filter: blur(10px);\n  border: 1px solid rgba(255,255,255,0.2);\n}\n" },
  { path: "css/reset.css", content: "* { box-sizing: border-box; }\nbody { margin: 0; }\n" },
  { path: "utils/sleep.ts", content: "export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));\n" },
  { path: "utils/cn.ts", content: "export function cn(...classes: (string|undefined)[]): string {\n  return classes.filter(Boolean).join(' ');\n}\n" },
];

function backfillDotfiles() {
  const dotfilesDir = path.join(DOWNLOADS, "thinknest-dotfiles");
  const dates = Object.keys(SCHEDULE).sort();
  let fileIdx = 0;

  for (const dateStr of dates) {
    const n = SCHEDULE[dateStr].dotfiles || 0;
    for (let i = 0; i < n; i++) {
      const f = DOTFILES[fileIdx % DOTFILES.length];
      const fp = path.join(dotfilesDir, f.path);
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      const suffix = fileIdx >= DOTFILES.length ? `\n# update ${fileIdx}\n` : "";
      fs.writeFileSync(fp, f.content + suffix);
      const msg = (fileIdx < DOTFILES.length ? `chore: add ${f.path}` : `chore: update ${f.path}`).replace(/"/g, "'");
      const times = ["09:15:00", "11:30:00", "14:00:00", "16:45:00", "19:20:00"];
      execSync(`git add -A && git commit -m "${msg}" --date="${dateStr} ${times[i % times.length]}"`, { cwd: dotfilesDir, stdio: "inherit" });
      fileIdx++;
    }
  }
}

function backfillSnippets() {
  const snippetsDir = path.join(DOWNLOADS, "thinknest-snippets");
  const dates = Object.keys(SCHEDULE).sort();
  let fileIdx = 0;

  for (const dateStr of dates) {
    const n = SCHEDULE[dateStr].snippets || 0;
    for (let i = 0; i < n; i++) {
      const f = SNIPPETS[fileIdx % SNIPPETS.length];
      const fp = path.join(snippetsDir, f.path);
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      const suffix = fileIdx >= SNIPPETS.length ? `\n// v${Math.floor(fileIdx / SNIPPETS.length) + 1}\n` : "";
      fs.writeFileSync(fp, f.content + suffix);
      const name = f.path.replace(/\.[^/.]+$/, "").replace(/\//g, " ");
      const msg = (fileIdx < SNIPPETS.length ? `add ${name}` : `update ${name}`).replace(/"/g, "'");
      const times = ["09:15:00", "11:30:00", "14:00:00", "16:45:00", "19:20:00"];
      execSync(`git add -A && git commit -m "${msg}" --date="${dateStr} ${times[i % times.length]}"`, { cwd: snippetsDir, stdio: "inherit" });
      fileIdx++;
    }
  }
}

console.log("Backfilling thinknest-dotfiles...");
backfillDotfiles();
console.log("Backfilling thinknest-snippets...");
backfillSnippets();
console.log("Done.");
