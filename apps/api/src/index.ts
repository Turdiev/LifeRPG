import { sql } from 'drizzle-orm';
import { createApp } from './app';
import { connectDb } from './db/client';

const app = createApp({
  pingDb: async (env) => {
    const { db, close } = await connectDb(env.HYPERDRIVE.connectionString);
    try {
      await db.execute(sql`select 1`);
    } finally {
      await close();
    }
  },
});

export default app;
