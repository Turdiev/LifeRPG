import type { Db } from './db/client';

export type AppEnv = {
  Bindings: Env;
  Variables: { db: Db; userId: string };
};
