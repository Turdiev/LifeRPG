import { createApp } from './app';
import { connectDb } from './db/client';
import { DEV_USER_ID } from './dev-user';

const app = createApp({
  connectDb: (env) => connectDb(env.HYPERDRIVE.connectionString),
  devUserId: DEV_USER_ID,
});

export default app;
