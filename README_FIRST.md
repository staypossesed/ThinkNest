# Read This First / Прочитайте сначала

---

## English

### What is ThinkNest?

ThinkNest is a desktop app with 4 AI agents (Planner, Critic, Pragmatist, Explainer) that answer your questions. It runs locally with Ollama and supports Google login, web mode (browser/mobile), and Pro subscriptions.

### Quick Start (5 minutes)

1. **Install:**
   ```bash
   npm install
   npm --prefix backend install
   ```

2. **Copy env files:**
   - `backend/.env.example` → `backend/.env`
   - `.env.example` → `.env`

3. **Pull Ollama models** (one at a time):
   ```bash
   ollama pull phi3
   ollama pull mistral
   ollama pull llama3.1
   ```

4. **Run:**
   ```bash
   npm run dev
   ```
   Opens the Electron app. Ollama must be running.
