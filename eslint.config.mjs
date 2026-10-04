import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    settings: { next: { rootDir: 'app/' } },
  },
  {
    // R9: runtime code never reaches the ingestion/review tooling under /scripts.
    files: ['app/**/*.{ts,tsx,js,jsx,mjs}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['**/scripts/**', 'scripts/**'], message: 'R9: app code must not import from /scripts.' }] }],
    },
  },
  globalIgnores(['app/.next/**', 'app/next-env.d.ts', 'node_modules/**', 'scripts/**', 'sources/**', '.snapshot-preview/**', 'docs/**', 'content/**', 'eval/**']),
]);
