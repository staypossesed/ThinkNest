# Quick Deploy on Timeweb (CPU-only)

[English](#english) | [Русский](#русский) | [中文](#中文)

---

## English

```bash
cd /var/www/thinknest/ThinkNest
npm run build:renderer && npm run build:backend
pm2 restart thinknest-backend || pm2 start ecosystem-backend.config.js --name thinknest-backend
pm2 save
```

Full guide: [Русский](#русский).

---

## Русский

# Быстрый деплой на Timeweb (CPU-only)

Для сервера без GPU. Путь: `/var/www/thinknest/ThinkNest`.

---

## Быстрое исправление (если уже клонировал, но demo-version)

```bash
cd /var/www/thinknest/ThinkNest

# 1. Сборка (обязательно!)
npm run build:renderer
npm run build:backend

# 2. Таймаут для CPU — обнови backend/.env (НЕ перезаписывай — иначе потеряешь Google/Stripe!)
test -f backend/.env || cp backend/.env.example backend/.env
grep -q 'OLLAMA_TIMEOUT_MS=' backend/.env && sed -i 's|OLLAMA_TIMEOUT_MS=.*|OLLAMA_TIMEOUT_MS=90000|' backend/.env || echo "OLLAMA_TIMEOUT_MS=90000" >> backend/.env
grep -q 'OLLAMA_BASE_URL=' backend/.env && sed -i 's|OLLAMA_BASE_URL=.*|OLLAMA_BASE_URL=http://localhost:11434/v1|' backend/.env || echo "OLLAMA_BASE_URL=http://localhost:11434/v1" >> backend/.env

# 3. PM2 (имя процесса — thinknest-backend)
pm2 restart thinknest-backend || pm2 start ecosystem-backend.config.js --name thinknest-backend
pm2 save

# 4. Nginx — путь под /var/www
sudo cp nginx/thinknest-full.conf /etc/nginx/sites-available/thinknest
sudo sed -i 's|/home/www/ThinkNest|/var/www/thinknest/ThinkNest|g' /etc/nginx/sites-available/thinknest
sudo sed -i 's|ТВОЙ_ДОМЕН|85.239.54.249|g' /etc/nginx/sites-available/thinknest
sudo ln -sf /etc/nginx/sites-available/thinknest /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

> ⚠️ **Не** используй `cat > backend/.env` — это сотрёт Supabase, Google, Stripe. Добавляй только недостающие строки.

**Проверка:**

```bash
pm2 status
curl -I http://localhost
curl http://127.0.0.1:8787/health
```

**В браузере:** открой `http://85.239.54.249` и нажми **Ctrl+Shift+R** (жёсткое обновление, без кэша).

---

## Диагностика demo-version

Если видишь «Запустите npm run dev:backend», «demo • 0 ms» или бейдж «Dev»:

| Симптом | Причина | Решение |
|---------|---------|---------|
| «npm run dev:backend» | Backend недоступен или открыт localhost | Открой **http://85.239.54.249** (не localhost). Проверь `curl http://127.0.0.1:8787/health` |
| «Dev» в сайдбаре | Только в Electron dev-режиме | В браузере бейджа быть не должно. Если видишь — возможно открыт localhost или старый кэш |
| Старые сообщения | Кэш браузера | **Ctrl+Shift+R** или очисти кэш |
| 404 / пустая страница | Nginx root неверный или dist пустой | `ls -la dist/renderer/` — должны быть index.html, assets/. Пересобери: `npm run build:renderer` |

**Быстрая проверка:**
```bash
ls -la dist/renderer/          # index.html и assets/ должны быть
curl -s http://127.0.0.1:8787/health | head -1   # должен вернуть JSON
```

---

## Важно: два режима

| Режим | Файл | Порт | Nginx | Модели |
|-------|------|------|-------|--------|
| **Полный сайт** (Google, Stripe) | `ecosystem-backend.config.js` | 8787 | thinknest-full.conf → 8787 | llama3.1:8b, qwen2.5:7b |
| Только API (без входа) | `ecosystem.config.js` | 3000 | thinknest.conf → 3000 | llama3.2:3b, qwen2.5:3b (устарели) |

**Для сайта с входом через Google** — используй **полный режим** (backend на 8787).

---

## Шаг 1: Модели Ollama

```bash
cd /var/www/thinknest/ThinkNest

ollama rm llama3.2:3b qwen2.5:3b  2>/dev/null || true

ollama pull llama3.1:8b
ollama pull qwen2.5:7b
```

---

## Шаг 2: Backend .env (для полного сайта)

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Обязательно заполни:

```env
PORT=8787
APP_ORIGIN=http://85.239.54.249
APP_JWT_SECRET=длинная-случайная-строка-16+символов

SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=http://85.239.54.249/auth/google/callback

STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_WEEKLY=price_xxx
STRIPE_PRICE_MONTHLY=price_xxx
STRIPE_PRICE_YEARLY=price_xxx
STRIPE_SUCCESS_URL=http://85.239.54.249
STRIPE_CANCEL_URL=http://85.239.54.249

OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_TIMEOUT_MS=90000
```

> Для CPU таймаут 90000 (90 сек) обязателен.

---

## Шаг 3: Сборка

```bash
cd /var/www/thinknest/ThinkNest

npm install
npm --prefix backend install
npm run build:backend
npm run build:renderer
```

---

## Шаг 4: PM2 (только backend для полного сайта)

```bash
pm2 delete thinknest thinknest-backend 2>/dev/null || true

pm2 start ecosystem-backend.config.js --name thinknest-backend
pm2 save
pm2 startup
```

> **Не** запускай `ecosystem.config.js` — он для API-only (порт 3000). Nginx ждёт backend на 8787.

---

## Шаг 5: Nginx

```bash
sudo cp /var/www/thinknest/ThinkNest/nginx/thinknest-full.conf /etc/nginx/sites-available/thinknest
sudo nano /etc/nginx/sites-available/thinknest
```

Замени:
- `ТВОЙ_ДОМЕН` → `85.239.54.249`
- `root /home/www/ThinkNest/dist/renderer` → `root /var/www/thinknest/ThinkNest/dist/renderer`

```bash
sudo ln -sf /etc/nginx/sites-available/thinknest /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## Проверка

```bash
pm2 status
ollama list
curl http://127.0.0.1:8787/health
```

В браузере: `http://85.239.54.249` → «Войти через Google» → задай вопрос.

---

## Обновление после git pull

```bash
cd /var/www/thinknest/ThinkNest
git pull
npm install
npm --prefix backend install
npm run build:backend
npm run build:renderer
pm2 restart thinknest-backend
```

---

## 中文

```bash
cd /var/www/thinknest/ThinkNest
npm run build:renderer && npm run build:backend
pm2 restart thinknest-backend || pm2 start ecosystem-backend.config.js --name thinknest-backend
pm2 save
```

完整指南：[Русский](#русский)。
