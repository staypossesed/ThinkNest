# Web Mode — Run in browser (localhost & ngrok)

[English](#english) | [Русский](#русский) | [中文](#中文)

---

## English

No paid hosting needed. ngrok free tier is enough for development. Paid host only for production.

### Option A: localhost

1. **backend/.env:** `APP_ORIGIN=http://localhost:5173`, `GOOGLE_REDIRECT_URI=http://localhost:8787/auth/google/callback`
2. **Google Console:** Add `http://localhost:5173` and `http://localhost:8787/auth/google/callback` to OAuth redirect URIs
3. Run `npm run dev:backend` (terminal 1), `npm run dev:renderer` (terminal 2)
4. Open **http://localhost:5173** in browser, sign in with Google

### Option B: ngrok (mobile / other device)

1. Run backend + frontend as in Option A
2. Run `ngrok http 5173`, copy the URL
3. Update `backend/.env`: `APP_ORIGINS`, `GOOGLE_REDIRECT_URI` with ngrok URL
4. Add ngrok URL to Google OAuth
5. Open ngrok URL in browser/phone

---

## Русский

## Не нужен платный хостинг

ngrok бесплатно достаточно для разработки. Платный хост нужен только для production.

---

### Вариант A: localhost (компьютер)

1. **backend/.env** — для localhost без ngrok:
   ```env
   APP_ORIGIN=http://localhost:5173
   GOOGLE_REDIRECT_URI=http://localhost:8787/auth/google/callback
   ```
   Callback идёт на backend (8787). Убедись, что **нет** старых ngrok URL.

2. **Google Cloud Console** → APIs & Services → Credentials → OAuth 2.0 Client:
   - **Authorized JavaScript origins:** `http://localhost:5173`
   - **Authorized redirect URIs:** добавь **оба** (Google требует точное совпадение):
     - `http://localhost:8787/auth/google/callback`
     - `http://localhost:5173/auth/google/callback` (если используешь web-режим)
   - Удали старые ngrok URL, если есть.

3. **Терминал 1 — backend:**
   ```bash
   npm run dev:backend
   ```
   Дождись `Server listening at http://127.0.0.1:8787`

4. **Терминал 2 — frontend:**
   ```bash
   npm run dev:renderer
   ```
   Дождись `ready in ... ms`

5. **Браузер:** открой **http://localhost:5173** (не Electron, не 172.16.x.x — именно localhost)

6. **Вход:** нажми «Войти через Google», авторизуйся

7. **Вопрос:** задай вопрос

---

### Вариант B: ngrok (мобилка, другой компьютер)

1. **Запусти backend и frontend** (как в варианте A)

2. **Терминал 3 — ngrok:**
   ```bash
   ngrok http 5173
   ```
   Скопируй URL, например `https://abc123.ngrok-free.dev`

3. **backend/.env** — добавь ngrok URL:
   ```env
   APP_ORIGINS=https://abc123.ngrok-free.dev,http://localhost:5173
   GOOGLE_REDIRECT_URI=https://abc123.ngrok-free.dev/auth/google/callback
   ```

4. **Google Cloud Console** — Web OAuth client:
   - Authorized JavaScript origins: `https://abc123.ngrok-free.dev`
   - Authorized redirect URIs: `https://abc123.ngrok-free.dev/auth/google/callback`

5. **Перезапусти backend** (чтобы подхватил .env)

6. **Браузер/телефон:** открой `https://abc123.ngrok-free.dev`

7. **Вход и вопрос** — как в варианте A

---

## Частые ошибки

| Проблема | Решение |
|----------|---------|
| «Backend недоступен» | Запусти backend и frontend, обнови страницу (Ctrl+Shift+R) |
| «Войдите через Google» | Нажми кнопку входа и авторизуйся |
| Открываю в Electron | Нужен **браузер** (Chrome, Edge) на http://localhost:5173 |
| ngrok: «Visit Site» | Нажми кнопку — заголовок уже добавлен в код |
| 401 на /entitlements | Нормально без входа — войди через Google |
| **ERR_NGROK_3200: endpoint offline** | См. ниже |

---

## ERR_NGROK_3200: endpoint is offline (вход через Google сломан)

Ошибка значит: туннель ngrok выключен. Google OAuth перенаправляет на старый ngrok URL, который больше не работает.

**Как исправить:**

1. **Запусти ngrok заново:**
   ```bash
   ngrok http 5173
   ```
   Скопируй новый URL (например `https://xyz123.ngrok-free.dev`). **Бесплатный ngrok даёт новый URL при каждом запуске.**

2. **Обнови `backend/.env`:**
   ```env
   APP_ORIGINS=https://xyz123.ngrok-free.dev,http://localhost:5173
   GOOGLE_REDIRECT_URI=https://xyz123.ngrok-free.dev/auth/google/callback
   ```
   Замени `xyz123` на свой новый ngrok URL.

3. **Google Cloud Console** → APIs & Services → Credentials → твой OAuth 2.0 Client:
   - **Authorized JavaScript origins:** добавь `https://xyz123.ngrok-free.dev`
   - **Authorized redirect URIs:** добавь `https://xyz123.ngrok-free.dev/auth/google/callback`
   - Удали старый `unlogistic-uncomfortably-floretta.ngrok-free.dev`, если он там есть.

4. **Перезапусти backend** (Ctrl+C, затем `npm run dev:backend`).

5. Открой новый ngrok URL в браузере и войди через Google.

**Временный обход:** если нужен только локальный доступ — открой **http://localhost:5173** (без ngrok). В `backend/.env` поставь `GOOGLE_REDIRECT_URI=http://localhost:8787/auth/google/callback` и добавь `http://localhost:8787/auth/google/callback` в Google Console (Authorized redirect URIs).

---

## Когда нужен платный хостинг

Только если хочешь **production** — постоянный URL, без ngrok и без запуска на своём ПК. Тогда деплой на Railway, Render, Vercel и т.п.

---

## 中文

无需付费托管。ngrok 免费版足够开发。付费主机仅用于生产。

### 选项 A：localhost

1. **backend/.env:** `APP_ORIGIN=http://localhost:5173`，`GOOGLE_REDIRECT_URI=http://localhost:8787/auth/google/callback`
2. **Google Console:** 在 OAuth 重定向 URI 中添加 `http://localhost:5173` 和 `http://localhost:8787/auth/google/callback`
3. 运行 `npm run dev:backend`（终端 1）、`npm run dev:renderer`（终端 2）
4. 在浏览器中打开 **http://localhost:5173**，使用 Google 登录

### 选项 B：ngrok（手机 / 其他设备）

1. 如选项 A 运行 backend 和 frontend
2. 运行 `ngrok http 5173`，复制 URL
3. 更新 `backend/.env`：将 `APP_ORIGINS`、`GOOGLE_REDIRECT_URI` 设为 ngrok URL
4. 在 Google OAuth 中添加 ngrok URL
5. 在浏览器/手机中打开 ngrok URL
