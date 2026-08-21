# Habit Tracker — навчальний практичний проєкт

Окремий проєкт для практики QA-навичок: локальний застосунок + БД + пошук
логів у Elasticsearch/Kibana + баг-трекер у Trello. Кожен користувач має
власний акаунт (нікнейм, без пароля) — звички ізольовані між акаунтами.

## Матеріали проекту

1. Веб-платформа "Трекер звичок" — http://localhost:5173
2. GitHub — https://github.com/Chermarka/Habit-Tracker
3. Підключення до БД

   Спершу підняти: `docker compose up -d` (з кореня репозиторію — весь
   стек, включно з Postgres, живе в Docker)

   DBeaver:
   - Host: `localhost`
   - Port: `5432` — це порт **БД** з `DATABASE_URL` у `backend/.env.example`.
     Не плутай із `PORT=4000` з того ж файлу — це порт backend-сервера
     (крок "1. Backend" нижче), до БД не стосується.
   - Database: `habit_tracker`
   - User: `habit_tracker`
   - Password: `habit_tracker` (див. `backend/.env.example`)

4. Trello (баг-трекер) — https://trello.com/b/BpqgppeA/habbit-tracker —
   картки заводяться скілом `.claude/skills/report-trello-bug` напряму
   через Trello API (офіційного MCP-сервера немає)
5. Elasticsearch + Kibana — у Docker (`docker-compose.yml`), той самий
   `docker compose up -d`, що й для БД

   - Elasticsearch: http://localhost:9200
   - Kibana: http://localhost:5601 → Discover → index pattern
     `habit-tracker-logs`, time field `@timestamp`
   - Одноразово після першого підняття контейнерів:
     `cd backend && npm run setup:es` — сам чекає, поки ES/Kibana
     відповідатимуть, і створює index template + index pattern
   - Логи бекенду доставляються туди власним shipper-скриптом
     (`npm run ship-logs` у `backend/`) кожні 2 секунди

## Стек

- **Backend**: Node.js + TypeScript + Express + Prisma ORM
- **DB**: PostgreSQL — через Docker Compose (працює однаково на
  macOS/Windows/Linux)
- **Frontend**: React + Vite + TypeScript
- **Логи**: власний JSON-логер (без pino) у фіксованій схемі `log.*` —
  request/response, SQL-запити з duration, помилки зі stacktrace й `uuid`.
  Доставляються в Elasticsearch власним shipper-скриптом і шукаються через
  Kibana.

## Запуск

Потрібні лише [Docker Desktop](https://www.docker.com/products/docker-desktop/)
(macOS/Windows/Linux — увімкнений і запущений) та Node.js 18+. Жодних
brew-формул чи macOS-специфічних кроків більше немає — інфраструктура
однакова на будь-якій ОС.

### 0. Інфраструктура (Postgres + Elasticsearch + Kibana)

```bash
docker compose up -d
```

Перший запуск качає образи й може зайняти кілька хвилин. Перевірити стан:

```bash
docker compose ps   # усі три сервіси мають бути "healthy"/"running"
```

Elasticsearch хоче мінімум ~2GB RAM, виділених Docker Desktop (Settings →
Resources) — на слабших машинах підніми ліміт заздалегідь, інакше контейнер
падатиме в рестарт-луп.

Дані Postgres і Elasticsearch зберігаються в docker-томах між перезапусками.
Щоб почати зовсім з нуля: `docker compose down -v`.

### 1. Backend

```bash
cd backend
cp .env.example .env   # одноразово — креденшли вже узгоджені з docker-compose.yml
npm install             # одноразово
npx prisma migrate dev  # одноразово / після зміни схеми
npm run prisma:seed      # одноразово — однакові тестові дані у всіх (users: anna, dmytro)
npm run dev              # http://localhost:4000
```

#### Автосинк БД після `git pull`

Щоб міграції та seed підтягувались самі після кожного `git pull`, а не
вручну — одноразово (з кореня репозиторію) увімкни git hook, який лежить у
репо (`.githooks/post-merge`):

```bash
git config core.hooksPath .githooks
```

Це локальна настройка (не йде в git), робиться раз на машину. Після цього
кожен `git pull` сам виконає `prisma migrate deploy` + `prisma:seed`, якщо
Postgres підняте (`docker compose up -d`) і `npm install`/`.env` вже
зроблені. Обмеження: працює для звичайного `git pull` (merge); якщо тягнеш
через `git pull --rebase`, хук `post-merge` не спрацює — тоді синкай вручну.

Логи пишуться в `backend/logs/app.log` (JSON, по одному рядку на запис).

### 2. Frontend

```bash
cd frontend
npm install           # одноразово
npm run dev            # http://localhost:5173
```

### 3. Elasticsearch + Kibana — індекси й доставка логів (опційно, для пошуку логів)

Одноразово, після того як `docker compose up -d` підняв Elasticsearch і
Kibana (скрипт сам почекає, поки обидва відповідатимуть) — створює index
template (усі рядкові поля -> `keyword`, без дублів `.keyword`) і index
pattern у Kibana:

```bash
cd backend
npm run setup:es
```

Доставка логів у ES (свій легкий shipper — читає `logs/app.log`, б'є нові
рядки в `_bulk` кожні 2с, працює безперервно, поки запущений):

```bash
npm run ship-logs
```

Index pattern у Kibana після `setup:es`: `habit-tracker-logs`
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

