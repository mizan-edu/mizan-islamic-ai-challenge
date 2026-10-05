// Judge panel (A1), extended into the AI lens (D54): every decision behind the step on screen, each
// labelled "rule" or "model", with its record IDs, level and sources, and for model calls the latency,
// tokens and fallback flag; on the ask step, the reply's full trace follows. For adults only: small,
// neutral, collapsible, placed below the step's controls so it never covers the child's content and
// never sits on or next to a verse card. No animation. Labels are approved UI strings (D37); the five
// D54 labels are drafts until Review 1, so their English code shows meanwhile. Values are IDs, codes
// and numbers, shown left-to-right. No record text, no child input.

import type { Labels } from '@/app/_lib/labels';
import { NO_MODEL_CALL } from '@/app/_lib/judge';
import type { LensDecision, LensSource } from '@/app/_lib/lens';
import type { Trace } from '@/app/_lib/trace';

const Code = ({ children }: { children: React.ReactNode }) => (
  <code dir="ltr" className="font-mono text-xs break-all text-ink">{children}</code>
);

function Row({ label, children, field }: { label?: string; children: React.ReactNode; field: string }) {
  if (!label) return null;
  return (
    <>
      <dt className="text-ink-2">{label}</dt>
      <dd dir="ltr" className="flex flex-wrap items-baseline justify-end gap-x-2" data-judge-field={field}>{children}</dd>
    </>
  );
}

const source = (s: LensSource) => `${s.id} ${s.platform ?? 'MIZAN library'}${s.platformId ? ` ${s.platformId}` : ''}`;
const tokens = (n: number | null) => (n === null ? '–' : String(n));

function Decision({ d, labels }: { d: LensDecision; labels: Labels }) {
  return (
    <li className="border-t border-stone pt-2" data-lens-decision={d.kind} data-lens-code={d.code}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <Row label={labels.judgeDecision ?? 'decision'} field="decision">
          <span className={`rounded px-1.5 font-mono text-xs ${d.kind === 'model' ? 'bg-sun-soft text-ink' : 'bg-sky-soft text-ink'}`} data-lens-kind={d.kind}>{d.kind}</span>
          <Code>{d.code}</Code>
        </Row>
        <Row label={labels.judgeRecords ?? 'records'} field="records">
          <Code>{`${d.input ? `${d.input} → ` : ''}${d.recordIds.join(' · ') || '—'}`}</Code>
        </Row>
        <Row label={labels.judgeLevel ?? 'level'} field="decisionLevel"><Code>{d.level}</Code></Row>
        {d.sources.length > 0 && (
          <Row label={labels.judgeSource ?? 'source'} field="source">
            <span className="flex flex-col items-end">{d.sources.map((s, i) => <Code key={`${s.id}-${i}`}>{source(s)}</Code>)}</span>
          </Row>
        )}
        {d.model ? (
          <>
            <Row label={labels.judgeModel ?? 'model'} field="modelCalls">
              <span className="flex flex-col items-end">
                {d.model.calls.map((c, i) => <Code key={i}>{`${c.provider} · ${c.model} · ${c.result} · ${c.ms} ms`}</Code>)}
              </span>
            </Row>
            <Row label={labels.judgeTokens ?? 'tokens'} field="tokens">
              <Code>{d.model.calls.map((c) => `${tokens(c.inputTokens)} / ${tokens(c.outputTokens)}`).join(' · ')}</Code>
            </Row>
            <Row label={labels.judgeLatency ?? 'latency'} field="decisionLatency"><Code>{`${d.model.latencyMs} ms`}</Code></Row>
            <Row label={labels.judgeFallback ?? 'fallback'} field="fallback"><Code>{d.model.fallback ? `yes · ${d.model.tier}` : 'no'}</Code></Row>
          </>
        ) : (
          <Row label={labels.judgeModel ?? 'model'} field="noModel"><span>{labels.judgeNoModelCall ?? NO_MODEL_CALL}</span></Row>
        )}
      </dl>
    </li>
  );
}

// The evaluation page passes only a trace (no station screen, no decisions), exactly as before.
export default function JudgePanel({ decisions = [], trace = null, labels }: { decisions?: LensDecision[]; trace?: Trace | null; labels: Labels }) {
  if (!labels.judgeMode) return null;
  const r = trace?.route;
  const routeParts = r ? [r.type, r.code, r.fallbackReason, r.questionId, r.verseId, ...r.ruleIds].filter(Boolean) : [];
  const v = trace?.validator;
  return (
    <details open className="mt-6 self-stretch rounded-xl border border-stone bg-card px-4 text-sm" data-judge-panel>
      <summary className="flex min-h-11 cursor-pointer items-center text-sm text-ink-2">{labels.judgeMode}</summary>
      {decisions.length > 0 && (
        <ol className="flex flex-col gap-2 pb-3" data-lens>
          {decisions.map((d, i) => <Decision key={`${d.code}-${i}`} d={d} labels={labels} />)}
        </ol>
      )}
      {trace && v && (
        <dl className={`grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 pb-3 ${decisions.length ? 'border-t border-stone pt-2' : ''}`} data-judge-trace>
          <Row label={labels.judgeRoute} field="route"><Code>{routeParts.join(' · ')}</Code></Row>
          <Row label={labels.judgeLevel} field="level"><Code>{trace.level}</Code></Row>
          <Row label={labels.judgeClassifierLevel} field="classifierLevel"><Code>{trace.classifierLevel ?? '—'}</Code></Row>
          <Row label={labels.judgeModel} field="model">
            {trace.model === NO_MODEL_CALL ? <span>{labels.judgeNoModelCall ?? NO_MODEL_CALL}</span> : <Code>{[trace.provider, trace.model].filter(Boolean).join(' · ')}</Code>}
          </Row>
          <Row label={labels.judgeRetrieved} field="retrieved">
            <Code>{trace.retrieved.map((x) => `${x.questionId ? `${x.questionId}→` : ''}${x.id} ${x.score ?? '–'}`).join(' · ') || '—'}</Code>
            <span className="w-full text-end"><Code>{`AQ≥${trace.thresholds.question} (${trace.thresholds.questionSharedWords}) · VERSE≥${trace.thresholds.verse}`}</Code></span>
          </Row>
          <Row label={labels.judgeCited} field="cited"><Code>{trace.cited.join(' · ') || '—'}</Code></Row>
          <Row label={labels.judgeValidator} field="validator">
            <span>{v.result === 'pass' ? labels.judgePass : labels.judgeBlocked}</span>
            {v.result === 'blocked' && <Code>{v.codes.join(' · ')}</Code>}
          </Row>
          <Row label={labels.judgeLatency} field="latency"><Code>{`${trace.latencyMs} ms`}</Code></Row>
        </dl>
      )}
    </details>
  );
}
