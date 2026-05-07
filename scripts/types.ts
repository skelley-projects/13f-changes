export type Slug = string;
export type CUSIP = string;       // 9 alphanumeric chars
export type CIK = string;         // 10-digit, leading zeros
export type Period = string;      // e.g. "2025-Q4"
export type SectorName = string;  // canonical GICS top-level
export type IndustryName = string;
export type TagId = string;

export type SchemaVersion = 'X01' | 'X02';
export type ValueUnits = 'USD' | 'USD_THOUSANDS';

export interface Position {
  cusip: CUSIP;
  name_of_issuer: string;
  title_of_class: string;
  shares: number;
  shares_type: 'SH' | 'PRN';
  /** Always in USD dollars after parsing — the parser normalizes. */
  value: number;
  put_call: 'Put' | 'Call' | null;
  investment_discretion: string;
  voting_sole: number;
  voting_shared: number;
  voting_none: number;
}

export interface FilingMeta {
  slug: Slug;
  period: Period;
  period_ending: string;        // YYYY-MM-DD
  filing_date: string;          // YYYY-MM-DD
  accession: string;
  edgar_url: string;
  /** Source filing's units, for traceability. Stored values are always USD. */
  value_units: ValueUnits;
  schema_version: SchemaVersion;
  total_value: number;          // USD
  position_count: number;
}

export interface FilingFile extends FilingMeta {
  positions: Position[];
}

export interface QuarterEntry extends FilingMeta {
  /**
   * Editorial summary, written during /update-quarter.
   * Closed/sold/reduced dollar figures are 13F reported value/exposure changes,
   * not realized P/L. Avoid negative dollar parentheticals such as
   * "closed XYZ (-$100M)"; validation rejects that phrasing.
   */
  summary: string;
  fetched_at: string;           // ISO timestamp
}

export interface QuartersFile {
  slug: Slug;
  quarters: QuarterEntry[];     // sorted newest first
}

export interface SecurityRecord {
  cusip: CUSIP;
  ticker: string | null;
  name: string;
  sector: SectorName;
  industry: IndustryName;
  ticker_source: 'openfigi' | 'edgar-tickers' | 'manual-override';
  sector_source: 'yahoo-finance' | 'finnhub' | 'manual-override';
  manual_override_reason?: string;
  classified_at: string;
}

export type SecuritiesFile = Record<CUSIP, SecurityRecord>;

export interface TaxonomyEntry {
  id: TagId;
  label: string;
  description: string;
  /** Points to another tag's id in the same fund's taxonomy. Absent = top-level tag. */
  parent?: TagId;
}

export interface TagsFile {
  slug: Slug;
  taxonomy: TaxonomyEntry[];
  assignments: Record<CUSIP, TagId[]>;
}

export interface FundsFile {
  slug: Slug;
  name: string;
  manager_name: string;
  /** Optional path under public/, e.g. "/managers/leopold-aschenbrenner.jpg". Renders an avatar when present. */
  manager_photo?: string;
  cik: CIK;
  location: string;
  description: string;
  added: string;
  active: boolean;
}

export interface PendingEntry {
  slug: Slug;
  cik: CIK;
  accession: string;
  period_ending: string;
  filing_date: string;
  edgar_url: string;
  discovered_at: string;
}

export interface PendingFile {
  pending: PendingEntry[];
}

export interface PriceRecord {
  ticker: string;
  price: number;
  currency: string | null;
  as_of: string;
  market_state: string | null;
  quote_source: string | null;
  source: 'yahoo-finance';
}

export interface PriceRangeRecord {
  ticker: string;
  period: Period;
  start: string;
  end: string;
  low: number;
  high: number;
  currency: string | null;
  source: 'yahoo-finance';
}

export interface PriceSnapshotFile {
  fetched_at: string;
  source: 'yahoo-finance';
  records: Record<string, PriceRecord>;
  ranges?: Record<string, PriceRangeRecord>;
  failures: Record<string, string>;
}

export interface SegmentMetricRecord {
  ticker: string;
  price: number;
  market_cap: number | null;
  currency: string | null;
  as_of: string;
  market_state: string | null;
  quote_source: string | null;
  performance: {
    one_week: number | null;
    one_month: number | null;
    one_year: number | null;
    five_year: number | null;
  };
  source: 'yahoo-finance';
}

export interface SegmentMetricsFile {
  fetched_at: string;
  source: 'yahoo-finance';
  records: Record<string, SegmentMetricRecord>;
  failures: Record<string, string>;
}

export interface DryPowderHistoryEntry {
  period_ending: string;
  filing_date: string;
  accession: string;
  form: '10-Q' | '10-K';
  url: string;
  cash_and_equivalents: number;
  short_term_treasury_bills: number;
  total_dry_powder: number;
}

export interface DryPowderFile {
  slug: Slug;
  source: string;
  source_filing: {
    form: '10-Q' | '10-K';
    period_ending: string;
    filing_date: string;
    accession: string;
    url: string;
  };
  context: string;
  currency: 'USD';
  values: {
    current: {
      period_ending: string;
      cash_and_equivalents: number;
      short_term_treasury_bills: number;
      total_dry_powder: number;
    };
    prior: {
      period_ending: string;
      cash_and_equivalents: number;
      short_term_treasury_bills: number;
      total_dry_powder: number;
    };
  };
  update_policy: {
    disclosure_frequency: string;
    automation: string;
    granularity: string;
  };
  history: DryPowderHistoryEntry[];
  notes: string[];
  fetched_at: string;
}

/* Diff-related types live below */

export type MovementStatus = 'NEW' | 'INCREASED' | 'DECREASED' | 'CLOSED' | 'UNCHANGED';

export interface MovementRow {
  cusip: CUSIP;
  ticker: string | null;
  name: string;
  title_of_class: string;
  shares_type: Position['shares_type'];
  put_call: Position['put_call'];
  sector: SectorName;
  industry: IndustryName;
  tags: TagId[];
  /** Differs by status — see compute-diff.ts. */
  current_value: number | null;
  prior_value: number | null;
  current_shares: number | null;
  prior_shares: number | null;
  delta_value: number;
  delta_shares: number;
  delta_pct: number | null;     // null for NEW/CLOSED
  current_pct_of_portfolio: number | null;
}

export interface MovementActivity {
  key: string;
  ticker: string | null;
  name: string;
  sector: SectorName;
  industry: IndustryName;
  tags: TagId[];
  bought: MovementRow[];
  sold: MovementRow[];
  current_value: number;
  prior_value: number;
  net_delta_value: number;
}

export interface BreakdownEntry {
  label: string;
  value: number;
  pct: number;
}

export interface BreakdownDelta {
  label: string;
  delta_pct_pts: number;
}

export interface Breakdown {
  current: BreakdownEntry[];
  prior: BreakdownEntry[];
  deltas: BreakdownDelta[];     // sorted by absolute delta desc
}

export interface ActivityBreakdownEntry {
  label: string;
  bought: number;
  sold: number;
  net: number;
}

export interface ActivityBreakdown {
  entries: ActivityBreakdownEntry[];   // sorted by total activity desc
  total_bought: number;
  total_sold: number;
  net: number;
}

export interface DiffFile {
  slug: Slug;
  current_period: Period;
  prior_period: Period | null;  // null for first-filing edge case
  totals: {
    current_value: number;
    prior_value: number;
    net_flow: number;
  };
  movements: {
    new: MovementRow[];
    closed: MovementRow[];
    increased: MovementRow[];
    decreased: MovementRow[];
    activity: MovementActivity[];
    unchanged_count: number;
    unchanged_value: number;
  };
  sector_breakdown: Breakdown;
  theme_breakdown: Breakdown | null;  // null when fund has no tags
  granular_breakdown: Breakdown | null;     // null when fund has zero sub-tags or zero granularly-tagged positions
  granular_coverage_pct: number | null;     // 0-100, null when granular_breakdown is null
  theme_activity_breakdown: ActivityBreakdown | null;     // active buy/sell/reallocation estimate, excluding unchanged positions
  granular_activity_breakdown: ActivityBreakdown | null;  // same activity estimate, grouped by sub-tags only
}
