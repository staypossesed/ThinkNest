# Деплой ThinkNest на Ubuntu — от клонирования до работающей ссылки

Пошаговая инструкция: репозиторий → сервер → работающий сайт. Пользователи входят через Google и оплачивают подписку Stripe.

---

## Быстрое обновление (если уже развёрнуто)

```bash
cd /home/www/ThinkNest
git pull
npm install
npm --prefix backend install
npm run build:backend
npm run build:renderer
pm2 restart thinknest-backend
```

---

## Что нужно до начала

- Ubuntu 22.04 LTS (или 20.04)
- SSH-доступ к серверу
- Домен (или IP, например 85.239.54.249)
- Аккаунты: Supabase, Google Cloud (OAuth), Stripe

---

## Часть 1. Подготовка сервера

### 1.1. Обновление системы

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2. Установка Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # должно быть v20.x
npm -v
```

### 1.3. Установка Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama --version
```

### 1.4. Установка PM2 (менеджер процессов)

```bash
sudo npm install -g pm2
pm2 --version
```

### 1.5. Установка Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl status nginx
```

### 1.6. Установка Git (если нет)

```bash
sudo apt install -y git
```

---

## Часть 2. Клонирование и сборка проекта

### 2.1. Клонирование репозитория

```bash
cd /home
sudo mkdir -p www
sudo chown $USER:$USER www
cd www

git clone https://github.com/staypossesed/ThinkNest.git
cd ThinkNest
```

> Если репозиторий приватный — настрой SSH-ключ или Personal Access Token.

### 2.2. Установка зависимостей

```bash
npm install
npm --prefix backend install
```

### 2.3. Сборка backend

```bash
npm run build:backend
```

### 2.4. Сборка frontend

```bash
npm run build:renderer
```

После сборки в `dist/renderer/` появятся статические файлы.

---

## Часть 3. Переменные окружения

### 3.1. Backend .env

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Заполни (обязательно для production):

```env
PORT=8787
APP_ORIGIN=https://ТВОЙ_ДОМЕН_ИЛИ_IP
APP_JWT_SECRET=длинная-случайная-строка-минимум-16-символов

SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=https://ТВОЙ_ДОМЕН/auth/google/callback

STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_WEEKLY=price_xxx
STRIPE_PRICE_MONTHLY=price_xxx
STRIPE_PRICE_YEARLY=price_xxx
STRIPE_SUCCESS_URL=https://ТВОЙ_ДОМЕН
STRIPE_CANCEL_URL=https://ТВОЙ_ДОМЕН

OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_TIMEOUT_MS=90000
```

> `APP_ORIGINS` — если нужны доп. origins (через запятую). Stripe: см. [docs/STRIPE_SETUP.md](./docs/STRIPE_SETUP.md).

### 3.2. Миграции Supabase

Выполни SQL в Supabase SQL Editor **по порядку**:
- `backend/supabase/migrations/001_init.sql`
- `backend/supabase/migrations/002_free_plan_15.sql`
- `backend/supabase/migrations/003_subscription_interval.sql`
- `backend/supabase/migrations/004_pro_70_daily.sql`

### 3.3. Google OAuth

В Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client:

- **Authorized JavaScript origins:** `https://ТВОЙ_ДОМЕН`
- **Authorized redirect URIs:** `https://ТВОЙ_ДОМЕН/auth/google/callback`

### 3.4. Stripe

1. **Webhook:** Developers → Webhooks → Add endpoint → URL: `https://ТВОЙ_ДОМЕН/webhooks/stripe`, события: `checkout.session.completed`, `customer.subscription.*`
2. **Customer Portal:** Settings → Billing → Customer portal → Return URL: `https://ТВОЙ_ДОМЕН`

---

## Часть 4. Модели Ollama

```bash
ollama pull llama3.1:8b
ollama pull qwen2.5:7b
```

Опционально:

```bash
ollama pull llava
```

Проверка:

```bash
ollama list
```

---

## Часть 5. Запуск backend через PM2

### 5.1. Запуск backend через PM2

В репозитории уже есть `ecosystem-backend.config.js`. Запуск:

```bash
cd /home/www/ThinkNest
pm2 start ecosystem-backend.config.js
pm2 save
pm2 startup   # автозапуск при перезагрузке — выполни команду, которую выведет
```

### 5.2. Проверка

```bash
pm2 status
curl http://127.0.0.1:8787/health
```

---

## Часть 6. Nginx — статика + прокси

### 6.1. Конфиг Nginx

Скопируй готовый конфиг и замени `ТВОЙ_ДОМЕН` и путь `root`:

```bash
sudo cp /home/www/ThinkNest/nginx/thinknest-full.conf /etc/nginx/sites-available/thinknest
sudo nano /etc/nginx/sites-available/thinknest
```

Замени `ТВОЙ_ДОМЕН` на свой домен или IP (например `85.239.54.249`). Или вставь конфиг вручную:

```nginx
server {
    listen 80;
    server_name ТВОЙ_ДОМЕН;

    root /home/www/ThinkNest/dist/renderer;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~ ^/(health|auth|me|ask|entitlements|usage|billing|portal|webhooks) {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
```

> Путь `root` — если клонировал в другое место, измени `/home/www/ThinkNest`.

### 6.2. Включение сайта

```bash
sudo ln -s /etc/nginx/sites-available/thinknest /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Часть 7. Firewall — открытие портов

### 7.1. UFW

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp   # SSH
sudo ufw enable
sudo ufw status
```

### 7.2. Провайдер (Timeweb и др.)

В панели хостинга открой порты **80** и **443** для входящего трафика (если есть отдельные правила).

---

## Часть 8. SSL (HTTPS) — опционально, но рекомендуется

### 8.1. Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ТВОЙ_ДОМЕН
```

Следуй подсказкам. Certbot сам обновит Nginx и настроит HTTPS.

### 8.2. После получения сертификата

Обнови `backend/.env`:

```env
APP_ORIGIN=https://ТВОЙ_ДОМЕН
GOOGLE_REDIRECT_URI=https://ТВОЙ_ДОМЕН/auth/google/callback
```

И в Google Console — redirect URI с `https://`.

Перезапусти backend:

```bash
pm2 restart thinknest-backend
```

---

## Часть 9. Проверка

1. Открой в браузере: `http://ТВОЙ_ДОМЕН` (или `https://` после Certbot).
2. Нажми «Войти через Google» — авторизация.
3. Задай вопрос — должен ответить AI.
4. «Обновить план» → выбери тариф → Stripe Checkout → оплата тестовой картой 4242… → подписка активируется.

---

## Часть 10. Обновление после изменений в репо

```bash
cd /home/www/ThinkNest
git pull
npm install
npm --prefix backend install
npm run build:backend
npm run build:renderer
pm2 restart thinknest-backend
```

---

## Если показывается «Войдите через Google» вместо ответов

Это значит: backend доступен, но пользователь не авторизован. Проверь:

1. **backend/.env** — для production (85.239.54.249):
   ```env
   APP_ORIGIN=http://85.239.54.249
   GOOGLE_REDIRECT_URI=http://85.239.54.249/auth/google/callback
   ```
   (или `https://` если настроен SSL)

2. **Google Cloud Console** → Credentials → OAuth 2.0 Client:
   - Authorized JavaScript origins: `http://85.239.54.249`
   - Authorized redirect URIs: `http://85.239.54.249/auth/google/callback`

3. Перезапусти backend: `pm2 restart thinknest-backend`

4. Нажми «Войти через Google» на сайте и пройди авторизацию.

---

## Отладка (debug mode)

Добавь `?debug=1` к URL (например `http://85.239.54.249/?debug=1`) или выполни в консоли браузера:
```js
localStorage.setItem('thinknest_debug', '1');
location.reload();
```
В консоли (F12 → Console) появятся логи: backend check, session, ask, 401 и т.д.

---

## Краткая шпаргалка команд

| Действие | Команда |
|----------|---------|
| Статус backend | `pm2 status` |
| Логи backend | `pm2 logs thinknest-backend` |
| Рестарт backend | `pm2 restart thinknest-backend` |
| Проверка Nginx | `sudo nginx -t` |
| Рестарт Nginx | `sudo systemctl reload nginx` |
| Список моделей Ollama | `ollama list` |

---

## Альтернатива: только API (Express server)

Если нужен только API без Google/Stripe/Supabase:

1. Используй `server/index.js` (Express).
2. `server/.env`: `OLLAMA_HOST`, `PORT=3000`.
3. PM2: `pm2 start server/index.js --name thinknest`.
4. Nginx: прокси 80 → 3000 (как в `nginx/thinknest.conf`).

Фронтенд при этом не разворачивается — только `POST /api/chat`.
