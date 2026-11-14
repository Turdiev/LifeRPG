import { defineConfig } from 'drizzle-kit';

// Миграции применяются только к ЛОКАЛЬНОЙ базе; продакшен мигрирует CI (.github/workflows/deploy.yml).
const LOCAL_URL = 'postgres://postgres:postgres@127.0.0.1:5432/life_rpg';
const url = process.env['DATABASE_URL'] ?? LOCAL_URL;

// Удалённую базу разрешает только явный флаг, который выставляет workflow деплоя: случайный
// DATABASE_URL в окружении разработчика не должен накатить миграции на продакшен.
const allowRemote = process.env['DRIZZLE_ALLOW_REMOTE'] === '1';
const { hostname } = new URL(url);
if (!allowRemote && !['localhost', '127.0.0.1', '[::1]'].includes(hostname)) {
  throw new Error(`Refusing to run drizzle-kit against non-local host "${hostname}"`);
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dbCredentials: { url },
});
