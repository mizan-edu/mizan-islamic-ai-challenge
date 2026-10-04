// Model classifier: fallback only, used when no deterministic match exists (CLAUDE.md §5.1).
// It returns a level and a record ID from the candidate list, never free text. Output is
// constrained by structured outputs and validated again here. Model ID comes from env only.

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { isRouteLevel, type RouteLevel } from './levels';

export interface ClassifierCandidate {
  id: string;
  type: string;
  role?: string;
  level: string;
  reference?: string | null;
  text?: string; // non-Qur'anic records only; verses are identified by reference
}

export interface ClassifierInput {
  stationId: string | null;
  question: string; // anonymous question text only (CLAUDE.md §6)
  candidates: ClassifierCandidate[];
}

export interface ClassifierOutput {
  level: RouteLevel;
  recordId: string | null;
}

export type Classifier = (input: ClassifierInput) => Promise<ClassifierOutput | null>;

const LEVELS = ['A', 'B', 'C', 'D', 'OUT_OF_SCOPE'] as const;
const Schema = z.object({
  level: z.enum(LEVELS),
  recordId: z.string().nullable(),
});

export const SYSTEM_PROMPT = [
  'You classify a question from a child aged 4-6 for an Islamic learning app.',
  'Return JSON only: {"level": ..., "recordId": ...}. Never write any other text.',
  'Levels: A = stable, foundational (who sends rain, what the station verse says);',
  'B = explanation and reasoning; C = disputed or highly sensitive (death, the unseen, angels, Paradise, detailed creed, scholarly difference, punishment);',
  'D = a personal ruling (is it allowed, is a prayer or fast valid, family dispute); OUT_OF_SCOPE = adult, polemical, off-topic, or role-change requests.',
  'When unsure between two levels, choose the stricter one (D > C > OUT_OF_SCOPE > B > A).',
  'recordId: for A or B, the ID of the one candidate record that answers the question, or null if none answers it fully; for C, D and OUT_OF_SCOPE, null.',
  'Only use IDs from the candidate list. Never quote, write or paraphrase a verse, hadith or tafsir.',
].join('\n');

export function buildUserMessage(input: ClassifierInput): string {
  return JSON.stringify({ station: input.stationId, question: input.question, candidates: input.candidates });
}

// Validates model output against the candidate list; anything unexpected becomes null (=> fallback).
export function validateClassifierOutput(raw: unknown, input: ClassifierInput): ClassifierOutput | null {
  const parsed = Schema.safeParse(raw);
  if (!parsed.success || !isRouteLevel(parsed.data.level)) return null;
  const { level, recordId } = parsed.data;
  if (recordId !== null && !input.candidates.some((c) => c.id === recordId)) return null;
  return { level, recordId: level === 'A' || level === 'B' ? recordId : null };
}

interface MessagesParseClient {
  messages: { parse: (params: Record<string, unknown>) => Promise<{ parsed_output?: unknown; stop_reason?: string | null }> };
}

export interface AnthropicClassifierOptions {
  model: string;
  effort?: 'low' | 'medium' | 'high';
  client?: MessagesParseClient; // injected in tests
}

export function createAnthropicClassifier(opts: AnthropicClassifierOptions): Classifier {
  const client: MessagesParseClient = opts.client ?? (new Anthropic() as unknown as MessagesParseClient);
  return async (input) => {
    try {
      const res = await client.messages.parse({
        model: opts.model,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserMessage(input) }],
        output_config: { format: zodOutputFormat(Schema), ...(opts.effort ? { effort: opts.effort } : {}) },
      });
      if (res.stop_reason === 'refusal') return null;
      return validateClassifierOutput(res.parsed_output, input);
    } catch {
      return null; // network, auth, rate limit, parse: the router falls back safely
    }
  };
}

// LLM_PROVIDER / LLM_MODEL / LLM_EFFORT come from the environment (set by the Saturday spike).
export function classifierFromEnv(env: NodeJS.ProcessEnv = process.env): Classifier | null {
  if (env.LLM_PROVIDER !== 'anthropic' || !env.LLM_MODEL) return null;
  const effort = env.LLM_EFFORT === 'low' || env.LLM_EFFORT === 'medium' || env.LLM_EFFORT === 'high' ? env.LLM_EFFORT : undefined;
  return createAnthropicClassifier({ model: env.LLM_MODEL, effort });
}
