# План деплоя ThinkNest

## Production: что разворачивается

- **Backend** (Fastify, порт 8787): auth, ask, billing, entitlements, webhooks
- **Frontend** (статика из `dist/renderer/`)
- **Ollama** (модели llama3.1:8b, qwen2.5:7b)
- **Google OAuth** — вход пользователей
- **Stripe** — подписки (Pro Weekly/Monthly/Yearly)

Пользователи входят через Google и оплачивают подписку. Без демо-режима.

---

## Локальный запуск

```bash
npm run dev
```

Backend (8787) + Vite (5173) + Electron. Войдите через Google, задайте вопрос — ответ идёт с backend.

---

## Деплой в облако (пошагово)

### Вариант A: Railway (backend + Ollama)

1. **Регистрация:** https://railway.app
2. **Новый проект** → Deploy from GitHub (или загрузить код).
3. **Backend:**
   - Root directory: `backend`
   - Build: `npm install && npm run build`
   - Start: `npm run start`
   - Добавить все переменные из `backend/.env`
4. **Ollama на Railway:** Railway не даёт GPU по умолчанию. Ollama на CPU будет очень медленным. Лучше использовать Вариант B.

### Вариант B: Отдельный сервер для Ollama + Railway для backend

1. **Ollama-сервер:** арендовать VPS (Hetzner, DigitalOcean, Vultr) с 16+ GB RAM.
   - Установить: `curl -fsSL https://ollama.com/install.sh | sh`
   - Модели: `ollama pull llama3.1:8b && ollama pull qwen2.5:7b` (опц. `ollama pull llava` для картинок)
   - Ollama слушает порт 11434 (по умолчанию).

2. **Backend на Railway:**
   - Деплой `backend/`
   - В переменных: `OLLAMA_BASE_URL=http://your-vps-ip:11434/v1`
   - На VPS открыть порт 11434 для доступа с Railway (или использовать внутреннюю сеть, если оба в одной облачной сети).

3. **Desktop:** при сборке задать `BACKEND_API_URL=https://your-railway-app.railway.app`

### Вариант C: Всё на одном VPS (рекомендуется)

Полная инструкция: [DEPLOY_UBUNTU.md](./DEPLOY_UBUNTU.md).

Кратко:
1. Node.js 20, Ollama, PM2, Nginx
2. `git clone` → `npm run build:backend` → `npm run build:renderer`
3. `backend/.env` — Supabase, Google, Stripe, Ollama
4. Миграции 001–004 в Supabase
5. `pm2 start ecosystem-backend.config.js`
6. Nginx: `nginx/thinknest-full.conf` — статика + прокси
7. SSL: `certbot --nginx -d ТВОЙ_ДОМЕН`

---

## Чеклист перед деплоем

- [ ] Supabase: проект создан, миграции 001–004 выполнены
- [ ] Google OAuth: redirect URI `https://ТВОЙ_ДОМЕН/auth/google/callback`
- [ ] Stripe: webhook `https://ТВОЙ_ДОМЕН/webhooks/stripe`, Customer Portal Return URL
- [ ] `backend/.env`: все ключи (Supabase, Google, Stripe, Ollama)
- [ ] Ollama: `llama3.1:8b`, `qwen2.5:7b` загружены
- [ ] Nginx: `nginx/thinknest-full.conf` — статика + прокси API
- [ ] PM2: `ecosystem-backend.config.js`

---

## Команды для проверки

```powershell
# Модели Ollama
ollama list

# Backend health
curl http://localhost:8787/health

# Запуск
npm run dev
```
