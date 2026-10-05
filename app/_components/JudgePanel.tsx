// Judge panel (A1): the per-turn trace under an ask reply, for adults. Small, neutral and
// collapsible; placed below the step's controls so it never covers the child's content and never
// sits on or next to a verse card. Labels are approved UI strings (D37); values are IDs, codes and
// numbers from the trace, shown left-to-right. No record text, no child input.

import type { Labels } from '@/app/_lib/labels';
import { NO_MODEL_CALL } from '@/app/_lib/judge';
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

export default function JudgePanel({ trace, labels }: { trace: Trace; labels: Labels }) {
  if (!labels.judgeMode) return null;
  const r = trace.route;
  const routeParts = [r.type, r.code, r.fallbackReason, r.questionId, r.verseId, ...r.ruleIds].filter(Boolean);
  const v = trace.validator;
  return (
    <details open className="mt-6 self-stretch rounded-xl border border-stone bg-card px-4 text-sm" data-judge-panel>
      <summary className="flex min-h-11 cursor-pointer items-center text-sm text-ink-2">{labels.judgeMode}</summary>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 pb-3">
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
    </details>
  );
}
