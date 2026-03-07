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

### Web Mode (browser / mobile)

Run backend + frontend, open in browser:

```bash
npm run dev:backend
npm run dev:renderer
```

Open **http://localhost:5173** in Chrome or Edge (not Electron). Sign in with Google to ask questions.

For mobile access: use `ngrok http 5173` and add the ngrok URL to `backend/.env` and Google OAuth. See [WEB_MODE_SETUP.md](./WEB_MODE_SETUP.md).

### Full Setup

See [README.md](./README.md) for Supabase, Google OAuth, Stripe, and deployment.
