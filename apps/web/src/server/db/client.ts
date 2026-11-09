import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;

declare global {
  // eslint-disable-next-line no-var
  var __pinnuliPool: pg.Pool | undefined;
}

export function getPool(): pg.Pool {
  if (!globalThis.__pinnuliPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL non impostata');
    globalThis.__pinnuliPool = new pg.Pool({ connectionString: url, max: 8 });
  }
  return globalThis.__pinnuliPool;
}

let _db: Db | undefined;
export function getDb(): Db {
  if (!_db) _db = drizzle(getPool(), { schema });
  return _db;
}

export { schema };
