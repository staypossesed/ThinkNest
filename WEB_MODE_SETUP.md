# Web Mode — запуск в браузере (localhost и ngrok)

## Не нужен платный хостинг

ngrok бесплатно достаточно для разработки. Платный хост нужен только для production.

---

## Вариант A: localhost (компьютер)

1. **Терминал 1 — backend:**
   ```bash
   npm run dev:backend
   ```
   Дождись `Server listening at http://127.0.0.1:8787`

2. **Терминал 2 — frontend:**
   ```bash
   npm run dev:renderer
   ```
   Дождись `ready in ... ms`

3. **Браузер:** открой **http://localhost:5173** (не Electron, не 172.16.x.x — именно localhost)

4. **Вход:** нажми «Войти через Google», авторизуйся

5. **Вопрос:** задай вопрос

---

## Вариант B: ngrok (мобилка, другой компьютер)

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

---

## Когда нужен платный хостинг

Только если хочешь **production** — постоянный URL, без ngrok и без запуска на своём ПК. Тогда деплой на Railway, Render, Vercel и т.п.
