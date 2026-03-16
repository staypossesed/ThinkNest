# Changelog — 16 февраля 2025

## Модели 7B/8B по умолчанию

- **askConfig.ts**: все режимы (fast/balanced/quality) переведены на `llama3.1:8b` и `qwen2.5:7b`
- **config.ts** (main): MODE_MODELS, REQUIRED_MODELS, ollamaConfig (agents, aggregator, imageFast, deepResearch)
- **Onboarding.tsx**: REQUIRED_MODELS для онбординга
- **ollamaInstaller.ts**: HARDWARE_PROFILES (light/medium/powerful)
- **queryGenerator.ts** (backend + main): QUERY_MODEL
- **Примечание**: llama3.2:7b не существует (Llama 3.2 — только 1B/3B), используется llama3.1:8b

## Увеличение numPredict (убрать обрезку)

- **prompts.config.ts** (backend): explainer 180→320, planner 320→400, critic 260→300, pragmatist 220→300
- **orchestrator.ts** (backend): SIMPLE_NUM_PREDICT.explainer 60→120
- **prompts.config.ts** (main): planner 140→400, critic 120→300, pragmatist 120→300, explainer 100→320

## Оценка сложности вопроса (estimateQuestionComplexity)

- Добавлены domainPatterns: `/геро|карт|саппорт|баланс|dota|кс\b|cs\b|игр|футбол|спорт|лучш|best|who is/i`
- Тематические/игровые/спортивные вопросы считаются `normal`, не `simple`

## Усиление промпта

- **prompts.config.ts**: блок `[БЕЗ ОШИБОК — КРИТИЧНО]`, расширен QUALITY_GATE (пункты 6–7)
- **orchestrator.ts**: ERROR_FREE_BLOCK, расширенный QUALITY_GATE

## Таймаут для простых вопросов

- **simpleTimeoutMs**: 25 → 50 секунд (7B/8B на CPU не успевали за 25 сек)

## Анти-отказы (Qwen)

- **REFUSAL_PHRASES**: добавлены `не могу сформировать ответ`, `без конкретики`, `задайте более точный`, `переформулировать вопрос`
- **Промпты**: явный запрет на отказы для Skeptic и Practitioner
- **SYSTEM_PREFIX**: «не могу сформировать ответ», «без конкретики» — ЗАПРЕЩЕНО

## Fallback и preload

- orchestrator: preloadModel, tryMinimalResponse, fallback — все на llama3.1:8b

---

## UI и сайдбар

- **ChatSidebar**: убраны кнопки Refresh и Settings; переименование чатов, getDisplayTitle, отображение multi-answer для entitlements
- **ChatMain**: бейдж perspectives только при deep research, 2/4 по плану
- **App**: refreshEntitlements, синхронизация сессии

## Языки (i18n)

- **LanguageSelector**: «Ответы на» → «Язык»
- **ExportPanel, ShareButton**: все лейблы через t()
- **FinalConclusion**: synthesizedFrom2/4, perspectivesHeaderN локализованы
- **AgentCard, MessageInput, UpgradeModal**: обновления i18n и стилей

## Backend и биллинг

- **billing, entitlements, usage, webhooks**: маршруты и сервисы
- **ask/routes.ts, types.ts**: обновления API
- **db.ts, index.ts**: подключение модулей

## Web-клиент и shared

- **webApi, webBackendClient**: клиент для web-режима
- **shared/types.ts**: общие типы
- **preload.ts**: exposeInMainWorld для backend-клиента

## Прочее

- **useMemory**: хук
- **vite.config**: конфиг
- **BILLING_VERIFY.md**: документация
