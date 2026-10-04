// Classifier prompt (D25): the record-choice guidance is present, every caution line is kept, and
// the prompt's SHA-256 is pinned so any change to it is deliberate (eval results record it too).

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { SYSTEM_PROMPT } from './classifier';

// D25 prompt (2026-10-04). Update only together with a logged decision.
const PROMPT_SHA256 = 'fe1ec0af61d778843d88ecf75bca3e0e29d4f641196947d9e57c463a659d3ea7';

describe('classifier prompt', () => {
  it('is the recorded D25 prompt', () => {
    expect(createHash('sha256').update(SYSTEM_PROMPT).digest('hex')).toBe(PROMPT_SHA256);
  });

  it('keeps every caution line', () => {
    expect(SYSTEM_PROMPT).toContain('When unsure between two levels, choose the stricter one (D > C > OUT_OF_SCOPE > B > A).');
    expect(SYSTEM_PROMPT).toContain('for C, D and OUT_OF_SCOPE, null.');
    expect(SYSTEM_PROMPT).toContain('Only use IDs from the candidate list. Never quote, write or paraphrase a verse, hadith or tafsir.');
    expect(SYSTEM_PROMPT).toContain('C = disputed or highly sensitive');
    expect(SYSTEM_PROMPT).toContain('D = a personal ruling');
  });

  it('carries the D25 record-choice guidance and nothing that lowers a level', () => {
    expect(SYSTEM_PROMPT).toContain('use null only when no candidate fits');
    expect(SYSTEM_PROMPT).toContain('prefer an explanation that directly answers it over an answer written for a yes/no question');
    expect(SYSTEM_PROMPT).toContain('choose the one listed first (the higher retrieval score)');
    expect(SYSTEM_PROMPT).not.toMatch(/\b(lower|less strict|downgrade|choose A over B)\b/i);
  });
});
