import { describe, it, expect, vi } from 'vitest';
import { lookupTickerSector } from '../scripts/yahoo';

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
