import { runMigrations } from '../src/server/db/migrate';

export default async function setup() {
  process.env.DATABASE_URL ??= process.env.TEST_DATABASE_URL ?? 'postgres://pinnuli@localhost:5433/pinnuli_test';
  await runMigrations(process.env.TEST_DATABASE_URL ?? 'postgres://pinnuli@localhost:5433/pinnuli_test');
}
