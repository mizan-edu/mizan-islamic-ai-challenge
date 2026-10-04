// Build-script guard. Vercel builds through its own adapter ("modifyConfig" / "onBuildComplete"),
// which does not write prerendered HTML to .next/server/app; a post-build step that read those files
// failed every Vercel build from 18f0a7c to 2279460 although local and fresh-clone builds passed.
// So `npm run build` is plain `next build` with no pre/post steps, and the placeholder guard runs
// inside the prerendered pages, where it fails the build on Vercel too.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const scripts = (JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> }).scripts;

describe('npm run build', () => {
  it('is plain next build, with no prebuild or postbuild step', () => {
    expect(scripts.build).toBe('next build');
    expect(scripts.prebuild).toBeUndefined();
    expect(scripts.postbuild).toBeUndefined();
  });

  it('the placeholder guard runs inside the prerendered pages', () => {
    for (const page of ['app/parent/page.tsx', 'app/stations/[id]/page.tsx']) {
      const src = readFileSync(path.join(ROOT, page), 'utf8');
      expect(src, page).toContain('assertNoPlaceholderProblems(lib)');
    }
  });
});
