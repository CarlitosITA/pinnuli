import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'node:path';
import pg from 'pg';

export async function runMigrations(url = process.env.DATABASE_URL) {
  if (!url) throw new Error('DATABASE_URL non impostata');
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  try {
    const folder = process.env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), 'drizzle');
    await migrate(drizzle(pool), { migrationsFolder: folder });
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => console.log('Migrazioni applicate.'))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
