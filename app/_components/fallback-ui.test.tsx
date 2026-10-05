// Static tier on screen (A4, D42): the station's approved fallback is shown with the station's
// pre-written question buttons still enabled, so the child can continue. No new wording.
// Never prints record text.

import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createChainClassifier, type Provider } from '@/app/_lib/classifier';
import { loadLabels } from '@/app/_lib/labels';
import { item, libraryWithoutRules, runtimeLibrary } from '@/app/_lib/test-helpers';
import { answerWithTrace } from '@/app/_lib/trace';
import { askStep } from './ask-fixture';
import StationFlow from './StationFlow';

const fail: Provider['call'] = async () => { throw new Error('FIXTURE'); };
const both = createChainClassifier({
  primary: { name: 'anthropic', model: 'FIXTURE-P', timeoutMs: 8000, call: fail },
  secondary: { name: 'openai', model: 'FIXTURE-S', timeoutMs: 6000, call: fail },
});

describe('static tier on the ask step', () => {
  it('shows the approved fallback (FB1) and keeps every pre-written question button enabled', async () => {
    const { view, state } = await askStep('S1');
    const res = await answerWithTrace(libraryWithoutRules(), { stationId: 'S1', text: item('D02').input.text }, { classifier: both });
    expect(res.llm?.tier).toBe('static');
    const fb = runtimeLibrary().byId.get('S1.FB1')!;
    const ask = { id: view.ask[0].id, busy: false, reply: { segments: res.reply.segments.map((s) => ({ kind: s.kind, recordId: s.recordId, text: s.text })), verses: [], event: null, llmEvent: res.llmEvent as unknown as Record<string, unknown> } };
    const html = renderToString(<StationFlow view={view} labels={loadLabels()} initial={state} initialAsk={ask} />);
    expect(html).toContain('data-line="S1.FB1"');
    expect(html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')).toContain(fb.text); // approved wording only
    for (const q of view.ask) {
      const button = new RegExp(`<button[^>]*data-question="${q.id.replace(/\./g, '\\.')}"[^>]*>`).exec(html)![0];
      expect(button, q.id).not.toMatch(/\sdisabled/);
    }
  });
});
