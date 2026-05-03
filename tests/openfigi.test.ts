import { describe, it, expect, vi } from 'vitest';
import { lookupCusips } from '../scripts/openfigi';

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

  it('chunks requests when more than 25 CUSIPs are passed', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(
      Array.from({ length: 25 }, (_, i) => ({ data: [{ ticker: `T${i}`, name: 'X' }] }))
    )));
    const cusips = Array.from({ length: 30 }, (_, i) => String(i).padStart(9, '0'));
    await lookupCusips(cusips, { fetch: fetchMock });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
