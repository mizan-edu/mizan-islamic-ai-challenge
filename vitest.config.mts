import path from 'node:path';
import { defineConfig } from 'vitest/config';

// App unit tests (npm test). The snapshot tooling keeps its own node:test suite (npm run test:snapshot).
export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'app/src') } },
  test: {
    include: ['app/src/**/*.test.ts', 'app/src/**/*.test.tsx'],
    environment: 'node',
  },
});
