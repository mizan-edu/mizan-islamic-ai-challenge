'use client';

// Phone layout (D67): portrait phones (narrower than 600 px) and landscape phones (shorter than
// 500 px). The same queries scope every phone rule in globals.css, so tablets and laptops never match.
// The server and the first client render assume "not a phone"; the real value follows on hydration.

import { useSyncExternalStore } from 'react';

export const PHONE_QUERY = '(max-width: 599px), (max-height: 499px)';
export const LANDSCAPE_PHONE_QUERY = '(max-height: 499px)';

export type PhoneLayout = 'portrait' | 'landscape' | null;

const layout = (): PhoneLayout =>
  !window.matchMedia(PHONE_QUERY).matches ? null : window.matchMedia(LANDSCAPE_PHONE_QUERY).matches ? 'landscape' : 'portrait';

const subscribe = (onChange: () => void) => {
  const queries = [PHONE_QUERY, LANDSCAPE_PHONE_QUERY].map((q) => window.matchMedia(q));
  queries.forEach((m) => m.addEventListener('change', onChange));
  return () => queries.forEach((m) => m.removeEventListener('change', onChange));
};

export const usePhone = (): PhoneLayout => useSyncExternalStore(subscribe, layout, () => null);
