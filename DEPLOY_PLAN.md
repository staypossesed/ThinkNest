# План деплоя ThinkNest

## Что исправлено (сейчас)

1. **isDevMode** — теперь `true` только при `npm run dev:local` (DEV_MODE=true). При `npm run dev` используется backend, Ollama не проверяется.
2. **Web mode** — в браузере (localhost:5173) корректно определяется web-режим, модалка Ollama не показывается.
3. **Onboarding** — при backend-режиме показывается «Модели на сервере», кнопка «Начать» без проверки Ollama.

---

## Как запустить локально (прямо сейчас)

```powershell
cd d:\Downloads\multi-agent-desktop
npm run dev
```

**Важно:** открывать приложение нужно в **окне Electron** (оно запускается автоматически), а не в браузере. В браузере доступен только режим просмотра.

1. Backend (8787) + Vite (5173) + Electron запустятся.
2. Откроется окно Electron.
3. Нажмите «Начать» (без проверки Ollama).
4. Войдите через Google.
5. Задайте вопрос — ответ идёт с backend (Ollama на вашем ПК).

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
   - Модели: `ollama pull phi3 && ollama pull mistral && ollama pull llama3.1 && ollama pull llava`
   - Ollama слушает порт 11434 (по умолчанию).

2. **Backend на Railway:**
   - Деплой `backend/`
   - В переменных: `OLLAMA_BASE_URL=http://your-vps-ip:11434/v1`
   - На VPS открыть порт 11434 для доступа с Railway (или использовать внутреннюю сеть, если оба в одной облачной сети).

3. **Desktop:** при сборке задать `BACKEND_API_URL=https://your-railway-app.railway.app`

### Вариант C: Всё на одном VPS

1. Арендовать VPS (Hetzner, DigitalOcean и т.п.).
2. Установить Node.js, Ollama.
3. Запустить Ollama: `ollama serve`
4. Запустить backend: `cd backend && npm run start`
5. (Опционально) Nginx как reverse proxy для backend.
6. Собрать desktop с `BACKEND_API_URL=https://your-domain.com`

---

## Чеклист перед деплоем

- [ ] Supabase: проект создан, миграции выполнены
- [ ] Google OAuth: redirect URI добавлен для production-домена
- [ ] Stripe: webhook URL обновлён на production
- [ ] `backend/.env`: все ключи заполнены для production
- [ ] Ollama: модели загружены на сервере
- [ ] `OLLAMA_BASE_URL`: указывает на сервер с Ollama

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
