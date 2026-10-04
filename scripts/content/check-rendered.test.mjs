// Post-build render check: placeholders and stray braces in prerendered pages are caught;
// braces inside scripts and styles (framework payload, CSS) are not visible text.

import { describe, expect, it } from 'vitest';
import { renderedProblems } from './check-rendered.mjs';

describe('renderedProblems', () => {
  it('passes a page whose braces are only in scripts and styles', () => {
    const html = '<html><head><style>.a{color:red}</style></head><body><p>نص</p><script>self.x={"a":1}</script></body></html>';
    expect(renderedProblems(html)).toEqual([]);
  });

  it('flags a raw placeholder in visible text and in the page payload', () => {
    expect(renderedProblems('<p>قبل {verseRef} بعد</p>')).toEqual(['2 brace(s) in visible text', 'placeholder token(s): {verseRef}']);
    expect(renderedProblems('<p>ok</p><script>self.__next_f.push([1,"{verseRef}"])</script>')).toEqual(['placeholder token(s): {verseRef}']);
  });

  it('flags a stray brace in visible text', () => {
    expect(renderedProblems('<p>a } b</p>')).toEqual(['1 brace(s) in visible text']);
  });
});
