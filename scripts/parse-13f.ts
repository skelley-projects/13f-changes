import { XMLParser } from 'fast-xml-parser';
import type {
  FilingFile, Position, SchemaVersion, ValueUnits,
} from './types.js';

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
  parseTagValue: false,   // keep strings, we cast ourselves
  isArray: (name) => name === 'infoTable',
});

export interface ParseInput {
  primaryDocXml: string;
  holdingsXml: string;
  /** Caller passes these — they're not in the XML files themselves. */
  meta?: Partial<Pick<FilingFile, 'slug' | 'accession' | 'edgar_url' | 'filing_date'>>;
}

export function parseFiling(input: ParseInput): FilingFile {
  const primary = xml.parse(input.primaryDocXml);
  const holdings = xml.parse(input.holdingsXml);

  const submission = primary.edgarSubmission;
  // Schema version is documentary only — it does NOT reliably indicate units.
  const schemaVersionStr: string | undefined =
    submission.schemaVersion
    ?? submission.headerData?.filerInfo?.schemaVersion;
  const schemaVersion: SchemaVersion =
    schemaVersionStr?.startsWith('X02') ? 'X02' : 'X01';

  // periodOfReport like "12-31-2025" → 2025-12-31
  const reportRaw: string = submission.headerData.filerInfo.periodOfReport;
  const period_ending = normalizeMmDdYyyy(reportRaw);
  const period = toPeriodCode(period_ending);

  const tableEntries = (holdings.informationTable?.infoTable ?? []) as any[];
  if (tableEntries.length === 0) {
    throw new Error('Filing contains no positions (informationTable.infoTable is empty or missing)');
  }

  // Heuristic unit detection: median per-share price across the filing.
  // If median < $1, raw values are in thousands; multiply by 1000 to normalize.
  const perSharePrices = tableEntries
    .map((row) => {
      if (row.shrsOrPrnAmt.sshPrnamtType !== 'SH') return 0;
      const shares = parseInt(row.shrsOrPrnAmt.sshPrnamt, 10);
      const value = parseInt(row.value, 10);
      return shares > 0 ? value / shares : 0;
    })
    .filter((p) => p > 0)
    .sort((a, b) => a - b);
  const median = perSharePrices.length > 0
    ? perSharePrices[Math.floor(perSharePrices.length / 2)]
    : 0;
  const valueUnits: ValueUnits = median < 1 ? 'USD_THOUSANDS' : 'USD';
  const scale = valueUnits === 'USD_THOUSANDS' ? 1000 : 1;

  // Sanity warning for ambiguous medians (between $0.50 and $2.00 raw)
  if (median >= 0.5 && median <= 2.0) {
    console.warn(
      `parse-13f: ambiguous unit detection — median per-share price is $${median.toFixed(3)} ` +
      `(raw). Picked ${valueUnits}; manual review suggested.`
    );
  }

  const positions: Position[] = tableEntries.map((row) => {
    const sharesType = row.shrsOrPrnAmt.sshPrnamtType;
    if (sharesType !== 'SH' && sharesType !== 'PRN') {
      throw new Error(
        `Unsupported sshPrnamtType "${sharesType}" for ${row.nameOfIssuer} (${row.cusip}). ` +
        `Expected SH (shares) or PRN (principal amount).`
      );
    }
    const value = parseInt(row.value, 10) * scale;

    return {
      cusip: row.cusip,
      name_of_issuer: row.nameOfIssuer,
      title_of_class: row.titleOfClass,
      shares: parseInt(row.shrsOrPrnAmt.sshPrnamt, 10),
      shares_type: row.shrsOrPrnAmt.sshPrnamtType,
      value,
      put_call: row.putCall ?? null,
      investment_discretion: row.investmentDiscretion ?? 'SOLE',
      voting_sole: parseInt(row.votingAuthority?.Sole ?? '0', 10),
      voting_shared: parseInt(row.votingAuthority?.Shared ?? '0', 10),
      voting_none: parseInt(row.votingAuthority?.None ?? '0', 10),
    };
  });

  const total_value = positions.reduce((s, p) => s + p.value, 0);

  return {
    slug: input.meta?.slug ?? '',
    period,
    period_ending,
    filing_date: input.meta?.filing_date ?? '',
    accession: input.meta?.accession ?? '',
    edgar_url: input.meta?.edgar_url ?? '',
    value_units: valueUnits,
    schema_version: schemaVersion,
    total_value,
    position_count: positions.length,
    positions,
  };
}

function normalizeMmDdYyyy(s: string): string {
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) return `${m[3]}-${m[1]}-${m[2]}`;
  // already YYYY-MM-DD?
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  throw new Error(`Unrecognized date format: ${s}`);
}

function toPeriodCode(periodEnding: string): string {
  const [y, m] = periodEnding.split('-');
  const q = ({ '03': 'Q1', '06': 'Q2', '09': 'Q3', '12': 'Q4' } as const)[m];
  if (!q) throw new Error(`Period ending ${periodEnding} is not a quarter end`);
  return `${y}-${q}`;
}
