import { describe, it, expect, vi } from 'vitest';
import { lookupTickerPriceRanges, lookupTickerPrices, lookupTickerSector, priceRangeKey } from '../scripts/yahoo';

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
