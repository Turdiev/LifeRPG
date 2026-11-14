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
  мигрируется только через CI (`DRIZZLE_ALLOW_REMOTE=1` выставляет только workflow деплоя).

## Выпуск

Продакшен — один Cloudflare Worker (клиент и `/api/*`) и база Neon. Деплоит только CI: на слияние в
`main` workflow [Deploy](.github/workflows/deploy.yml) прогоняет проверки, собирает клиент,
накатывает миграции на Neon и запускает `wrangler deploy`. Резервную копию раз в сутки делает
[Backup](.github/workflows/backup.yml).

### Разовая настройка

Делается один раз руками; адрес приложения ниже — `https://life-rpg.<поддомен>.workers.dev`.
Поддомен аккаунта виден в Cloudflare: Workers & Pages → справа «Subdomain». У нового аккаунта его
может ещё не быть — тогда задай его там же, иначе деплой из CI упадёт.

Строки подключения с паролем в командах ниже оседают в истории Git Bash: начни такую команду с
пробела (работает при `HISTCONTROL=ignorespace`) или почисти `~/.bash_history`.

1. **Neon.** Проект `life-rpg`, регион AWS Frankfurt (`eu-central-1`), **PostgreSQL 17** — та же
   версия, что локально и в `pg_dump` резервных копий. В Connection Details выключи
   **Connection pooling** и скопируй строку подключения роли-владельца: она нужна дважды, для
   Hyperdrive и для CI.
2. **Hyperdrive.** В `apps/api` войди в Cloudflare и создай конфигурацию без кеша запросов:
   ```bash
   pnpm exec wrangler login
   pnpm exec wrangler hyperdrive create life-rpg --connection-string="<строка Neon>" --caching-disabled
   ```
   Полученный `id` впиши в [apps/api/wrangler.jsonc](apps/api/wrangler.jsonc) вместо нулей и закоммить:
   это не секрет. Пока там нули, деплой падает.
3. **Google.** Отдельный OAuth-клиент для продакшена («Web application», например `LIFE RPG prod`):
   - Authorized JavaScript origins — `https://life-rpg.<поддомен>.workers.dev`;
   - Authorized redirect URIs — `https://life-rpg.<поддомен>.workers.dev/api/auth/callback/google`.

   ⚠️ Пока приложение в режиме **Testing**, войти могут только аккаунты из **Audience → Test users**.
   Перед раздачей ссылки внеси туда тестеров или переведи приложение в **In production**.
4. **Секреты Worker** — из `apps/api`, каждая команда спросит значение. Worker ещё не задеплоен,
   поэтому первая команда спросит, создать ли его, — ответь `yes`:
   ```bash
   pnpm exec wrangler secret put BETTER_AUTH_URL
   pnpm exec wrangler secret put BETTER_AUTH_SECRET
   pnpm exec wrangler secret put GOOGLE_CLIENT_ID
   pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET
   ```
   `BETTER_AUTH_URL` — адрес приложения без `/` в конце; `BETTER_AUTH_SECRET` — новая случайная
   строка (`openssl rand -base64 32`), не та, что локально; Google — из клиента шага 3.
5. **Окружение и секреты GitHub.** Секреты продакшена — **только в окружении `production`, не в
   секретах репозитория**: секреты репозитория получает любой workflow любой ветки, в том числе
   пулл-реквест с изменённым `ci.yml`.
   1. Settings → Environments → New environment → `production`.
   2. Deployment branches and tags → **Selected branches** → добавь только `main`.
   3. В этом окружении — Environment secrets:

   | Секрет | Что это |
   | --- | --- |
   | `CLOUDFLARE_API_TOKEN` | Cloudflare → Manage Account → Account API Tokens → шаблон «Edit Cloudflare Workers»; в Account Resources — только свой аккаунт, Zone Resources можно убрать: своего домена нет |
   | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare → Workers & Pages → Account ID |
   | `DATABASE_URL` | строка Neon из шага 1 |
   | `BACKUP_PASSPHRASE` | `openssl rand -base64 32`; **сохрани в менеджере паролей** — без неё копии не расшифровать |
6. **Первый деплой** — слей пулл-реквест в `main` и проверь:
   - `https://…/api/health` отвечает `{"status":"ok","db":"up"}`;
   - вход через Google, в том числе из установленного приложения на телефоне (на iOS — «Поделиться →
     На экран „Домой“»);
   - в Workers Logs — время CPU на запросы `/api/v1` (лимит бесплатного плана — 10 мс);
   - Actions → Backup → Run workflow: появился артефакт `db-backup-…`, и он **восстанавливается** —
     пройди «Восстановление из копии» в локальную базу (`postgres://postgres:postgres@host.docker.internal:5432/<новая база>`).
     Копия, которую ни разу не восстанавливали, не проверена.

GitHub отключает расписание, если в репозитории 60 дней нет активности: тогда Backup нужно
включить заново на вкладке Actions.

### Если деплой упал

- **Упал до миграций** (проверки или сборка) — продакшен не тронут: чини и сливай заново.
- **Упал после миграций** — Actions → запуск → Re-run failed jobs: уже применённые миграции drizzle
  пропустит. Откатить код — `pnpm exec wrangler rollback` из `apps/api`; миграции назад не откатываются.
- Поэтому миграция должна работать и со старым кодом: ломающее изменение схемы (удалить или
  переименовать колонку) — в два деплоя: сначала код, который её не использует, потом миграция.

### Восстановление из копии

1. Actions → Backup → нужный запуск → скачай артефакт и распакуй `life-rpg-<дата>.dump.gpg`.
2. Расшифруй (спросит `BACKUP_PASSPHRASE`):
   ```bash
   gpg --decrypt --output life-rpg.dump life-rpg-<дата>.dump.gpg
   ```
3. Восстанавливай не поверх рабочей базы, а в новую ветку Neon (Branches → Create branch). Ветка —
   копия текущей базы, поэтому `--clean` сначала удаляет её таблицы, а `--single-transaction` и
   `--exit-on-error` не оставят базу наполовину восстановленной:
   ```bash
   docker run --rm -i -e TARGET="<строка новой ветки Neon>" postgres:17-alpine \
     sh -c 'cat > /tmp/r.dump && pg_restore --clean --if-exists --single-transaction --exit-on-error --no-owner --no-privileges -d "$TARGET" /tmp/r.dump' < life-rpg.dump
   ```
4. Убедившись, что данные на месте, переключи продакшен на новую ветку — и Worker, и CI:
   ```bash
   pnpm exec wrangler hyperdrive update <id из wrangler.jsonc> --connection-string="<строка новой ветки Neon>"
   ```
   и замени секрет `DATABASE_URL` в окружении `production` на ту же строку: иначе следующий деплой
   накатит миграции, а Backup снимет копию со старой ветки.

Neon сам хранит историю изменений за короткое окно бесплатного плана: на ошибку «удалил минуту
назад» быстрее восстановить точку во времени в консоли Neon, чем копию.
