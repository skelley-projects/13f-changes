import { describe, it, expect } from 'vitest';
import { computeDiff } from '../scripts/compute-diff';
import type { FilingFile, SecuritiesFile, TagsFile } from '../scripts/types';

function pos(p: Partial<any>): any {
  return {
    cusip: 'X', name_of_issuer: 'X', title_of_class: 'COM',
    shares: 100, shares_type: 'SH', value: 1000, put_call: null,
    investment_discretion: 'SOLE', voting_sole: 0, voting_shared: 0, voting_none: 0,
    ...p,
  };
}
function filing(period: string, positions: any[], total?: number): FilingFile {
  return {
    slug: 'test', period, period_ending: '2025-12-31', filing_date: '2026-02-11',
    accession: '', edgar_url: '', value_units: 'USD', schema_version: 'X02',
    total_value: total ?? positions.reduce((s, p) => s + p.value, 0),
    position_count: positions.length, positions,
  };
}
const NO_SECURITIES: SecuritiesFile = {};
const NO_TAGS: TagsFile = { slug: 'test', taxonomy: [], assignments: {} };

describe('computeDiff — movement categorization', () => {
  it('categorizes NEW, CLOSED, INCREASED, DECREASED, UNCHANGED correctly', () => {
    const prior = filing('2025-Q3', [
      pos({ cusip: 'A', shares: 100, value: 1000 }),  // increased
      pos({ cusip: 'B', shares: 200, value: 2000 }),  // closed
      pos({ cusip: 'C', shares: 300, value: 3000 }),  // unchanged
      pos({ cusip: 'D', shares: 400, value: 4000 }),  // decreased
    ]);
    const current = filing('2025-Q4', [
      pos({ cusip: 'A', shares: 150, value: 1500 }),  // increased (+50%)
      pos({ cusip: 'C', shares: 300, value: 3300 }),  // unchanged shares (value drift OK)
      pos({ cusip: 'D', shares: 200, value: 2000 }),  // decreased (-50%)
      pos({ cusip: 'E', shares: 500, value: 5000 }),  // new
    ]);

    const diff = computeDiff({ current, prior, securities: NO_SECURITIES, tags: NO_TAGS });

    expect(diff.movements.new.map(r => r.cusip)).toEqual(['E']);
    expect(diff.movements.closed.map(r => r.cusip)).toEqual(['B']);
    expect(diff.movements.increased.map(r => r.cusip)).toEqual(['A']);
    expect(diff.movements.decreased.map(r => r.cusip)).toEqual(['D']);
    expect(diff.movements.unchanged_count).toBe(1);
  });

  it('treats different put_call as different positions', () => {
    const prior = filing('Q3', [pos({ cusip: 'X', put_call: null, shares: 100 })]);
    const current = filing('Q4', [
      pos({ cusip: 'X', put_call: null, shares: 100 }),       // unchanged
      pos({ cusip: 'X', put_call: 'Call', shares: 50 }),       // new
    ]);
    const diff = computeDiff({ current, prior, securities: NO_SECURITIES, tags: NO_TAGS });
    expect(diff.movements.new).toHaveLength(1);
    expect(diff.movements.new[0].cusip).toBe('X');
  });

  it('totals are computed correctly', () => {
    const prior = filing('Q3', [pos({ cusip: 'A', value: 1000 })], 1000);
    const current = filing('Q4', [pos({ cusip: 'A', value: 1500 })], 1500);
    const diff = computeDiff({ current, prior, securities: NO_SECURITIES, tags: NO_TAGS });
    expect(diff.totals).toEqual({ current_value: 1500, prior_value: 1000, net_flow: 500 });
  });
});
