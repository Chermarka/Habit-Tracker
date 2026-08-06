# Habit Tracker — навчальний практичний проєкт

Окремий проєкт для практики QA-навичок: локальний застосунок + БД + пошук
логів у Elasticsearch/Kibana. Далі буде додано Trello (баг-трекер).

## Стек

- **Backend**: Node.js + TypeScript + Express + Prisma ORM
- **DB**: PostgreSQL (локально через Homebrew, без Docker — Docker не
  встановлений на цій машині)
- **Frontend**: React + Vite + TypeScript
- **Логи**: структуровані JSON (pino) — request/response, SQL-запити з
  duration, помилки зі stacktrace й requestId. Доставляються в Elasticsearch
  власним shipper-скриптом і шукаються через Kibana.

## Запуск

### 1. Postgres (одноразово, якщо ще не запущений)

```bash
brew services start postgresql@16
```

БД `habit_tracker` вже створена. Якщо потрібно перестворити:

```bash
/opt/homebrew/opt/postgresql@16/bin/createdb habit_tracker
```

### 2. Backend

```bash
cd backend
npm install          # одноразово
npx prisma migrate dev   # одноразово / після зміни схеми
npm run dev           # http://localhost:4000
```

Логи пишуться в `backend/logs/app.log` (JSON, по одному рядку на запис).

### 3. Frontend

```bash
cd frontend
npm install           # одноразово
npm run dev            # http://localhost:5173
```

### 4. Elasticsearch + Kibana (опційно, для пошуку логів)

Встановлено через `brew tap elastic/tap` (безкоштовна basic-ліцензія,
без Docker). ML-модуль вимкнено (`xpack.ml.enabled: false`) — не сумісний з
нативним кодом на Apple Silicon і не потрібен для пошуку логів.

```bash
brew services start elastic/tap/elasticsearch-full   # http://localhost:9200
brew services start elastic/tap/kibana-full           # http://localhost:5601
```

Elasticsearch потребує JDK — бандлований у 7.17.4 не встановився, тому
використовується `openjdk@17` через symlink на
`.../elasticsearch-full/7.17.4/libexec/jdk.app/Contents/Home`.

Доставка логів у ES (свій легкий shipper, бо `filebeat-full` formula
зараз зламана під поточну версію Homebrew):

```bash
cd backend
npm run ship-logs   # читає logs/app.log, б'є нові рядки в /_bulk кожні 2с
```

Index pattern у Kibana вже створений: `habit-tracker-logs`
(time field `@timestamp`) → Discover одразу показує потік логів.

Схема полів (`log.*`, для трасування помилок через один `uuid`):

| Поле | Джерело |
|---|---|
| `log.level` | `info` (успіх) / `warn` (4xx) / `error` (5xx, або сама помилка) |
| `log.message` | `"POST /api/habits 400"` для access-логу, `"ValidationError: ..."` для запису помилки |
| `log.uuid` | requestId, спільний для access-логу і запису помилки одного запиту |
| `log.requestMethod` / `log.requestPath` / `log.requestHeaders` | з `req` |
| `log.responseStatus` / `log.responseDuration` | час обробки в мс, лише на access-логу |
| `log.stackTrace` / `log.requestBody` | лише на записі помилки (`middleware/errorHandler.ts`) |
| `log.time` | ISO timestamp |

На один невдалий запит завжди два документи з однаковим `log.uuid`: один
з `responseDuration` (з `src/index.ts`), другий з `stackTrace`+`requestBody`
(з `errorHandler.ts`) — саме так у Kibana шукається: спочатку
`log.responseStatus >= 400`, тоді `log.uuid` для повного контексту.

**Без дублікатів полів.** `requestHeaders`/`requestBody` пишуться як JSON-рядок
(`JSON.stringify`), а не об'єкт — інакше ES розгортає кожен ключ в окреме
поле (`log.requestHeaders.origin`, `.referer`, ...). Додатково є
index template `habit-tracker-logs` з `dynamic_templates`: усі рядкові поля
мапляться лише як `keyword`, без автоматичної пари `text`+`.keyword`. Якщо
індекс колись перестворюється (`DELETE /habit-tracker-logs`), темплейт
застосується знову сам — його не треба створювати вручну повторно.

## Структура

```
habit-tracker/
├── backend/
│   ├── prisma/schema.prisma   # Habit, HabitLog
│   └── src/
│       ├── services/habitService.ts   # уся бізнес-логіка
│       ├── routes/habits.ts
│       ├── middleware/errorHandler.ts # логує stacktrace + requestId
│       └── logger.ts                  # pino → console + logs/app.log
└── frontend/
    └── src/components/    # Dashboard, WeeklyMatrix, Analytics, Archive, CreateHabitModal
```

## Покриття ТЗ (US-01 … US-05)

Усі AC реалізовані й перевірені напряму через API (`curl`):

- **US-01** — створення бінарної/числової звички, валідація порожньої назви
- **US-02** — чекін, streak +1/-1 (перераховується щоразу з логів, без
  окремого лічильника — виключає розсинхрон), числовий прогрес-бар
- **US-03** — тижнева матриця Пн–Нд, редагування минулих дат, майбутні дати
  `editable:false` і на бекенді, і в UI
- **US-04** — heatmap за місяць/рік, tooltip
- **US-05** — архівування з підтвердженням, історичні дані залишаються
  доступними навіть для заархівованих звичок

### Знайдена неоднозначність у ТЗ (AC 4.1 vs AC 4.2)

AC 4.1 описує heatmap **для однієї обраної звички**, а приклад tooltip в
AC 4.2 — `"12 травня 2026: виконано 4/5 звичок (80%)"` — це **агрегат по
всіх звичках** за день, не одна звичка. Спека не пояснює цей перехід.
Реалізовано обидва режими (селектор "Усі звички (агрегат)" / конкретна
звичка) — варто уточнити в аналітика, який саме мався на увазі як основний.

## Далі (не зроблено)

- Trello MCP — баг-трекер для практики
- Навмисно посаджені баги під кожен тип помилки з `CLAUDE.md` (SQLException,
  ValidationException, TimeoutException, entity not found тощо)
