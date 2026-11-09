import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    include: ['test/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://pinnuli@localhost:5433/pinnuli_test',
      SESSION_SECRET: 'test-test-test-test-test-test-test-test',
      ADMIN_PASSWORD: 'password-di-prova',
    },
    globalSetup: ['test/global-setup.ts'],
  },
});
