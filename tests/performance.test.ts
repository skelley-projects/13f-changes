import { describe, expect, it } from 'vitest';
import { buildPositionPerformance } from '../src/lib/performance';
import type { FilingFile, PriceSnapshotFile, SecuritiesFile } from '../scripts/types';

function filing(): FilingFile {
  return {
    slug: 'test',
    period: '2025-Q4',
    period_ending: '2025-12-31',
    filing_date: '2026-02-14',
    accession: '',
    edgar_url: '',
    value_units: 'USD',
    schema_version: 'X02',
    total_value: 3000,
    position_count: 3,
    positions: [
      {
        cusip: 'EQUITY001', name_of_issuer: 'Equity Co', title_of_class: 'COM',
        shares: 100, shares_type: 'SH', value: 1000, put_call: null,
        investment_discretion: 'SOLE', voting_sole: 100, voting_shared: 0, voting_none: 0,
      },
      {
        cusip: 'OPTION001', name_of_issuer: 'Option Co', title_of_class: 'COM',
        shares: 10, shares_type: 'SH', value: 500, put_call: 'Call',
        investment_discretion: 'SOLE', voting_sole: 0, voting_shared: 0, voting_none: 0,
      },
      {
        cusip: 'NOTE00001', name_of_issuer: 'Note Co', title_of_class: 'NOTE',
        shares: 10, shares_type: 'SH', value: 1500, put_call: null,
        investment_discretion: 'SOLE', voting_sole: 10, voting_shared: 0, voting_none: 0,
      },
    ],
  };
}

const securities: SecuritiesFile = {
  EQUITY001: { cusip: 'EQUITY001', ticker: 'EQTY', name: 'Equity Co',
    sector: 'Information Technology', industry: 'Software',
    ticker_source: 'manual-override', sector_source: 'manual-override', classified_at: '' },
  OPTION001: { cusip: 'OPTION001', ticker: 'OPTN', name: 'Option Co',
    sector: 'Information Technology', industry: 'Software',
    ticker_source: 'manual-override', sector_source: 'manual-override', classified_at: '' },
  NOTE00001: { cusip: 'NOTE00001', ticker: 'NOTE', name: 'Note Co - Conv Notes',
    sector: 'Information Technology', industry: 'Software',
    ticker_source: 'manual-override', sector_source: 'manual-override', classified_at: '' },
};

const prices: PriceSnapshotFile = {
  fetched_at: '2026-05-04T14:00:00.000Z',
  source: 'yahoo-finance',
  records: {
    EQTY: {
      ticker: 'EQTY',
      price: 12,
      currency: 'USD',
      as_of: '2026-05-04T14:00:00.000Z',
      market_state: 'REGULAR',
      quote_source: 'Test',
      source: 'yahoo-finance',
    },
    OPTN: {
      ticker: 'OPTN',
      price: 50,
      currency: 'USD',
      as_of: '2026-05-04T14:00:00.000Z',
      market_state: 'REGULAR',
      quote_source: 'Test',
      source: 'yahoo-finance',
    },
    NOTE: {
      ticker: 'NOTE',
      price: 100,
      currency: 'USD',
      as_of: '2026-05-04T14:00:00.000Z',
      market_state: 'REGULAR',
      quote_source: 'Test',
      source: 'yahoo-finance',
    },
  },
  failures: {},
};

describe('buildPositionPerformance', () => {
  it('estimates mark-to-market return for ordinary equity rows only', () => {
    const rows = buildPositionPerformance(filing(), securities, prices);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      ticker: 'EQTY',
      reported_price: 10,
      latest_price: 12,
      latest_value: 1200,
      delta_value: 200,
      delta_pct: 20,
    });
  });
});
