# Публикация репозитория

Инструкция по превращению приватного репо в публичный без утечки секретов.

## Перед публикацией

### 1. Проверь, что секреты не в репо

```bash
# Поиск возможных секретов в истории
git log -p --all -S "GOOGLE_CLIENT_SECRET" -- "*.ts" "*.tsx" "*.js" "*.json"
git log -p --all -S "SERPER_API_KEY" -- .
git log -p --all -S "supabase" -- .
```

Если команды что-то нашли — секреты уже в истории. Нужна очистка (шаг 3).

### 2. Убедись, что .gitignore покрывает всё

Уже добавлено:
- `.env`, `.env.local`, `.env.*.local`
- `backend/.env`, `backend/.env.local`
- `*.log`, `debug-*.log`
- `*.pem`, `*.key`

Проверь: `git status` — в списке не должно быть `.env` или `backend/.env`.

### 3. Очистка истории (если секреты уже коммитились)

**Важно:** это переписывает историю. Если кто-то уже клонировал репо — им придётся переклонировать.

#### Вариант A: git-filter-repo (рекомендуется)

```bash
# Установка: pip install git-filter-repo
git filter-repo --path backend/.env --invert-paths
git filter-repo --path .env --invert-paths
```

#### Вариант B: BFG Repo-Cleaner

```bash
# Скачай BFG: https://rtyley.github.io/bfg-repo-cleaner/
# Создай файл с путями для удаления
echo "backend/.env" > files-to-delete.txt
echo ".env" >> files-to-delete.txt
java -jar bfg.jar --delete-files .env
java -jar bfg.jar --delete-folders backend
# (осторожно с --delete-folders, лучше --delete-files)
```

#### Вариант C: новый репо с чистой историей

Если история не критична:

```bash
# В новой папке
git clone <твой-приватный-репо> temp-repo
cd temp-repo
# Удали .env если есть
rm -f .env backend/.env 2>/dev/null
# Создай новый репо с одним коммитом
git checkout --orphan clean-main
git add -A
git commit -m "Initial public release"
git branch -D main  # или master
git branch -m main
git remote set-url origin <url-нового-публичного-репо>
git push -u origin main --force
```

### 4. Создай публичный репо на GitHub

1. GitHub → New repository (или Settings существующего)
2. Сними галочку "Private"
3. Добавь `README`, `LICENSE` (MIT), `.gitignore` если ещё нет

### 5. После публикации

- **Смени все секреты** (Google OAuth, Supabase, JWT, Serper и т.д.) — даже если ты их удалил из истории, они могли утечь
- В `backend/.env.example` и `.env.example` только плейсхолдеры, без реальных значений
- Добавь в README раздел «Переменные окружения» со ссылкой на `.env.example`

## Что уже сделано для публикации

- [x] `.gitignore` — все `.env`, логи, ключи
- [x] Debug-телеметрия отключена (no-op)
- [x] `.env.example` — только шаблоны
- [x] `backend/.env.example` — только шаблоны

## Переменные, которые нужно хранить в секрете

| Переменная | Где | Описание |
|------------|-----|----------|
| `GOOGLE_CLIENT_SECRET` | backend/.env | OAuth |
| `APP_JWT_SECRET` | backend/.env | JWT подпись |
| `SUPABASE_SERVICE_ROLE_KEY` | backend/.env | Supabase |
| `STRIPE_SECRET_KEY` | backend/.env | Оплата |
| `STRIPE_WEBHOOK_SECRET` | backend/.env | Webhooks |
| `SERPER_API_KEY` / `SERPAPI_KEY` | .env | Поиск |

Все они читаются из `.env` и **никогда** не должны быть в коде или коммитах.
