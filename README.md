# Habit Tracker — навчальний практичний проєкт

Окремий проєкт для практики QA-навичок: локальний застосунок + БД + пошук
логів у Elasticsearch/Kibana. Кожен користувач має власний акаунт (нікнейм,
без пароля) — звички ізольовані між акаунтами. Далі буде додано Trello
(баг-трекер).

## Стек

- **Backend**: Node.js + TypeScript + Express + Prisma ORM
- **DB**: PostgreSQL (локально через Homebrew, без Docker — Docker не
  встановлений на цій машині)
- **Frontend**: React + Vite + TypeScript
- **Логи**: власний JSON-логер (без pino) у фіксованій схемі `log.*` —
  request/response, SQL-запити з duration, помилки зі stacktrace й `uuid`.
  Доставляються в Elasticsearch власним shipper-скриптом і шукаються через
  Kibana.

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

**Знайдений і виправлений баг: `log.requestPath` завжди показував `/`.**
Код читав `req.path` всередині `res.on("finish", ...)` — тобто вже після
того, як запит пройшов через вкладений роутер (`habitsRouter`, змонтований
на `/api/habits`). Express на час обробки в підроутері обрізає `req.url` до
шляху відносно точки монтування (`/api/habits` → лишається `/`) і повертає
його назад, лише якщо обробник викликає `next()`. Наші роути відповідають
напряму (`res.json(...)`), без `next()`, тож обрізаний шлях так і лишається
обрізаним до кінця запиту — саме це й бачить `finish`. Фікс — читати
`req.originalUrl` (Express ніколи його не чіпає) одразу на вході в
middleware, а не `req.path` лениво в колбеку. Виправлено в `src/index.ts`
і `middleware/errorHandler.ts`.

## Авторизація

Без паролів — реєстрація й вхід лише по нікнейму, щоб кожен, хто практикується
на застосунку, мав власний ізольований набір звичок і не заважав іншим.

- `POST /api/auth/register {nickname}` → `201`, створює `User`. Нікнейм
  унікальний (`@unique` в Prisma) — дубль повертає `409 ConflictError`.
- `POST /api/auth/login {nickname}` → `200`, якщо такий нікнейм існує,
  інакше `404 EntityNotFoundError`.
- Усі `/api/habits/*` захищені `middleware/requireAuth.ts`: читає заголовок
  `x-user-id`, перевіряє що такий `User` є в БД, кладе `req.userId`. Немає
  заголовка чи користувача з таким id не існує → `401 UnauthorizedError`.
- Кожен запит у `habitService.ts` фільтрує по `userId` (дашборд, тиждень,
  архів) або звіряє власника (`getOwnedHabit`) перед чекіном/архівуванням —
  чужа звичка повертає `404`, а не `403`, щоб не підказувати, що вона взагалі
  існує.
- Фронтенд зберігає `{id, nickname}` у `localStorage`
  (`habit-tracker-session`) і підставляє `x-user-id` в кожен запит
  (`api.ts` → `request()`). Без сесії показується `AuthScreen.tsx` замість
  застосунку.

Це навмисно не "справжня" автентифікація (без пароля, без токена з підписом,
`x-user-id` довіряється як є) — рівно стільки ізоляції, скільки потрібно,
щоб кілька людей практикувались на одному застосунку незалежно.

## Структура

```
habit-tracker/
├── backend/
│   ├── prisma/schema.prisma   # User, Habit, HabitLog
│   └── src/
│       ├── services/authService.ts    # register, login
│       ├── services/habitService.ts   # уся бізнес-логіка, усе скоповано по userId
│       ├── routes/auth.ts
│       ├── routes/habits.ts
│       ├── middleware/requireAuth.ts  # читає x-user-id, кладе req.userId
│       ├── middleware/errorHandler.ts # логує stacktrace + requestId
│       └── logger.ts                  # власний JSON-логер → console + logs/app.log
└── frontend/
    └── src/components/    # AuthScreen, Dashboard, WeeklyMatrix, Archive, CreateHabitModal
```

## Покриття ТЗ (US-01 … US-03, US-05)

Усі AC реалізовані й перевірені напряму через API (`curl`):

- **US-01** — створення бінарної/числової звички, валідація порожньої назви
- **US-02** — чекін, streak +1/-1 (перераховується щоразу з логів, без
  окремого лічильника — виключає розсинхрон), числовий прогрес-бар
- **US-03** — тижнева матриця Пн–Нд, редагування минулих дат, майбутні дати
  `editable:false` і на бекенді, і в UI
- **US-05** — архівування з підтвердженням, історичні дані залишаються
  доступними навіть для заархівованих звичок

**US-04 (аналітика/heatmap) прибрано** — свідоме спрощення проєкту.
Вкладка "Аналітика", ендпоінти `GET /heatmap` і `GET /:id/heatmap`,
`getHabitHeatmap`/`getAggregateHeatmap` у `habitService.ts` видалені
повністю, `Habit`/`HabitLog` це не зачепило (heatmap рахувався з тих самих
таблиць, окремої моделі не мав).

## Далі (не зроблено)

- Trello MCP — баг-трекер для практики
- Навмисно посаджені баги під кожен тип помилки з `CLAUDE.md` (SQLException,
  ValidationException, TimeoutException, entity not found тощо)
