import { describe, it, expect, vi } from 'vitest';
import { lookupTickerPrices, lookupTickerSector } from '../scripts/yahoo';

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
