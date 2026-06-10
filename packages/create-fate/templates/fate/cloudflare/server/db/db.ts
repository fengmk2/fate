import { AsyncLocalStorage } from 'node:async_hooks';
import { and, eq, gt, like, sql } from 'drizzle-orm';
import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import schema from './schema.ts';

export type Database = DrizzleD1Database<typeof schema>;
export type D1Binding = Parameters<typeof drizzle>[0];

const store = new AsyncLocalStorage<Database>();

export const createDb = (binding: D1Binding): Database => drizzle(binding, { schema });

export const withDatabase = <T>(binding: D1Binding, callback: () => T): T =>
  store.run(createDb(binding), callback);

const getDb = (): Database => {
  const db = store.getStore();
  if (!db) {
    throw new Error('cloudflare example: D1 database is unavailable.');
  }
  return db;
};

export const db = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export { and, eq, gt, like, sql };
