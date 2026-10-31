import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const alias = { '@': fileURLToPath(new URL('./src', import.meta.url)) };

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
          environment: 'node',
          env: { NODE_ENV: 'test' },
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          env: { NODE_ENV: 'test' },
          // Firestore-backed suites need the Emulator Suite: run with `pnpm test:integration` (emulators:exec).
          testTimeout: 60_000,
          hookTimeout: 60_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
