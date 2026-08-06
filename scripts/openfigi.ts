export interface OpenFigiResult {
  ticker: string;
  name: string;
}

export interface LookupOptions {
  fetch?: typeof fetch;
  apiKey?: string;
  /** Override inter-request pacing. Tests pass 0 to run instantly. */
  pacingMs?: number;
  maxRetries?: number;
}

// OpenFIGI's published limits: 25 requests/minute and 10 jobs/request without
// an API key, 25 requests/6 seconds and 100 jobs/request with one. A large
// multi-strategy filer carries thousands of distinct CUSIPs, so exceeding
// these is the normal case, not the edge case — pace requests and back off on
// 429 rather than aborting the whole classification run.
const UNAUTH_BATCH = 10;
const AUTH_BATCH = 100;
const UNAUTH_PACING_MS = 2_500;
const AUTH_PACING_MS = 250;
const MAX_RETRIES = 5;
const ENDPOINT = 'https://api.openfigi.com/v3/mapping';

const sleep = (ms: number) => new Promise(done => setTimeout(done, ms));

/** Retry-After is seconds or an HTTP date; fall back to exponential backoff. */
export function retryDelayMs(retryAfter: string | null, attempt: number, base: number): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
    const at = Date.parse(retryAfter);
    if (!Number.isNaN(at)) return Math.max(0, at - Date.now());
  }
  return base * 2 ** attempt;
}

export async function lookupCusips(
  cusips: string[],
  opts: LookupOptions = {},
): Promise<Record<string, OpenFigiResult | null>> {
  const f = opts.fetch ?? globalThis.fetch;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.apiKey) headers['X-OPENFIGI-APIKEY'] = opts.apiKey;

  const out: Record<string, OpenFigiResult | null> = {};
  const batchSize = opts.apiKey ? AUTH_BATCH : UNAUTH_BATCH;
  const pacingMs = opts.pacingMs ?? (opts.apiKey ? AUTH_PACING_MS : UNAUTH_PACING_MS);
  const maxRetries = opts.maxRetries ?? MAX_RETRIES;

  for (let i = 0; i < cusips.length; i += batchSize) {
    const chunk = cusips.slice(i, i + batchSize);
    const body = chunk.map((c) => ({ idType: 'ID_CUSIP', idValue: c, exchCode: 'US' }));

    let res: Response | undefined;
    for (let attempt = 0; ; attempt += 1) {
      res = await f(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(body) });
      if (res.status !== 429) break;
      if (attempt >= maxRetries) {
        throw new Error(`OpenFIGI HTTP 429 after ${maxRetries} retries`);
      }
      await sleep(retryDelayMs(res.headers?.get?.('Retry-After') ?? null, attempt, pacingMs || 1000));
    }
    if (!res.ok) throw new Error(`OpenFIGI HTTP ${res.status}`);
    const json = (await res.json()) as Array<
      { data?: Array<{ ticker: string; name: string }> } | { warning?: string }
    >;
    chunk.forEach((cusip, idx) => {
      const entry = json[idx];
      if ('data' in entry && entry.data && entry.data.length > 0) {
        out[cusip] = { ticker: entry.data[0].ticker, name: entry.data[0].name };
      } else {
        out[cusip] = null;
      }
    });

    if (pacingMs > 0 && i + batchSize < cusips.length) await sleep(pacingMs);
  }

  return out;
}
