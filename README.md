# LIFE RPG

PWA-ежедневник, который превращает большую цель в иерархию квестов по образцу RPG:
**сюжетная линия → глава → задание → этап**. Каждый уровень показывает свой прогресс,
а один «активный квест» всегда закреплён наверху: понятно, какой шаг сделать следующим.

## Документация

Спецификации — источник истины; код следует за ними.

| Документ | О чём |
| --- | --- |
| [docs/prd.md](docs/prd.md) | Продукт: требования F-01…F-19, бизнес-логика статусов, прогресса и каскадов, журнал решений |
| [docs/ux.md](docs/ux.md) | Экраны, навигация, состояния, взаимодействия, визуальная основа |
| [docs/tech-spec.md](docs/tech-spec.md) | Стек, архитектура, модель данных, API, план реализации по этапам |
| [CLAUDE.md](CLAUDE.md) | Правила работы с кодом в проекте и текущий этап |

Ход работы — в разделе «План реализации» в [docs/tech-spec.md](docs/tech-spec.md).

## Стек

| Слой | Технологии |
| --- | --- |
| Клиент | React, Vite, TanStack Router и Query, Zustand, Tailwind, shadcn/ui, PWA |
| API | Hono на Cloudflare Workers |
| База | PostgreSQL: локально в Docker, в продакшене Neon через Hyperdrive; Drizzle ORM |
| Общее | TypeScript (strict), Zod-контракты, pnpm workspaces, Vitest, ESLint |
| Вход | Better Auth, вход через Google |

Часть стека ещё не подключена: она появляется на своих этапах, см. «План реализации» в [docs/tech-spec.md](docs/tech-spec.md).

## Требования

- Node.js ≥ 24 (см. [.nvmrc](.nvmrc))
- pnpm 11 (точная версия — в поле `packageManager` в [package.json](package.json))
- Docker Desktop, запущенный: в нём работает локальный PostgreSQL

## Быстрый старт

```bash
pnpm install
pnpm db:up
pnpm db:migrate
pnpm dev
```

`pnpm db:migrate` нужен при первом запуске и после каждой новой миграции; `pnpm dev` сам миграции не применяет.
Вход только через Google, поэтому до первого `pnpm dev` нужны секреты: скопируй [apps/api/.dev.vars.example](apps/api/.dev.vars.example)
в `apps/api/.dev.vars` и заполни. OAuth-клиент — «Web application» в Google Cloud Console, с адресом
callback `http://127.0.0.1:5173/api/auth/callback/google`.

Если в локальной базе остались данные тестового пользователя `dev-user` (этапы 3–5), после первого входа
перенеси их на свой аккаунт: `pnpm db:adopt-dev-user`.

После `pnpm dev` работают:

| Что | Адрес |
| --- | --- |
| Клиент (Vite) | http://127.0.0.1:5173 |
| API (`wrangler dev`) | http://127.0.0.1:8787/api/… |
| PostgreSQL (Docker) | `127.0.0.1:5432`, база `life_rpg` |

Клиент открывай по `127.0.0.1`, а не `localhost`: Vite слушает только IPv4. Запросы клиента к `/api/*`
Vite проксирует на wrangler.

Проверка, что API и база живы: http://127.0.0.1:5173/api/health отвечает `{"status":"ok","db":"up"}`;
если база недоступна, ответ — `503` с `"db":"down"`.

## Команды

| Команда | Что делает |
| --- | --- |
| `pnpm dev` | Поднимает PostgreSQL в Docker, затем параллельно `wrangler dev` (API) и Vite (клиент) |
| `pnpm test` | Vitest по всем пакетам; интеграционным тестам API нужен запущенный PostgreSQL (`pnpm db:up`), они работают в отдельной базе `life_rpg_test` |
| `pnpm typecheck` | `tsc --noEmit` в каждом пакете |
| `pnpm lint` | ESLint по всему монорепо |
| `pnpm db:up` / `pnpm db:down` | Запустить / остановить локальный PostgreSQL; данные остаются в именованном томе Docker (см. [docker-compose.yml](docker-compose.yml)), сбросить базу — `docker compose down -v` |
| `pnpm db:generate` | Сгенерировать миграцию из [apps/api/src/db/schema.ts](apps/api/src/db/schema.ts) |
| `pnpm db:migrate` | Применить миграции к локальной базе |
| `pnpm db:adopt-dev-user` | Разово перенести локальные данные `dev-user` на единственный аккаунт Google в локальной базе |
| `pnpm --filter @life-rpg/web icons` | Перегенерировать иконки PWA из [apps/web/public/pwa-icon.svg](apps/web/public/pwa-icon.svg) |
| `pnpm --filter @life-rpg/api cf-typegen` | Перегенерировать `worker-configuration.d.ts` после правки `wrangler.jsonc` |

## Структура

```
apps/
  web/             React-клиент (PWA)
  api/             Hono на Workers: /api/*; с этапа 7 тот же Worker отдаёт и статику клиента
    src/auth/      Better Auth: вход через Google, сессии
    src/db/        схема Drizzle, клиент БД, миграции
packages/
  shared/          Zod-схемы запросов и ответов API, общие типы
  domain/          чистая доменная логика: дерево, прогресс, каскады, nextQuest
docs/              спецификации
```

## Архитектура вкратце

- **Слои API:** маршруты (HTTP, валидация) → сервисы (транзакции, права) → домен → репозитории (Drizzle).
- **`packages/domain`** — только чистые функции, без БД, HTTP, React и Workers. Сервер применяет их
  как источник истины, клиент — для мгновенных оптимистичных обновлений.
- **`packages/shared`** — единственный источник контрактов API: клиент и сервер импортируют Zod-схемы оттуда.
- **Прогресс не хранится**, а вычисляется при чтении; статусы контейнеров хранятся.
- **Данные пользователя изолированы:** `userId` берётся только из сессии, каждый репозиторий принимает его;
  без сессии — 401, чужие данные — 404.
- **Workers — не Node.js:** 10 мс CPU на запрос, Node-API только через `nodejs_compat`.

Подробности и обоснования — в [docs/tech-spec.md](docs/tech-spec.md).

## Окружения и секреты

- Окружений два: локальное (Docker + `wrangler dev`) и продакшен на Cloudflare. Staging нет.
- Учётные данные локальной базы (`postgres:postgres`) — не секрет, они только для Docker.
- Секреты не коммитятся: `.env*` и `.dev.vars*` в `.gitignore`; в продакшене они задаются через
  `wrangler secret` и в секретах GitHub Actions.
- Локально `drizzle-kit` отказывается работать с любым хостом, кроме локального. Продакшен-база
  мигрируется только через CI, который появится на этапе 7.
