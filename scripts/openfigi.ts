export interface OpenFigiResult {
  ticker: string;
  name: string;
}

export interface LookupOptions {
  fetch?: typeof fetch;
  apiKey?: string;
}

const BATCH_SIZE = 10;
const ENDPOINT = 'https://api.openfigi.com/v3/mapping';

export async function lookupCusips(
  cusips: string[],
  opts: LookupOptions = {},
): Promise<Record<string, OpenFigiResult | null>> {
  const f = opts.fetch ?? globalThis.fetch;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.apiKey) headers['X-OPENFIGI-APIKEY'] = opts.apiKey;

  const out: Record<string, OpenFigiResult | null> = {};

  for (let i = 0; i < cusips.length; i += BATCH_SIZE) {
    const chunk = cusips.slice(i, i + BATCH_SIZE);
    const body = chunk.map((c) => ({ idType: 'ID_CUSIP', idValue: c, exchCode: 'US' }));
    const res = await f(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(body) });
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
  }

  return out;
}
