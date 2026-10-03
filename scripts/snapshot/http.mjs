// HTTP client for the snapshot script (guard G5).
// Allowlisted hosts only (redirects included), 20 s timeout, 3 retries with
// backoff on network errors and 5xx only, fixed User-Agent, no API keys.

export const USER_AGENT = 'MIZAN-snapshot/1.0 (Islamic AI Challenge entry)';
export const TIMEOUT_MS = 20_000;
export const RETRIES = 3;
const MAX_REDIRECTS = 5;

export class HttpError extends Error {}

export function isAllowedUrl(url) {
  let u;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase();
  return host === 'quranenc.com' || host === 'mp3quran.net' || host.endsWith('.mp3quran.net');
}

export function createHttp({
  fetchImpl = globalThis.fetch,
  timeoutMs = TIMEOUT_MS,
  retries = RETRIES,
  backoffMs = 1000,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
} = {}) {
  // One attempt: follows redirects by hand so no request ever leaves the allowlist.
  async function attempt(url, method, read) {
    const signal = AbortSignal.timeout(timeoutMs);
    let current = url;
    for (let hop = 0; ; hop++) {
      const res = await fetchImpl(current, {
        method,
        headers: { 'User-Agent': USER_AGENT, Accept: method === 'HEAD' ? '*/*' : 'application/json' },
        redirect: 'manual',
        signal,
      });
      const location = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && location) {
        if (hop >= MAX_REDIRECTS) throw new HttpError(`${method} ${url}: too many redirects`);
        const next = new URL(location, current).href;
        if (!isAllowedUrl(next)) throw new HttpError(`${method} ${url}: redirect to a host outside the allowlist (${next})`);
        await res.body?.cancel?.();
        current = next;
        continue;
      }
      if (res.status >= 500) return { retry: true, error: new HttpError(`${method} ${current} -> HTTP ${res.status}`) };
      if (!res.ok) throw new HttpError(`${method} ${current} -> HTTP ${res.status}`);
      return { value: await read(res, current) };
    }
  }

  async function request(url, method, read) {
    if (!isAllowedUrl(url)) throw new HttpError(`host not in allowlist: ${url}`);
    let lastError;
    for (let i = 0; i <= retries; i++) {
      if (i > 0) await sleep(backoffMs * 2 ** (i - 1));
      let out;
      try {
        out = await attempt(url, method, read);
      } catch (e) {
        if (e instanceof HttpError) throw e; // 4xx, bad redirect, bad JSON: not retried
        lastError = e; // network error or timeout: retried
        continue;
      }
      if (out.retry) { lastError = out.error; continue; }
      return out.value;
    }
    throw new HttpError(`${method} ${url} failed after ${retries + 1} attempts: ${lastError?.message ?? 'unknown error'}`);
  }

  return {
    getJson: (url) => request(url, 'GET', async (res, finalUrl) => {
      const text = await res.text();
      try { return JSON.parse(text); } catch { throw new HttpError(`GET ${finalUrl}: response is not JSON`); }
    }),
    head: (url) => request(url, 'HEAD', async (res, finalUrl) => ({
      status: res.status,
      contentType: res.headers.get('content-type') ?? '',
      finalUrl,
    })),
  };
}
