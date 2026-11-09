import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import * as schema from './schema';

// A client is created per request: Hyperdrive owns the real connection pool,
// so opening a client in the Worker is cheap (Cloudflare Workers best practice).
export async function connectDb(connectionString: string) {
  const client = new Client({ connectionString });
  await client.connect();
  return {
    db: drizzle({ client, schema }),
    close: () => client.end(),
  };
}
