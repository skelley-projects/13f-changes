import { describe, it, expect, vi } from 'vitest';
import { lookupCusips, retryDelayMs } from '../scripts/openfigi';

describe('lookupCusips', () => {
  it('maps CUSIPs to tickers via OpenFIGI batch API', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([
      { data: [{ ticker: 'NVDA', name: 'NVIDIA CORP' }] },
      { data: [{ ticker: 'BE', name: 'BLOOM ENERGY CORP' }] },
      { warning: 'No identifier found' },
    ])));

    const result = await lookupCusips(['67066G104', '093712107', 'INVALID00'], { fetch: fetchMock });

    expect(result['67066G104']).toEqual({ ticker: 'NVDA', name: 'NVIDIA CORP' });
    expect(result['093712107']).toEqual({ ticker: 'BE', name: 'BLOOM ENERGY CORP' });
    expect(result['INVALID00']).toBeNull();
  });

  it('chunks requests when more than 10 CUSIPs are passed (batch=10 to fit OpenFIGI free tier)', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(
      Array.from({ length: 10 }, (_, i) => ({ data: [{ ticker: `T${i}`, name: 'X' }] }))
    )));
    const cusips = Array.from({ length: 25 }, (_, i) => String(i).padStart(9, '0'));
    await lookupCusips(cusips, { fetch: fetchMock, pacingMs: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('uses 100-CUSIP batches when an API key is supplied', async () => {
    const seenHeaders: Array<Record<string, string>> = [];
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      seenHeaders.push((init?.headers ?? {}) as Record<string, string>);
      return new Response(JSON.stringify(
        Array.from({ length: 100 }, (_, i) => ({ data: [{ ticker: `T${i}`, name: 'X' }] }))
      ));
    });
    const cusips = Array.from({ length: 250 }, (_, i) => String(i).padStart(9, '0'));
    await lookupCusips(cusips, { fetch: fetchMock, apiKey: 'k', pacingMs: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(seenHeaders[0]['X-OPENFIGI-APIKEY']).toBe('k');
  });

  it('retries a 429 instead of aborting the run', async () => {
    let calls = 0;
    const fetchMock = vi.fn(async () => {
      calls += 1;
      if (calls === 1) return new Response('rate limited', { status: 429 });
      return new Response(JSON.stringify([{ data: [{ ticker: 'NVDA', name: 'NVIDIA CORP' }] }]));
    });
    const result = await lookupCusips(['67066G104'], { fetch: fetchMock, pacingMs: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result['67066G104']).toEqual({ ticker: 'NVDA', name: 'NVIDIA CORP' });
  });

  it('gives up after the retry budget so a wedged limiter cannot hang the run', async () => {
    const fetchMock = vi.fn(async () => new Response('rate limited', { status: 429 }));
    await expect(
      lookupCusips(['67066G104'], { fetch: fetchMock, pacingMs: 0, maxRetries: 2 }),
    ).rejects.toThrow(/429 after 2 retries/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('retryDelayMs', () => {
  it('honours a numeric Retry-After in seconds', () => {
    expect(retryDelayMs('30', 0, 1000)).toBe(30_000);
  });

  it('falls back to exponential backoff when the header is absent', () => {
    expect(retryDelayMs(null, 0, 1000)).toBe(1000);
    expect(retryDelayMs(null, 3, 1000)).toBe(8000);
  });
});
