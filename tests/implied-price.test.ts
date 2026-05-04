import { describe, expect, it } from 'vitest';
import { impliedPositionPrice, weightedImpliedPositionPrice } from '../src/lib/implied-price';
import type { MovementRow } from '../scripts/types';

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
  });

  it('computes weighted side prices across eligible rows only', () => {
    const rows = [
      row({ current_value: 1_000, current_shares: 100 }),
      row({ current_value: 3_000, current_shares: 100 }),
      row({ current_value: 500, current_shares: 50, put_call: 'Call' }),
    ];
    expect(weightedImpliedPositionPrice(rows, 'current')).toBe(20);
  });
});
