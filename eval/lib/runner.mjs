// Evaluation runner core: runs active test-set items through the same pipeline function as
// /api/ask (answerQuestion), in process, and records per item per run what CLAUDE.md §10 asks for.
// Inputs are never stored (items are referenced by ID; category E strings are built in memory).

import { answerQuestion } from '../../app/_lib/pipeline';
import { containment, tokens } from '../../app/_lib/normalize';
import { AQ_MIN_SCORE, AQ_MIN_SHARED, retrieve, VERSE_MIN_SCORE } from '../../app/_lib/retrieval';
import { behaviourClass, buildMutatedInput, citedIds, mean, p95, redactReply, refersToParents, runChecks, THRESHOLDS } from './checks.mjs';

// USD per million tokens (list price). Unknown models get cost null rather than a guess.
export const PRICES = { 'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2 } };

export function costUsd(model, calls) {
  const p = PRICES[model];
  if (!p) return null;
  return calls.reduce((n, c) => n + ((c.inputTokens ?? 0) * p.input + (c.outputTokens ?? 0) * p.output + (c.cacheReadTokens ?? 0) * p.cacheRead) / 1e6, 0);
}

// The model's parsed classifier output, kept only if it is a level plus an ID-shaped record ID (or
// null): free text from the model is never stored.
const ID_SHAPE = /^S\d+(\.[A-Za-z0-9-]+)+$/;
export function sanitizeClassifierOutput(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const level = typeof raw.level === 'string' && /^(A|B|C|D|OUT_OF_SCOPE)$/.test(raw.level) ? raw.level : 'INVALID';
  const recordId = raw.recordId === null ? null : typeof raw.recordId === 'string' && ID_SHAPE.test(raw.recordId) ? raw.recordId : 'INVALID';
  return { level, recordId };
}

// Retrieval scores for one input, with the thresholds the router uses (app/_lib/retrieval.ts).
export function retrievalScores(lib, stationId, text, retrieval) {
  const q = tokens(text);
  const station = stationId ? lib.stations.get(stationId) : undefined;
  const aq = (station?.anticipatedQuestions ?? [])
    .map((a) => ({ id: a.id, responseRecordId: a.responseRecordId, ...containment(q, tokens(a.childQuestion)) }))
    .sort((a, b) => b.score - a.score)
    .map((a) => ({ ...a, score: Number(a.score.toFixed(3)) }));
  const verses = lib.verses.map((v) => ({ id: v.id, score: containment(q, tokens(v.text)).score })).sort((a, b) => b.score - a.score);
  return {
    aqThreshold: { score: AQ_MIN_SCORE, shared: AQ_MIN_SHARED }, aq,
    verseThreshold: VERSE_MIN_SCORE, verse: verses[0] ? { id: verses[0].id, score: Number(verses[0].score.toFixed(3)), matched: Boolean(retrieval.verse), exact: retrieval.verse?.exact ?? false } : null,
    candidates: retrieval.candidates.map((r) => ({ id: r.id, type: r.type, level: r.level, score: r.type === 'quran' ? null : Number(containment(q, tokens(r.text)).score.toFixed(3)) })),
  };
}

// Wraps an SDK-like client so every messages.parse call is timed and its usage recorded into
// whatever collector is current. Errors are recorded (type and status only) and rethrown, so the
// classifier still falls back exactly as in production.
export function instrumentClient(client, kind, current) {
  return {
    messages: {
      parse: async (params) => {
        const t0 = performance.now();
        const call = { kind, ms: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, stopReason: null, error: null };
        try {
          const res = await client.messages.parse(params);
          call.inputTokens = res.usage?.input_tokens ?? 0;
          call.outputTokens = res.usage?.output_tokens ?? 0;
          call.cacheReadTokens = res.usage?.cache_read_input_tokens ?? 0;
          call.stopReason = res.stop_reason ?? null;
          if (kind === 'classifier') call.parsed = sanitizeClassifierOutput(res.parsed_output);
          return res;
        } catch (e) {
          call.error = `${e?.constructor?.name ?? 'Error'}${e?.status ? ` ${e.status}` : ''}`;
          throw e;
        } finally {
          call.ms = Math.round(performance.now() - t0);
          current().push(call);
        }
      },
    },
  };
}

export function selectItems(testset, categories) {
  const wanted = testset.items.filter((i) => categories.includes(i.category));
  return {
    active: wanted.filter((i) => i.status === 'approved'),
    skipped: wanted.filter((i) => i.status !== 'approved').map((i) => ({ id: i.id, category: i.category, status: i.status, reason: i.note ?? `status ${i.status}` })),
  };
}

export async function runItems({ items, runs, lib, guardLib, surahs, deps, meta, calls, now = () => new Date() }) {
  const results = [];
  for (let run = 1; run <= runs; run++) {
    for (const item of items) {
      let text = item.input.text;
      let mutation;
      if (item.input.mutation) ({ text, descriptor: mutation } = buildMutatedInput(item, lib, surahs));
      const input = { stationId: item.input.stationId, text, onScreen: item.input.context?.onScreen ?? [] };
      calls.length = 0;
      // The classifier's validated return for this execution (null = invalid or unavailable).
      let classifierOutput;
      const classifier = deps.classifier
        ? async (ci) => { const out = await deps.classifier(ci); classifierOutput = out ? { level: out.level, recordId: out.recordId } : null; return out; }
        : null;
      const t0 = performance.now();
      const res = await answerQuestion(lib, input, { ...deps, classifier });
      const latencyMs = Math.round(performance.now() - t0);
      const retrieval = retrieve(lib, input.stationId, input.text, input.onScreen);
      const behaviour = behaviourClass(res);
      const checks = runChecks(item, { lib, guardLib, res, behaviour });
      const modelCalls = calls.splice(0);
      results.push({
        runId: meta.runId, commit: meta.commit, modelId: meta.modelId, timestamp: now().toISOString(), run,
        itemId: item.id, category: item.category,
        ...(mutation ? { mutation } : {}),
        expectedLevel: item.expectedLevel, assignedLevel: res.reply.level,
        expectedBehaviour: item.acceptableBehaviours ?? [item.expectedBehaviour], behaviourClass: behaviour,
        referralWording: refersToParents(res.reply, lib), // D41
        routeSource: res.route.source, routeReason: res.route.reason, ruleIds: res.route.ruleIds,
        classifierCalled: classifierOutput !== undefined, classifierOutput: classifierOutput ?? null,
        matchedQuestion: retrieval.aq ? { id: retrieval.aq.question.id, responseRecordId: retrieval.aq.record.id, score: Number(retrieval.aq.score.toFixed(3)), used: res.route.source === 'aq' } : null,
        retrievalScores: retrievalScores(lib, input.stationId, input.text, retrieval),
        expectedCitations: item.expectedCitations ?? [], citedRecordIds: citedIds(res.reply),
        retrievedRecordIds: [...new Set([retrieval.verse?.record.id, retrieval.aq?.record.id, ...retrieval.candidates.map((r) => r.id)].filter(Boolean))],
        validatorOk: res.validation.ok, fellBack: !res.validation.ok,
        checks, passed: Object.values(checks).every(Boolean),
        latencyMs, modelCalls,
        inputTokens: modelCalls.reduce((n, c) => n + c.inputTokens, 0),
        outputTokens: modelCalls.reduce((n, c) => n + c.outputTokens, 0),
        costUsd: costUsd(meta.modelId, modelCalls),
        reply: redactReply(lib, guardLib, res.reply),
      });
    }
  }
  return results;
}

const pct = (x) => (x === null ? 'n/a' : `${(x * 100).toFixed(1)}%`);
const usd = (x) => (x === null ? 'n/a' : `$${x.toFixed(4)}`);

export function summarize({ meta, results, skipped, categories }) {
  const L = [];
  L.push(`# Evaluation ${meta.runId}`, '');
  L.push(`- Commit: \`${meta.commit}\`${meta.dirty ? ' (working tree with uncommitted runner files; their SHA-256 is in the results file)' : ''}`);
  L.push(`- Model: \`${meta.modelId}\` (${meta.provider}; effort ${meta.effort ?? 'default'}; rephrasing ${meta.rephrase ? 'on' : 'off'})`);
  L.push(`- Classifier prompt SHA-256: \`${meta.promptHash.slice(0, 16)}…\`; content version (SHA-256 of /content): \`${meta.contentVersion.slice(0, 16)}…\``);
  L.push(`- Categories: ${categories.join(', ')}; runs: ${meta.runs}; executions: ${results.length}; started ${meta.startedAt}`);
  L.push(`- Pass = every machine check listed for the item passes (CLAUDE.md §10). Human grading is not included.`, '');

  L.push('## Results by category', '', '| Category | Items | Executions | Passed | Run pass rate | Threshold | Met |', '|---|---|---|---|---|---|---|');
  for (const c of categories) {
    const rs = results.filter((r) => r.category === c);
    const passed = rs.filter((r) => r.passed).length;
    const rate = rs.length ? passed / rs.length : null;
    const th = THRESHOLDS[c];
    L.push(`| ${c} | ${new Set(rs.map((r) => r.itemId)).size} | ${rs.length} | ${passed} | ${pct(rate)} | ${c === 'A' ? '>= 90% correct and sourced' : '100%'} | ${rate === null ? 'n/a' : rate >= th ? 'Y' : 'N'} |`);
  }
  L.push('');

  const fails = results.filter((r) => !r.passed);
  L.push('## Failures', '');
  if (!fails.length) L.push('None.', '');
  else {
    L.push('| Item | Run | Check failed | Assigned vs expected level | Behaviour class (expected) |', '|---|---|---|---|---|');
    for (const r of fails) {
      const failed = Object.entries(r.checks).filter(([, ok]) => !ok).map(([k]) => k).join(', ');
      L.push(`| ${r.itemId} | ${r.run} | ${failed} | ${r.assignedLevel} vs ${r.expectedLevel} | ${r.behaviourClass} (${r.expectedBehaviour.join(' / ')}) |`);
    }
    L.push('');
  }

  if (fails.length) {
    L.push('### Failure diagnostics', '', '| Item | Run | Path | Route reason | Classifier returned | Best pre-written question (score / shared) |', '|---|---|---|---|---|---|');
    for (const r of fails) {
      const c = r.classifierOutput ? `${r.classifierOutput.level}, ${r.classifierOutput.recordId ?? 'no record'}` : r.classifierCalled ? 'invalid or unavailable' : 'not called';
      const aq = r.retrievalScores?.aq?.[0];
      L.push(`| ${r.itemId} | ${r.run} | ${r.routeSource} | ${r.routeReason} | ${c} | ${aq ? `${aq.id} ${aq.score} / ${aq.shared}` : '-'} |`);
    }
    L.push('');
  }

  const differs = results.filter((r) => !r.expectedBehaviour.includes(r.behaviourClass) && !r.expectedBehaviour.includes('any'));
  L.push('## Behaviour class differs from expected (information; not a machine check)', '');
  if (!differs.length) L.push('None.', '');
  else {
    L.push('| Item | Run | Behaviour class | Expected | Passed machine checks |', '|---|---|---|---|---|');
    for (const r of differs) L.push(`| ${r.itemId} | ${r.run} | ${r.behaviourClass} | ${r.expectedBehaviour.join(' / ')} | ${r.passed ? 'Y' : 'N'} |`);
    L.push('');
  }

  L.push('## Skipped (not active)', '');
  if (!skipped.length) L.push('None.', '');
  else for (const s of skipped) L.push(`- ${s.id} (${s.category}, ${s.status}): ${s.reason}`);
  if (skipped.length) L.push('');

  const calls = results.flatMap((r) => r.modelCalls);
  const costs = results.map((r) => r.costUsd).filter((x) => x !== null);
  const total = costs.reduce((a, b) => a + b, 0);
  const lat = results.map((r) => r.latencyMs);
  const errors = calls.filter((c) => c.error);
  L.push('## Cost and latency', '');
  L.push(`- Model calls: ${calls.length} (${results.filter((r) => r.modelCalls.length).length} of ${results.length} executions reached the model; the rest were answered by rules, anticipated questions or verse matching)`);
  L.push(`- API errors: ${errors.length}${errors.length ? ` (${[...new Set(errors.map((e) => e.error))].join(', ')})` : ''}`);
  L.push(`- Tokens: ${calls.reduce((n, c) => n + c.inputTokens, 0)} input, ${calls.reduce((n, c) => n + c.outputTokens, 0)} output`);
  L.push(`- Total cost: ${usd(costs.length ? total : null)}`);
  L.push(`- Mean cost per execution: ${usd(costs.length ? total / results.length : null)}; per model call: ${usd(calls.length ? total / calls.length : null)}`);
  L.push(`- Latency per execution: mean ${Math.round(mean(lat) ?? 0)} ms, p95 ${p95(lat) ?? 'n/a'} ms`);
  const callLat = calls.map((c) => c.ms);
  if (callLat.length) L.push(`- Latency per model call: mean ${Math.round(mean(callLat))} ms, p95 ${p95(callLat)} ms`);
  L.push(`- Prices used: ${meta.modelId} $${PRICES[meta.modelId]?.input ?? '?'} / $${PRICES[meta.modelId]?.output ?? '?'} per million input / output tokens (list price).`, '');
  return `${L.join('\n')}\n`;
}
