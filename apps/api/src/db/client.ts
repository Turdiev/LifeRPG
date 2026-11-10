import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type Executor = Db | Tx;

export type DbConnection = { db: Db; close: () => Promise<void> };

// Клиент создаётся на каждый запрос: настоящий пул соединений держит Hyperdrive,
// поэтому открыть клиент в Worker дёшево (рекомендация Cloudflare для Workers).
export async function connectDb(connectionString: string): Promise<DbConnection> {
  const client = new Client({ connectionString });
  await client.connect();
  return {
    db: drizzle({ client, schema }),
    close: () => client.end(),
  };
}
