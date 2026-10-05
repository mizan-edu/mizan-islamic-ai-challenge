'use client';

// Remembers ?judge=1 (or clears it with ?judge=0) for this browser session on whichever page was
// opened with it (A1). Renders nothing.

import { useEffect } from 'react';
import { judgeEnabled } from '@/app/_lib/judge';

export default function JudgeFlag() {
  useEffect(() => { judgeEnabled(); }, []);
  return null;
}
