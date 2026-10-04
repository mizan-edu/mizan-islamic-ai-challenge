import path from 'node:path';
import { defineConfig } from 'vitest/config';

// App unit tests and the asset-tooling tests (npm test). The snapshot tooling keeps its own node:test suite (npm run test:snapshot).
export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname) } },
  test: {
    include: ['app/**/*.test.ts', 'app/**/*.test.tsx', 'scripts/{assets,content}/**/*.test.mjs', 'eval/**/*.test.mjs'],
    environment: 'node',
  },
});
