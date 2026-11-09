import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import * as schema from './schema';

// Клиент создаётся на каждый запрос: настоящий пул соединений держит Hyperdrive,
// поэтому открыть клиент в Worker дёшево (рекомендация Cloudflare для Workers).
export async function connectDb(connectionString: string) {
  const client = new Client({ connectionString });
  await client.connect();
  return {
    db: drizzle({ client, schema }),
    close: () => client.end(),
  };
}
