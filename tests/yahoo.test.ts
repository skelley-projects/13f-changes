import { describe, it, expect, vi } from 'vitest';
import { isRateLimit, lookupSegmentMetrics, lookupTickerPriceRanges, lookupTickerPrices, lookupTickerSector, priceRangeKey, YahooRateLimitError } from '../scripts/yahoo';

describe('lookupTickerSector', () => {
  it('returns Yahoo sector mapped to GICS, plus industry', async () => {
    const yahoo = { quoteSummary: vi.fn(async () => ({
      assetProfile: { sector: 'Technology', industry: 'Semiconductors' },
    })) } as any;

    const result = await lookupTickerSector('NVDA', { yahoo });
    expect(result).toEqual({ sector: 'Information Technology', industry: 'Semiconductors' });
  });

  it('returns null when Yahoo has no asset profile', async () => {
    const yahoo = { quoteSummary: vi.fn(async () => ({ assetProfile: null })) } as any;
    const result = await lookupTickerSector('XXXX', { yahoo });
    expect(result).toBeNull();
  });

  it('passes through unmapped sectors with a warning', async () => {
    const yahoo = { quoteSummary: vi.fn(async () => ({
      assetProfile: { sector: 'WeirdSector', industry: 'Stuff' },
    })) } as any;
    const result = await lookupTickerSector('XYZ', { yahoo });
    expect(result).toEqual({ sector: 'WeirdSector', industry: 'Stuff' });
  });
});

describe('lookupTickerPrices', () => {
  it('returns normalized latest price records and failures', async () => {
    const yahoo = { quote: vi.fn(async () => ({
      NVDA: {
        symbol: 'NVDA',
        regularMarketPrice: 200,
        regularMarketTime: new Date('2026-05-04T14:00:00.000Z'),
        currency: 'USD',
        marketState: 'REGULAR',
        quoteSourceName: 'Nasdaq Real Time Price',
      },
      MISS: { symbol: 'MISS' },
    })) } as any;

    const result = await lookupTickerPrices(['nvda', 'NVDA', 'MISS'], {
      yahoo,
      now: new Date('2026-05-04T15:00:00.000Z'),
    });

    expect(Object.keys(result.records)).toEqual(['NVDA']);
    expect(result.records.NVDA).toMatchObject({
      ticker: 'NVDA',
      price: 200,
      currency: 'USD',
      as_of: '2026-05-04T14:00:00.000Z',
      source: 'yahoo-finance',
    });
    expect(result.failures.MISS).toMatch(/regularMarketPrice/);
    expect(yahoo.quote).toHaveBeenCalledWith(['NVDA', 'MISS'], expect.objectContaining({ return: 'object' }));
  });
});

describe('lookupTickerPriceRanges', () => {
  it('returns quarter low/high ranges from historical prices', async () => {
    const yahoo = {
      historical: vi.fn(async () => [
        { date: new Date('2025-10-01'), low: 10, high: 12 },
        { date: new Date('2025-10-02'), low: 8, high: 15 },
      ]),
    } as any;

    const result = await lookupTickerPriceRanges([
      { ticker: 'lite', period: '2025-Q4', start: '2025-10-01', end: '2025-12-31' },
    ], { yahoo });

    expect(result.ranges[priceRangeKey('LITE', '2025-Q4')]).toMatchObject({
      ticker: 'LITE',
      period: '2025-Q4',
      low: 8,
      high: 15,
    });
    expect(yahoo.historical).toHaveBeenCalledWith('LITE', expect.objectContaining({
      period1: '2025-10-01',
      period2: '2026-01-01',
    }));
  });
});

describe('lookupSegmentMetrics', () => {
  it('returns market cap and trailing performance aligned to the latest quote date', async () => {
    const yahoo = {
      quote: vi.fn(async () => ({
        TEST: {
          symbol: 'TEST',
          regularMarketPrice: 120,
          regularMarketTime: new Date('2026-05-04T20:00:00.000Z'),
          marketCap: 12_000_000_000,
          currency: 'USD',
          marketState: 'POST',
          quoteSourceName: 'Delayed Quote',
        },
      })),
      historical: vi.fn(async () => [
        { date: new Date('2021-05-04T00:00:00.000Z'), close: 40 },
        { date: new Date('2025-05-02T00:00:00.000Z'), close: 80 },
        { date: new Date('2026-04-03T00:00:00.000Z'), close: 100 },
        { date: new Date('2026-04-26T00:00:00.000Z'), close: 110 },
      ]),
    } as any;

    const result = await lookupSegmentMetrics(['test'], {
      yahoo,
      now: new Date('2026-05-04T21:00:00.000Z'),
    });

    expect(result.records.TEST).toMatchObject({
      ticker: 'TEST',
      price: 120,
      market_cap: 12_000_000_000,
      as_of: '2026-05-04T20:00:00.000Z',
      performance: {
        one_week: expect.closeTo(9.09, 2),
        one_month: 20,
        one_year: 50,
        five_year: 200,
      },
    });
    expect(yahoo.historical).toHaveBeenCalledWith('TEST', expect.objectContaining({
      period1: '2021-04-24',
      period2: '2026-05-05',
    }));
  });
});

describe('isRateLimit', () => {
  it('recognises Yahoo throttling, which arrives as a message not a status', () => {
    expect(isRateLimit(new Error('Edge: Too Many Requests'))).toBe(true);
    expect(isRateLimit(new Error('HTTP 429'))).toBe(true);
  });

  it('does not mistake a genuine data gap for throttling', () => {
    expect(isRateLimit(new Error('No fundamentals data found for symbol: XFCOX'))).toBe(false);
    expect(isRateLimit(new Error('Quote not found for symbol: GLDD'))).toBe(false);
  });
});

describe('lookupTickerSector throttling', () => {
  it('retries a throttled ticker and succeeds', async () => {
    let calls = 0;
    const yahoo = {
      quoteSummary: vi.fn(async () => {
        calls += 1;
        if (calls === 1) throw new Error('Edge: Too Many Requests');
        return { assetProfile: { sector: 'Technology', industry: 'Semiconductors' } };
      }),
    };
    const result = await lookupTickerSector('NVDA', { yahoo: yahoo as never, baseDelayMs: 0 });
    expect(calls).toBe(2);
    expect(result?.industry).toBe('Semiconductors');
  });

  it('throws rather than reporting a throttled ticker as unclassifiable', async () => {
    const yahoo = {
      quoteSummary: vi.fn(async () => { throw new Error('Edge: Too Many Requests'); }),
    };
    await expect(
      lookupTickerSector('ZBH', { yahoo: yahoo as never, baseDelayMs: 0, maxRetries: 2 }),
    ).rejects.toBeInstanceOf(YahooRateLimitError);
  });

  it('passes a real data gap straight through without retrying', async () => {
    const yahoo = {
      quoteSummary: vi.fn(async () => { throw new Error('No fundamentals data found for symbol: XFCOX'); }),
    };
    await expect(
      lookupTickerSector('XFCOX', { yahoo: yahoo as never, baseDelayMs: 0 }),
    ).rejects.toThrow(/No fundamentals/);
    expect(yahoo.quoteSummary).toHaveBeenCalledTimes(1);
  });
});
