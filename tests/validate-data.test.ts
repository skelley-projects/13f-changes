import { describe, it, expect } from 'vitest';
import { validateAll, type DatasetForValidation } from '../scripts/validate-data';

function baseDataset(): DatasetForValidation {
  return {
    funds: [{
      slug: 'x', name: 'X', manager_name: 'X', cik: '0000000001',
      location: 'X', description: 'X', added: '2026-01-01', active: true,
    }],
    securities: {},
    pending: { pending: [] },
    perFund: {
      x: {
        quarters: { slug: 'x', quarters: [] },
        tags: { slug: 'x', taxonomy: [], assignments: {} },
        quarterFiles: {},
        diffFiles: {},
      },
    },
  };
}

function makePosition(overrides: Record<string, unknown> = {}) {
  return {
    cusip: 'AAAAAAAA1',
    name_of_issuer: 'TEST CO',
    title_of_class: 'COM',
    shares: 100,
    shares_type: 'SH' as const,
    value: 10_000,
    put_call: null,
    investment_discretion: 'SOLE',
    voting_sole: 100,
    voting_shared: 0,
    voting_none: 0,
    ...overrides,
  };
}

function makeFiling(period: string, period_ending: string, accession: string, positions: any[] = []) {
  return {
    slug: 'x',
    period,
    period_ending,
    filing_date: period_ending,
    accession,
    edgar_url: 'https://example.com',
    value_units: 'USD' as const,
    schema_version: 'X02' as const,
    total_value: positions.reduce((s, p) => s + p.value, 0),
    position_count: positions.length,
    positions,
  };
}

describe('validateAll', () => {
  it('passes on a minimal valid dataset', () => {
    const result = validateAll(baseDataset());
    expect(result.errors).toEqual([]);
  });

  it('reports a slug mismatch in quarters.json', () => {
    const dataset = baseDataset();
    dataset.perFund.x.quarters.slug = 'WRONG';
    expect(validateAll(dataset).errors[0]).toMatch(/slug mismatch/i);
  });

  it('rejects a CUSIP that is not 9 chars', () => {
    const dataset = baseDataset();
    dataset.securities = { 'TOOLONG12345': {
      cusip: 'TOOLONG12345', ticker: 'X', name: 'X', sector: 'Information Technology',
      industry: 'X', ticker_source: 'openfigi', sector_source: 'yahoo-finance',
      classified_at: '2026-01-01T00:00:00Z',
    }} as any;
    expect(validateAll(dataset).errors[0]).toMatch(/cusip/i);
  });

  it('rejects a non-canonical GICS sector', () => {
    const dataset = baseDataset();
    dataset.securities = { 'AAAAAAAA1': {
      cusip: 'AAAAAAAA1', ticker: 'X', name: 'X', sector: 'Exchange Traded Fund',
      industry: 'X', ticker_source: 'openfigi', sector_source: 'yahoo-finance',
      classified_at: '2026-01-01T00:00:00Z',
    }};
    const result = validateAll(dataset);
    expect(result.errors.some(e => /not one of the 11 canonical GICS/i.test(e))).toBe(true);
  });

  it('rejects quarters.json that is not sorted newest first', () => {
    const dataset = baseDataset();
    dataset.perFund.x.quarters.quarters = [
      {
        slug: 'x', period: '2025-Q3', period_ending: '2025-09-30',
        filing_date: '2025-11-14', accession: 'A1', edgar_url: '',
        value_units: 'USD', schema_version: 'X02',
        total_value: 0, position_count: 0,
        summary: '', fetched_at: '2026-01-01T00:00:00Z',
      },
      {
        slug: 'x', period: '2025-Q4', period_ending: '2025-12-31',
        filing_date: '2026-02-17', accession: 'A2', edgar_url: '',
        value_units: 'USD', schema_version: 'X02',
        total_value: 0, position_count: 0,
        summary: '', fetched_at: '2026-01-01T00:00:00Z',
      },
    ];
    const result = validateAll(dataset);
    expect(result.errors.some(e => /not sorted newest first/i.test(e))).toBe(true);
  });

  it('rejects an invalid quarter-end period_ending', () => {
    const dataset = baseDataset();
    dataset.perFund.x.quarters.quarters = [{
      slug: 'x', period: '2025-Q4', period_ending: '2025-12-30', // wrong: Dec is 31
      filing_date: '2026-02-17', accession: 'A1', edgar_url: '',
      value_units: 'USD', schema_version: 'X02',
      total_value: 0, position_count: 0,
      summary: '', fetched_at: '2026-01-01T00:00:00Z',
    }];
    const result = validateAll(dataset);
    expect(result.errors.some(e => /invalid quarter-end/i.test(e))).toBe(true);
  });

  it('rejects closed-position summary values that look like realized losses', () => {
    const dataset = baseDataset();
    dataset.perFund.x.quarters.quarters = [{
      slug: 'x', period: '2025-Q4', period_ending: '2025-12-31',
      filing_date: '2026-02-17', accession: 'A1', edgar_url: '',
      value_units: 'USD', schema_version: 'X02',
      total_value: 0, position_count: 0,
      summary: 'Closed NVIDIA (-$299M) and trimmed health care hard.',
      fetched_at: '2026-01-01T00:00:00Z',
    }];
    const result = validateAll(dataset);
    expect(result.errors.some(e => /realized losses/i.test(e))).toBe(true);
  });

  it('accepts closed-position summary values phrased as reported exposure', () => {
    const dataset = baseDataset();
    dataset.perFund.x.quarters.quarters = [{
      slug: 'x', period: '2025-Q4', period_ending: '2025-12-31',
      filing_date: '2026-02-17', accession: 'A1', edgar_url: '',
      value_units: 'USD', schema_version: 'X02',
      total_value: 0, position_count: 0,
      summary: 'Exited a prior NVIDIA stake worth $299M and reduced reported health-care exposure by $152M.',
      fetched_at: '2026-01-01T00:00:00Z',
    }];
    const result = validateAll(dataset);
    expect(result.errors.filter(e => /summary|realized losses/i.test(e))).toEqual([]);
  });

  it('warns on a very low reported per-share value', () => {
    const dataset = baseDataset();
    // 1,000,000 shares at $1 each = $1M total — but value field expressed as 50 → per-share $0.00005, way below 0.01 floor.
    const filing = makeFiling('2025-Q4', '2025-12-31', 'A1', [
      makePosition({ cusip: 'AAAAAAAA1', shares: 1_000_000, value: 50 }),
    ]);
    dataset.perFund.x.quarterFiles = { '2025-Q4': filing as any };
    dataset.perFund.x.quarters.quarters = [{
      slug: 'x', period: '2025-Q4', period_ending: '2025-12-31',
      filing_date: '2026-02-17', accession: 'A1', edgar_url: '',
      value_units: 'USD', schema_version: 'X02',
      total_value: 50, position_count: 1,
      summary: '', fetched_at: '2026-01-01T00:00:00Z',
    }];
    const result = validateAll(dataset);
    expect(result.errors.some(e => /implausible per-share price/i.test(e))).toBe(false);
    expect(result.warnings.some(e => /very low reported per-share value/i.test(e))).toBe(true);
  });

  it('rejects an implausibly high per-share price', () => {
    const dataset = baseDataset();
    const filing = makeFiling('2025-Q4', '2025-12-31', 'A1', [
      makePosition({ cusip: 'AAAAAAAA1', shares: 1, value: 20_000_000 }),
    ]);
    dataset.perFund.x.quarterFiles = { '2025-Q4': filing as any };
    dataset.perFund.x.quarters.quarters = [{
      slug: 'x', period: '2025-Q4', period_ending: '2025-12-31',
      filing_date: '2026-02-17', accession: 'A1', edgar_url: '',
      value_units: 'USD', schema_version: 'X02',
      total_value: 20_000_000, position_count: 1,
      summary: '', fetched_at: '2026-01-01T00:00:00Z',
    }];
    const result = validateAll(dataset);
    expect(result.errors.some(e => /implausible per-share price/i.test(e))).toBe(true);
  });

  it('rejects a filing whose accession does not match quarters.json', () => {
    const dataset = baseDataset();
    const filing = makeFiling('2025-Q4', '2025-12-31', 'WRONG_ACCESSION', [
      makePosition({ cusip: 'AAAAAAAA1', shares: 100, value: 10_000 }),
    ]);
    dataset.perFund.x.quarterFiles = { '2025-Q4': filing as any };
    dataset.perFund.x.quarters.quarters = [{
      slug: 'x', period: '2025-Q4', period_ending: '2025-12-31',
      filing_date: '2026-02-17', accession: 'A1', edgar_url: '',
      value_units: 'USD', schema_version: 'X02',
      total_value: 10_000, position_count: 1,
      summary: '', fetched_at: '2026-01-01T00:00:00Z',
    }];
    const result = validateAll(dataset);
    expect(result.errors.some(e => /does not match quarters\.json entry/i.test(e))).toBe(true);
  });

  it('accepts a tag with a valid parent', () => {
    const dataset = baseDataset();
    dataset.perFund.x.tags.taxonomy = [
      { id: 'broad', label: 'Broad', description: '' },
      { id: 'narrow', label: 'Narrow', description: '', parent: 'broad' },
    ];
    const result = validateAll(dataset);
    expect(result.errors.filter(e => /tags\.json/.test(e))).toEqual([]);
  });

  it('rejects a tag whose parent does not exist in taxonomy', () => {
    const dataset = baseDataset();
    dataset.perFund.x.tags.taxonomy = [
      { id: 'orphan', label: 'Orphan', description: '', parent: 'missing' },
    ];
    const result = validateAll(dataset);
    expect(result.errors.some(e => /does not exist in taxonomy/i.test(e))).toBe(true);
  });

  it('rejects a tag whose parent is itself', () => {
    const dataset = baseDataset();
    dataset.perFund.x.tags.taxonomy = [
      { id: 'self', label: 'Self', description: '', parent: 'self' },
    ];
    const result = validateAll(dataset);
    expect(result.errors.some(e => /cannot be its own parent/i.test(e))).toBe(true);
  });

  it('rejects a tag whose parent itself has a parent (no grandchildren)', () => {
    const dataset = baseDataset();
    dataset.perFund.x.tags.taxonomy = [
      { id: 'a', label: 'A', description: '' },
      { id: 'b', label: 'B', description: '', parent: 'a' },
      { id: 'c', label: 'C', description: '', parent: 'b' }, // grandchild — invalid
    ];
    const result = validateAll(dataset);
    expect(result.errors.some(e => /must be a top-level tag/i.test(e))).toBe(true);
  });

  it('rejects a diff that references a non-existent prior_period file', () => {
    const dataset = baseDataset();
    const filing = makeFiling('2025-Q4', '2025-12-31', 'A1', [
      makePosition({ cusip: 'AAAAAAAA1', shares: 100, value: 10_000 }),
    ]);
    dataset.perFund.x.quarterFiles = { '2025-Q4': filing as any };
    dataset.perFund.x.quarters.quarters = [{
      slug: 'x', period: '2025-Q4', period_ending: '2025-12-31',
      filing_date: '2026-02-17', accession: 'A1', edgar_url: '',
      value_units: 'USD', schema_version: 'X02',
      total_value: 10_000, position_count: 1,
      summary: '', fetched_at: '2026-01-01T00:00:00Z',
    }];
    dataset.perFund.x.diffFiles = {
      '2025-Q4': {
        slug: 'x',
        current_period: '2025-Q4',
        prior_period: '2025-Q3',
        totals: { current_value: 10_000, prior_value: 0, net_flow: 10_000 },
        movements: { new: [], closed: [], increased: [], decreased: [], activity: [], unchanged_count: 0, unchanged_value: 0 },
        sector_breakdown: { current: [], prior: [], deltas: [] },
        theme_breakdown: null,
      } as any,
    };
    const result = validateAll(dataset);
    expect(result.errors.some(e => /prior_period.*has no matching/i.test(e))).toBe(true);
  });
});
