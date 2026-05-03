import { describe, it, expect } from 'vitest';
import { validateAll, type DatasetForValidation } from '../scripts/validate-data';

describe('validateAll', () => {
  it('passes on a minimal valid dataset', () => {
    const dataset = {
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
    const result = validateAll(dataset);
    expect(result.errors).toEqual([]);
  });

  it('reports a slug mismatch in quarters.json', () => {
    const dataset = {
      funds: [{ slug: 'x', name: 'X', manager_name: 'X', cik: '0000000001',
                location: 'X', description: 'X', added: '2026-01-01', active: true }],
      securities: {},
      pending: { pending: [] },
      perFund: {
        x: {
          quarters: { slug: 'WRONG', quarters: [] },
          tags: { slug: 'x', taxonomy: [], assignments: {} },
          quarterFiles: {},
          diffFiles: {},
        },
      },
    };
    expect(validateAll(dataset).errors[0]).toMatch(/slug mismatch/i);
  });

  it('rejects a CUSIP that is not 9 chars', () => {
    const dataset = {
      funds: [{ slug: 'x', name: 'X', manager_name: 'X', cik: '0000000001',
                location: 'X', description: 'X', added: '2026-01-01', active: true }],
      securities: { 'TOOLONG12345': {
        cusip: 'TOOLONG12345', ticker: 'X', name: 'X', sector: 'Information Technology',
        industry: 'X', ticker_source: 'openfigi', sector_source: 'yahoo-finance',
        classified_at: '2026-01-01T00:00:00Z',
      }},
      pending: { pending: [] },
      perFund: {
        x: { quarters: { slug: 'x', quarters: [] }, tags: { slug: 'x', taxonomy: [], assignments: {} },
             quarterFiles: {}, diffFiles: {} },
      },
    } as DatasetForValidation;
    expect(validateAll(dataset).errors[0]).toMatch(/cusip/i);
  });
});
