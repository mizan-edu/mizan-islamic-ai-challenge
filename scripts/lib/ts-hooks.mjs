// Lets Node tooling scripts import the app's TypeScript modules (app/_lib) directly: Node strips
// the types; this hook adds ".ts" to the app's extensionless relative imports. Import this module
// first, then load app modules with dynamic import().

import { registerHooks } from 'node:module';
import path from 'node:path';

registerHooks({
  resolve(specifier, context, nextResolve) {
    let out;
    try {
      out = nextResolve(specifier, context);
    } catch (e) {
      if (!/^\.\.?\//.test(specifier) || path.extname(specifier)) throw e;
      out = nextResolve(`${specifier}.ts`, context);
    }
    return out.url.endsWith('.ts') ? { ...out, format: 'module-typescript' } : out;
  },
});
