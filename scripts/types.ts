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
  /** Editorial summary, written during /update-quarter. */
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

/* Diff-related types live below */

export type MovementStatus = 'NEW' | 'INCREASED' | 'DECREASED' | 'CLOSED' | 'UNCHANGED';

export interface MovementRow {
  cusip: CUSIP;
  ticker: string | null;
  name: string;
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
    unchanged_count: number;
    unchanged_value: number;
  };
  sector_breakdown: Breakdown;
  theme_breakdown: Breakdown | null;  // null when fund has no tags
}
