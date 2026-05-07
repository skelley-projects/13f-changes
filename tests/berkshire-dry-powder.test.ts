import { describe, expect, it } from 'vitest';
import {
  buildBerkshireDryPowderFile,
  buildFilingUrls,
  extractBerkshireDryPowderRows,
  findLatestBerkshirePeriodicFiling,
  type SecSubmissions,
} from '../scripts/berkshire-dry-powder';

const submissions: SecSubmissions = {
  filings: {
    recent: {
      form: ['4', '10-Q', '10-K'],
      filingDate: ['2026-05-06', '2026-05-04', '2026-02-28'],
      reportDate: ['2026-05-06', '2026-03-31', '2025-12-31'],
      accessionNumber: ['0000000000-26-000001', '0001193125-26-202243', '0001193125-26-100000'],
      primaryDocument: ['ownership.xml', 'brka-20260331.htm', 'brka-20251231.htm'],
    },
  },
};

const xbrl = `
<xbrl>
  <context id="current">
    <entity>
      <segment>
        <xbrldi:explicitMember dimension="srt:ProductOrServiceAxis">brka:InsuranceAndOtherMember</xbrldi:explicitMember>
      </segment>
    </entity>
    <period><instant>2026-03-31</instant></period>
  </context>
  <context id="prior">
    <entity>
      <segment>
        <xbrldi:explicitMember dimension="srt:ProductOrServiceAxis">brka:InsuranceAndOtherMember</xbrldi:explicitMember>
      </segment>
    </entity>
    <period><instant>2025-12-31</instant></period>
  </context>
  <context id="railroad">
    <entity>
      <segment>
        <xbrldi:explicitMember dimension="srt:ProductOrServiceAxis">brka:RailroadUtilitiesAndEnergyMember</xbrldi:explicitMember>
      </segment>
    </entity>
    <period><instant>2026-03-31</instant></period>
  </context>
  <us-gaap:CashAndCashEquivalentsAtCarryingValue contextRef="current" unitRef="U_USD">51478000000</us-gaap:CashAndCashEquivalentsAtCarryingValue>
  <brka:USTreasuryBills contextRef="current" unitRef="U_USD">339261000000</brka:USTreasuryBills>
  <us-gaap:CashAndCashEquivalentsAtCarryingValue contextRef="prior" unitRef="U_USD">47719000000</us-gaap:CashAndCashEquivalentsAtCarryingValue>
  <brka:USTreasuryBills contextRef="prior" unitRef="U_USD">321434000000</brka:USTreasuryBills>
  <us-gaap:CashAndCashEquivalentsAtCarryingValue contextRef="railroad" unitRef="U_USD">6644000000</us-gaap:CashAndCashEquivalentsAtCarryingValue>
  <brka:USTreasuryBills contextRef="railroad" unitRef="U_USD">1000000000</brka:USTreasuryBills>
  <context id="currentConsolidated"><entity></entity><period><instant>2026-03-31</instant></period></context>
  <context id="priorConsolidated"><entity></entity><period><instant>2025-12-31</instant></period></context>
  <us-gaap:EquitySecuritiesFvNi contextRef="currentConsolidated" unitRef="U_USD">288034000000</us-gaap:EquitySecuritiesFvNi>
  <us-gaap:EquitySecuritiesFvNi contextRef="priorConsolidated" unitRef="U_USD">297778000000</us-gaap:EquitySecuritiesFvNi>
  <us-gaap:EquitySecuritiesFvNi contextRef="railroad" unitRef="U_USD">123</us-gaap:EquitySecuritiesFvNi>
</xbrl>
`;

describe('berkshire dry powder extraction', () => {
  it('finds the latest periodic Berkshire filing from SEC submissions', () => {
    const filing = findLatestBerkshirePeriodicFiling(submissions);
    expect(filing).toMatchObject({
      form: '10-Q',
      accession: '0001193125-26-202243',
      periodEnding: '2026-03-31',
      primaryDocument: 'brka-20260331.htm',
    });
  });

  it('builds SEC archive URLs for the HTML filing and inline XBRL instance', () => {
    expect(buildFilingUrls('0001067983', '0001193125-26-202243', 'brka-20260331.htm')).toEqual({
      htmlUrl: 'https://www.sec.gov/Archives/edgar/data/1067983/000119312526202243/brka-20260331.htm',
      xbrlUrl: 'https://www.sec.gov/Archives/edgar/data/1067983/000119312526202243/brka-20260331_htm.xml',
    });
  });

  it('extracts current and prior Insurance and Other cash plus T-bills', () => {
    const [current, prior] = extractBerkshireDryPowderRows(xbrl);
    expect(current).toEqual({
      period_ending: '2026-03-31',
      cash_and_equivalents: 51478000000,
      short_term_treasury_bills: 339261000000,
      total_dry_powder: 390739000000,
      equity_securities: 288034000000,
      dry_powder_to_equities: 390739000000 / 288034000000,
    });
    expect(prior.total_dry_powder).toBe(369153000000);
    expect(prior.equity_securities).toBe(297778000000);
  });

  it('builds the dry-powder data file with source and update policy metadata', () => {
    const file = buildBerkshireDryPowderFile({
      submissions,
      xbrl,
      now: new Date('2026-05-07T12:00:00.000Z'),
    });
    expect(file.source).toBe('SEC Form 10-Q');
    expect(file.source_filing.url).toContain('brka-20260331.htm');
    expect(file.update_policy.automation).toMatch(/30 minutes/);
    expect(file.fetched_at).toBe('2026-05-07T12:00:00.000Z');
  });
});
