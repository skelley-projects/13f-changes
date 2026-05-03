import { describe, it, expect, vi } from 'vitest';
import { classifyNewCusips } from '../scripts/classify-securities';

describe('classifyNewCusips', () => {
  it('returns cache hits unchanged and only resolves new CUSIPs', async () => {
    const cache = {
      '67066G104': {
        cusip: '67066G104', ticker: 'NVDA', name: 'NVIDIA',
        sector: 'Information Technology', industry: 'Semiconductors',
        ticker_source: 'openfigi' as const, sector_source: 'yahoo-finance' as const,
        classified_at: '2026-01-01T00:00:00Z',
      },
    };
    const lookupCusips = vi.fn();   // should not be called
    const lookupTicker = vi.fn();
    const result = await classifyNewCusips(['67066G104'], cache, {
      lookupCusips, lookupTickerSector: lookupTicker,
    });
    expect(lookupCusips).not.toHaveBeenCalled();
    expect(result.classified['67066G104']).toEqual(cache['67066G104']);
    expect(result.needsManual).toEqual([]);
  });

  it('resolves a new CUSIP via OpenFIGI + Yahoo and writes to cache', async () => {
    const cache = {};
    const lookupCusips = vi.fn(async () => ({
      '093712107': { ticker: 'BE', name: 'Bloom Energy Corp' },
    }));
    const lookupTickerSector = vi.fn(async () => ({
      sector: 'Industrials', industry: 'Electrical Equipment',
    }));

    const result = await classifyNewCusips(['093712107'], cache, {
      lookupCusips, lookupTickerSector,
    });

    expect(result.classified['093712107'].ticker).toBe('BE');
    expect(result.classified['093712107'].sector).toBe('Industrials');
    expect(result.classified['093712107'].industry).toBe('Electrical Equipment');
    expect(result.needsManual).toEqual([]);
  });

  it('flags CUSIPs that OpenFIGI cannot resolve as needsManual', async () => {
    const cache = {};
    const lookupCusips = vi.fn(async () => ({ 'BAD000000': null }));
    const lookupTickerSector = vi.fn();
    const result = await classifyNewCusips(['BAD000000'], cache, {
      lookupCusips, lookupTickerSector,
      issuerNames: { 'BAD000000': 'Mystery Corp' },
    });
    expect(result.needsManual).toEqual([{ cusip: 'BAD000000', issuer: 'Mystery Corp', reason: 'no-ticker' }]);
    expect(result.classified['BAD000000']).toBeUndefined();
  });

  it('flags CUSIPs where Yahoo returns no sector as needsManual', async () => {
    const cache = {};
    const lookupCusips = vi.fn(async () => ({ '093712107': { ticker: 'BE', name: 'Bloom' } }));
    const lookupTickerSector = vi.fn(async () => null);
    const result = await classifyNewCusips(['093712107'], cache, {
      lookupCusips, lookupTickerSector,
      issuerNames: { '093712107': 'BLOOM ENERGY CORP' },
    });
    expect(result.needsManual[0]).toMatchObject({ cusip: '093712107', reason: 'no-sector' });
    expect(result.classified['093712107']).toBeUndefined();
  });
});
