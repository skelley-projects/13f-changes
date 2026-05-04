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

describe('computeDiff — sector breakdown', () => {
  it('produces current/prior sector mixes and pp deltas', () => {
    const securities: SecuritiesFile = {
      A: { cusip: 'A', ticker: 'A', name: 'A', sector: 'Information Technology',
           industry: '', ticker_source: 'openfigi', sector_source: 'yahoo-finance',
           classified_at: '' },
      B: { cusip: 'B', ticker: 'B', name: 'B', sector: 'Utilities',
           industry: '', ticker_source: 'openfigi', sector_source: 'yahoo-finance',
           classified_at: '' },
    };
    const prior = filing('Q3', [
      pos({ cusip: 'A', shares: 100, value: 800 }),
      pos({ cusip: 'B', shares: 100, value: 200 }),
    ]);
    const current = filing('Q4', [
      pos({ cusip: 'A', shares: 100, value: 600 }),
      pos({ cusip: 'B', shares: 100, value: 400 }),
    ]);
    const diff = computeDiff({ current, prior, securities, tags: NO_TAGS });

    const utilitiesNow = diff.sector_breakdown.current.find(s => s.label === 'Utilities')!;
    expect(utilitiesNow.pct).toBeCloseTo(40);
    const utilitiesDelta = diff.sector_breakdown.deltas.find(d => d.label === 'Utilities')!;
    expect(utilitiesDelta.delta_pct_pts).toBeCloseTo(20);   // 40 − 20
  });
});

describe('computeDiff — theme breakdown', () => {
  it('aggregates by tag IDs and replicates values across multi-tag positions', () => {
    const securities: SecuritiesFile = { /* not relevant for grouping */
      A: { cusip: 'A', ticker: 'A', name: 'A', sector: 'X', industry: '',
           ticker_source: 'openfigi', sector_source: 'yahoo-finance', classified_at: '' },
      B: { cusip: 'B', ticker: 'B', name: 'B', sector: 'Y', industry: '',
           ticker_source: 'openfigi', sector_source: 'yahoo-finance', classified_at: '' },
    };
    const tags: TagsFile = {
      slug: 'test',
      taxonomy: [
        { id: 'ai-compute', label: 'AI compute', description: '' },
        { id: 'ai-power', label: 'AI power', description: '' },
      ],
      assignments: { A: ['ai-compute', 'ai-power'], B: ['ai-power'] },
    };
    const current = filing('Q4', [
      pos({ cusip: 'A', value: 600 }), pos({ cusip: 'B', value: 400 }),
    ]);
    const prior = filing('Q3', [
      pos({ cusip: 'A', value: 200 }), pos({ cusip: 'B', value: 800 }),
    ]);
    const diff = computeDiff({ current, prior, securities, tags });
    expect(diff.theme_breakdown).not.toBeNull();
    const aiPower = diff.theme_breakdown!.current.find(e => e.label === 'AI power')!;
    expect(aiPower.value).toBe(1000); // both A and B count
  });

  it('returns null theme_breakdown when fund has no tags', () => {
    const current = filing('Q4', [pos({ cusip: 'A', value: 100 })]);
    const prior = filing('Q3', [pos({ cusip: 'A', value: 100 })]);
    const diff = computeDiff({ current, prior, securities: NO_SECURITIES, tags: NO_TAGS });
    expect(diff.theme_breakdown).toBeNull();
  });
});

describe('computeDiff — first filing', () => {
  it('treats every position as NEW and produces no prior breakdowns', () => {
    const current = filing('Q4', [pos({ cusip: 'A', value: 100 })]);
    const diff = computeDiff({ current, prior: null, securities: NO_SECURITIES, tags: NO_TAGS });
    expect(diff.prior_period).toBeNull();
    expect(diff.movements.new).toHaveLength(1);
    expect(diff.movements.closed).toHaveLength(0);
    expect(diff.movements.increased).toHaveLength(0);
    expect(diff.movements.decreased).toHaveLength(0);
    expect(diff.sector_breakdown.prior).toEqual([]);
    expect(diff.totals.prior_value).toBe(0);
  });
});

import type { Position } from '../scripts/types.js';

function mkPos(cusip: string, value: number, shares = 100): Position {
  return {
    cusip,
    name_of_issuer: cusip,
    title_of_class: 'COM',
    shares,
    shares_type: 'SH',
    value,
    put_call: null,
    investment_discretion: 'SOLE',
    voting_sole: shares,
    voting_shared: 0,
    voting_none: 0,
  };
}

function mkFiling(period: string, positions: Position[]): FilingFile {
  return {
    slug: 'test',
    period,
    period_ending: '2025-12-31',
    filing_date: '2026-02-15',
    accession: '0000000000-00-000000',
    edgar_url: 'https://example.com',
    value_units: 'USD',
    schema_version: 'X02',
    total_value: positions.reduce((s, p) => s + p.value, 0),
    position_count: positions.length,
    positions,
  };
}

const emptySecurities: SecuritiesFile = {};

describe('computeDiff: granular theme breakdown', () => {
  const tags: TagsFile = {
    slug: 'test',
    taxonomy: [
      { id: 'ai-compute', label: 'AI compute', description: '' },
      { id: 'photonics', label: 'Photonics', description: '', parent: 'ai-compute' },
      { id: 'ai-applications', label: 'AI applications', description: '' },
    ],
    assignments: {
      'A111': ['photonics'],          // sub-tag only — rolls up to ai-compute
      'B222': ['ai-compute'],         // top-level only — appears in broad, not granular
      'C333': ['ai-compute', 'photonics'], // both — counts once in broad (de-duped)
      'D444': ['ai-applications'],    // top-level only, different theme
      'E555': [],                     // untagged — appears in neither
    },
  };

  it('rolls sub-tags up to parents in theme_breakdown without double-counting', () => {
    const current = mkFiling('2025-Q4', [
      mkPos('A111', 100),
      mkPos('B222', 200),
      mkPos('C333', 400),
      mkPos('D444', 50),
    ]);
    const diff = computeDiff({ current, prior: null, securities: emptySecurities, tags });
    const aiCompute = diff.theme_breakdown!.current.find(e => e.label === 'AI compute');
    const aiApps = diff.theme_breakdown!.current.find(e => e.label === 'AI applications');
    // A (photonics → ai-compute) + B (ai-compute) + C (both → ai-compute once) = 700
    expect(aiCompute?.value).toBe(700);
    expect(aiApps?.value).toBe(50);
    // Photonics SHOULD NOT appear in theme_breakdown — it's a sub-tag, rolled up only
    const photonics = diff.theme_breakdown!.current.find(e => e.label === 'Photonics');
    expect(photonics).toBeUndefined();
  });

  it('aggregates only sub-tagged positions into granular_breakdown', () => {
    const current = mkFiling('2025-Q4', [
      mkPos('A111', 100),  // photonics
      mkPos('B222', 200),  // ai-compute (top-level only — excluded)
      mkPos('C333', 400),  // photonics (also top-level)
      mkPos('D444', 50),   // ai-applications (top-level only — excluded)
    ]);
    const diff = computeDiff({ current, prior: null, securities: emptySecurities, tags });
    expect(diff.granular_breakdown).not.toBeNull();
    const photonics = diff.granular_breakdown!.current.find(e => e.label === 'Photonics');
    expect(photonics?.value).toBe(500);  // A + C
    // No top-level tags in granular_breakdown
    const aiCompute = diff.granular_breakdown!.current.find(e => e.label === 'AI compute');
    expect(aiCompute).toBeUndefined();
  });

  it('computes granular_coverage_pct as the share of AUM with at least one sub-tag', () => {
    const current = mkFiling('2025-Q4', [
      mkPos('A111', 100),  // photonics — counts
      mkPos('B222', 200),  // top-level only — does not count
      mkPos('C333', 400),  // photonics — counts
      mkPos('D444', 50),   // top-level only — does not count
    ]);
    const diff = computeDiff({ current, prior: null, securities: emptySecurities, tags });
    // (100 + 400) / 750 = 0.6667
    expect(diff.granular_coverage_pct).toBeCloseTo(66.67, 1);
  });

  it('returns null granular_breakdown when no sub-tags are defined', () => {
    const flatTags: TagsFile = {
      slug: 'test',
      taxonomy: [
        { id: 'ai-compute', label: 'AI compute', description: '' },
      ],
      assignments: { 'A111': ['ai-compute'] },
    };
    const current = mkFiling('2025-Q4', [mkPos('A111', 100)]);
    const diff = computeDiff({ current, prior: null, securities: emptySecurities, tags: flatTags });
    expect(diff.granular_breakdown).toBeNull();
    expect(diff.granular_coverage_pct).toBeNull();
  });
});
