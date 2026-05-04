import { describe, expect, it } from 'vitest';
import {
  estimateLatestGain,
  estimateLatestGainForRows,
  estimateUnderlyingMove,
  impliedPositionPrice,
  priceRangeFor,
  priceUnsupportedLabel,
  weightedImpliedPositionPrice,
} from '../src/lib/implied-price';
import type { MovementRow, PriceSnapshotFile } from '../scripts/types';

function row(overrides: Partial<MovementRow> = {}): MovementRow {
  return {
    cusip: 'X',
    ticker: 'XYZ',
    name: 'XYZ Corp',
    title_of_class: 'COM',
    shares_type: 'SH',
    put_call: null,
    sector: 'Information Technology',
    industry: 'Software',
    tags: [],
    current_value: 1_000,
    prior_value: 800,
    current_shares: 100,
    prior_shares: 80,
    delta_value: 200,
    delta_shares: 20,
    delta_pct: 25,
    current_pct_of_portfolio: 1,
    ...overrides,
  };
}

describe('implied 13F price helpers', () => {
  it('derives current and prior value-per-share prices', () => {
    expect(impliedPositionPrice(row(), 'current')).toBe(10);
    expect(impliedPositionPrice(row(), 'prior')).toBe(10);
  });

  it('does not price options or PRN rows', () => {
    expect(impliedPositionPrice(row({ put_call: 'Put' }), 'current')).toBeNull();
    expect(impliedPositionPrice(row({ shares_type: 'PRN' }), 'prior')).toBeNull();
    expect(impliedPositionPrice(row({ name: 'XYZ Corp - Conv Notes' }), 'current')).toBeNull();
    expect(priceUnsupportedLabel(row({ put_call: 'Call' }))).toBe('Call option');
    expect(priceUnsupportedLabel(row({ name: 'XYZ Corp - Conv Notes' }))).toBe('conv. note');
  });

  it('computes weighted side prices across eligible rows only', () => {
    const rows = [
      row({ current_value: 1_000, current_shares: 100 }),
      row({ current_value: 3_000, current_shares: 100 }),
      row({ current_value: 500, current_shares: 50, put_call: 'Call' }),
    ];
    expect(weightedImpliedPositionPrice(rows, 'current')).toBe(20);
  });

  it('estimates latest gain from current quarter-end price', () => {
    const prices: PriceSnapshotFile = {
      fetched_at: '2026-05-04T22:00:00.000Z',
      source: 'yahoo-finance',
      records: {
        XYZ: {
          ticker: 'XYZ',
          price: 12,
          currency: 'USD',
          as_of: '2026-05-04T22:00:00.000Z',
          market_state: 'POST',
          quote_source: 'Test',
          source: 'yahoo-finance',
        },
      },
      failures: {},
    };
    expect(estimateLatestGain(row(), prices)).toMatchObject({ value: 200, pct: 20 });
    expect(estimateLatestGainForRows([row(), row({ current_value: 2_000, current_shares: 100 })], prices))
      .toMatchObject({ value: -600, pct: -20 });
  });

  it('estimates underlying stock move for option rows without implying option P/L', () => {
    const prices: PriceSnapshotFile = {
      fetched_at: '2026-05-04T22:00:00.000Z',
      source: 'yahoo-finance',
      records: {
        XYZ: {
          ticker: 'XYZ',
          price: 15,
          currency: 'USD',
          as_of: '2026-05-04T22:00:00.000Z',
          market_state: 'POST',
          quote_source: 'Test',
          source: 'yahoo-finance',
        },
      },
      failures: {},
    };
    expect(estimateUnderlyingMove(row({ put_call: 'Call' }), prices)).toMatchObject({ pct: 50 });
    expect(estimateUnderlyingMove(row(), prices)).toBeNull();
  });

  it('looks up period price ranges by ticker and period', () => {
    const prices: PriceSnapshotFile = {
      fetched_at: '2026-05-04T22:00:00.000Z',
      source: 'yahoo-finance',
      records: {},
      ranges: {
        'XYZ:2025-Q4': {
          ticker: 'XYZ',
          period: '2025-Q4',
          start: '2025-10-01',
          end: '2025-12-31',
          low: 7,
          high: 13,
          currency: 'USD',
          source: 'yahoo-finance',
        },
      },
      failures: {},
    };
    expect(priceRangeFor(row(), '2025-Q4', prices)).toMatchObject({ low: 7, high: 13 });
  });
});
