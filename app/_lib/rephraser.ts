// Model rephrasing of NA science/UI lines only (reply.ts decides eligibility; validator.ts checks
// the result). JSON output only; model ID from env. Any failure keeps the approved wording.

import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { createAnthropicClient } from './anthropic';
import type { Rephraser } from './reply';

const Schema = z.object({ text: z.string() });

export const REPHRASE_PROMPT = [
  'Rephrase one short Arabic science or interface line for a child aged 4-6.',
  'Modern Standard Arabic, fully vowelled, one idea, at most 10 words per sentence, warm, never "wrong" or "no".',
  'Keep the meaning exactly. Add nothing: no religious content, no mention of God, no verse, hadith or tafsir.',
  'Return JSON only: {"text": "..."}.',
].join('\n');

interface MessagesParseClient {
  messages: { parse: (params: Record<string, unknown>) => Promise<{ parsed_output?: unknown; stop_reason?: string | null }> };
}

export function createAnthropicRephraser(opts: { model: string; client?: MessagesParseClient }): Rephraser {
  const client: MessagesParseClient = opts.client ?? (createAnthropicClient() as unknown as MessagesParseClient);
  return async (text) => {
    try {
      const res = await client.messages.parse({
        model: opts.model,
        max_tokens: 1024,
        system: REPHRASE_PROMPT,
        messages: [{ role: 'user', content: JSON.stringify({ line: text }) }],
        output_config: { format: zodOutputFormat(Schema) },
      });
      if (res.stop_reason === 'refusal') return null;
      const parsed = Schema.safeParse(res.parsed_output);
      return parsed.success && parsed.data.text.trim() ? parsed.data.text.trim() : null;
    } catch {
      return null;
    }
  };
}

export function rephraserFromEnv(env: NodeJS.ProcessEnv = process.env): Rephraser | null {
  if (env.LLM_PROVIDER !== 'anthropic' || !env.LLM_MODEL || env.LLM_REPHRASE !== 'on') return null;
  return createAnthropicRephraser({ model: env.LLM_MODEL, client: createAnthropicClient(env) as unknown as MessagesParseClient });
}
