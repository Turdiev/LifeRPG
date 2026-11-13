import { createApp } from './app';
import { authService, createAuth } from './auth/auth';
import { connectDb } from './db/client';

const app = createApp({
  connectDb: (env) => connectDb(env.HYPERDRIVE.connectionString),
  createAuth: (env, db) => authService(createAuth(env, db)),
});

export default app;
