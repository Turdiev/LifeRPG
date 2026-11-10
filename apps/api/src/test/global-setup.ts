import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';
import { TEST_DATABASE_URL } from './database';

const ADMIN_URL = 'postgres://postgres:postgres@127.0.0.1:5432/postgres';

// Отдельная база, чтобы тесты не трогали данные разработки в life_rpg.
export default async function setup() {
  const admin = new Client({ connectionString: ADMIN_URL });
  try {
    await admin.connect();
  } catch (error) {
    throw new Error('PostgreSQL недоступен: запусти Docker Desktop и `pnpm db:up`', { cause: error });
  }
  const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', ['life_rpg_test']);
  if (rowCount === 0) await admin.query('CREATE DATABASE life_rpg_test');
  await admin.end();

  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  await migrate(drizzle({ client }), {
    migrationsFolder: join(dirname(fileURLToPath(import.meta.url)), '../db/migrations'),
  });
  await client.end();
}
