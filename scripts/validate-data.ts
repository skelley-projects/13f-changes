import { z } from 'zod';
import type { FundsFile, SecuritiesFile, PendingFile, QuartersFile, TagsFile, FilingFile, DiffFile, DryPowderFile } from './types.js';

const fundSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  manager_name: z.string(),
  manager_photo: z.string().regex(/^\/managers\/[^/]+\.(jpg|jpeg|png|webp)$/).optional(),
  cik: z.string().regex(/^\d{10}$/),
  location: z.string(),
  description: z.string(),
  added: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  active: z.boolean(),
});

const cusipRegex = /^[A-Z0-9]{9}$/;

/** Canonical GICS top-level sectors (the 11 standard buckets). */
export const CANONICAL_SECTORS = new Set([
  'Information Technology',
  'Communication Services',
  'Consumer Discretionary',
  'Consumer Staples',
  'Energy',
  'Financials',
  'Health Care',
  'Industrials',
  'Materials',
  'Real Estate',
  'Utilities',
]);

const securityRecordSchema = z.object({
  cusip: z.string().regex(cusipRegex),
  ticker: z.string().nullable(),
  name: z.string(),
  sector: z.string(),
  industry: z.string(),
  ticker_source: z.enum(['openfigi', 'edgar-tickers', 'manual-override']),
  sector_source: z.enum(['yahoo-finance', 'finnhub', 'manual-override']),
  manual_override_reason: z.string().optional(),
  classified_at: z.string(),
});

const positionSchema = z.object({
  cusip: z.string().regex(cusipRegex),
  name_of_issuer: z.string().min(1),
  title_of_class: z.string(),
  shares: z.number().min(0),
  shares_type: z.enum(['SH', 'PRN']),
  value: z.number().min(0),
  put_call: z.union([z.literal('Put'), z.literal('Call'), z.null()]),
  investment_discretion: z.string(),
  voting_sole: z.number(),
  voting_shared: z.number(),
  voting_none: z.number(),
});

const taxonomyEntrySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string(),
  parent: z.string().optional(),
});

const tagsFileSchema = z.object({
  slug: z.string().min(1),
  taxonomy: z.array(taxonomyEntrySchema),
  assignments: z.record(z.string(), z.array(z.string())),
}).superRefine((data, ctx) => {
  const ids = new Set(data.taxonomy.map(t => t.id));
  const parentMap = new Map(data.taxonomy.map(t => [t.id, t.parent]));
  for (const tag of data.taxonomy) {
    if (tag.parent === undefined) continue;
    if (tag.parent === tag.id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['taxonomy'],
        message: `tag "${tag.id}" cannot be its own parent`,
      });
      continue;
    }
    if (!ids.has(tag.parent)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['taxonomy'],
        message: `tag "${tag.id}" parent "${tag.parent}" does not exist in taxonomy`,
      });
      continue;
    }
    if (parentMap.get(tag.parent) !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['taxonomy'],
        message: `tag "${tag.id}" parent "${tag.parent}" must be a top-level tag (no grandchildren)`,
      });
    }
  }
});

const dryPowderSchema = z.object({
  slug: z.string().min(1),
  source: z.string().min(1),
  source_filing: z.object({
    form: z.enum(['10-Q', '10-K']),
    period_ending: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    filing_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    accession: z.string().regex(/^\d{10}-\d{2}-\d{6}$/),
    url: z.string().url(),
  }),
  context: z.string().min(1),
  currency: z.literal('USD'),
  values: z.object({
    current: z.object({
      period_ending: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      cash_and_equivalents: z.number().min(0),
      short_term_treasury_bills: z.number().min(0),
      total_dry_powder: z.number().min(0),
    }),
    prior: z.object({
      period_ending: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      cash_and_equivalents: z.number().min(0),
      short_term_treasury_bills: z.number().min(0),
      total_dry_powder: z.number().min(0),
    }),
  }),
  notes: z.array(z.string().min(1)),
  fetched_at: z.string().min(1),
}).superRefine((data, ctx) => {
  for (const side of ['current', 'prior'] as const) {
    const value = data.values[side];
    const expected = value.cash_and_equivalents + value.short_term_treasury_bills;
    if (value.total_dry_powder !== expected) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['values', side, 'total_dry_powder'],
        message: `total_dry_powder must equal cash_and_equivalents + short_term_treasury_bills (${expected})`,
      });
    }
  }
});

/** Verify an MM-DD pair represents a valid quarter end. */
function isValidQuarterEnding(periodEnding: string): boolean {
  // YYYY-MM-DD; MM in {03,06,09,12}; for Mar/Dec → 31, for Jun/Sep → 30
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(periodEnding);
  if (!m) return false;
  const month = m[2];
  const day = m[3];
  if (month === '03' || month === '12') return day === '31';
  if (month === '06' || month === '09') return day === '30';
  return false;
}

const ambiguousClosedValuePattern = /\b(?:closed|exited|sold|trimmed|reduced|cut)\b[^.?!;]*\(\s*[-−]\$/i;

function validateSummaryLanguage(summary: string): string | null {
  if (!ambiguousClosedValuePattern.test(summary)) return null;
  return 'closed/sold/reduced values must not be written as negative dollar parentheticals; use "prior-quarter stake worth $X exited" or "reduced reported exposure by $X" so readers do not mistake 13F value changes for realized losses';
}

export interface DatasetForValidation {
  funds: FundsFile[];
  securities: SecuritiesFile;
  pending: PendingFile;
  perFund: Record<string, {
    quarters: QuartersFile;
    tags: TagsFile;
    quarterFiles: Record<string, FilingFile>;
    diffFiles: Record<string, DiffFile>;
    dryPowder?: DryPowderFile;
  }>;
}

export function validateAll(d: DatasetForValidation): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // funds.json
  const slugs = new Set<string>();
  const ciks = new Set<string>();
  for (const f of d.funds) {
    const r = fundSchema.safeParse(f);
    if (!r.success) errors.push(`funds.json: ${r.error.message}`);
    if (slugs.has(f.slug)) errors.push(`funds.json: duplicate slug ${f.slug}`);
    if (ciks.has(f.cik)) errors.push(`funds.json: duplicate cik ${f.cik}`);
    slugs.add(f.slug); ciks.add(f.cik);
  }

  // securities.json
  for (const [k, v] of Object.entries(d.securities)) {
    if (!cusipRegex.test(k)) errors.push(`securities.json: bad CUSIP key ${k}`);
    const r = securityRecordSchema.safeParse(v);
    if (!r.success) {
      errors.push(`securities.json[${k}]: ${r.error.message}`);
      continue;
    }
    // Sector must be one of the 11 canonical GICS top-level labels.
    if (!CANONICAL_SECTORS.has(v.sector)) {
      errors.push(`securities.json[${k}]: sector "${v.sector}" is not one of the 11 canonical GICS top-level labels`);
    }
  }

  // per-fund
  for (const [slug, pf] of Object.entries(d.perFund)) {
    if (pf.quarters.slug !== slug) errors.push(`${slug}/quarters.json: slug mismatch`);
    if (pf.tags.slug !== slug) errors.push(`${slug}/tags.json: slug mismatch`);
    if (pf.dryPowder) {
      if (pf.dryPowder.slug !== slug) errors.push(`${slug}/dry-powder.json: slug mismatch`);
      const dryResult = dryPowderSchema.safeParse(pf.dryPowder);
      if (!dryResult.success) {
        for (const issue of dryResult.error.issues) {
          errors.push(`${slug}/dry-powder.json: ${issue.message}`);
        }
      }
    }

    // tags.json shape + parent-depth validation
    const tagsResult = tagsFileSchema.safeParse(pf.tags);
    if (!tagsResult.success) {
      for (const issue of tagsResult.error.issues) {
        errors.push(`${slug}/tags.json: ${issue.message}`);
      }
    } else {
      // taxonomy ID coverage (only when the tags shape itself is valid)
      const taxonomyIds = new Set(pf.tags.taxonomy.map(t => t.id));
      for (const [cusip, ids] of Object.entries(pf.tags.assignments)) {
        for (const id of ids) {
          if (!taxonomyIds.has(id)) errors.push(`${slug}/tags.json: assignment ${cusip} references unknown tag ${id}`);
        }
      }
    }

    // orphan tag assignments — every tagged CUSIP should appear in at least one quarter
    const allCusips = new Set<string>();
    for (const file of Object.values(pf.quarterFiles)) {
      for (const p of file.positions) allCusips.add(p.cusip);
    }
    for (const cusip of Object.keys(pf.tags.assignments)) {
      if (!allCusips.has(cusip)) {
        warnings.push(`${slug}/tags.json: ${cusip} has tags but no holdings`);
      }
    }

    // quarters.json: array sorted newest first (lexical compare on period_ending).
    const qs = pf.quarters.quarters;
    for (let i = 0; i < qs.length - 1; i++) {
      if (qs[i].period_ending < qs[i + 1].period_ending) {
        errors.push(`${slug}/quarters.json: quarters not sorted newest first at index ${i} (${qs[i].period_ending} < ${qs[i + 1].period_ending})`);
      }
    }

    // Each period_ending in quarters.json must be a valid quarter end (MM-31 / MM-30 by month).
    for (const q of qs) {
      if (!isValidQuarterEnding(q.period_ending)) {
        errors.push(`${slug}/quarters.json: invalid quarter-end period_ending "${q.period_ending}" for period ${q.period}`);
      }
      const summaryError = validateSummaryLanguage(q.summary ?? '');
      if (summaryError) {
        errors.push(`${slug}/quarters.json ${q.period}: ${summaryError}`);
      }
    }

    // Per-filing internal consistency: slug, period, accession.
    const accessionByPeriod = new Map<string, string>();
    for (const q of qs) accessionByPeriod.set(q.period, q.accession);

    for (const [period, file] of Object.entries(pf.quarterFiles)) {
      if (file.slug !== slug) {
        errors.push(`${slug}/${period}.json: slug field "${file.slug}" does not match directory ${slug}`);
      }
      if (file.period !== period) {
        errors.push(`${slug}/${period}.json: period field "${file.period}" does not match filename ${period}`);
      }
      const expectedAccession = accessionByPeriod.get(period);
      if (expectedAccession && file.accession !== expectedAccession) {
        errors.push(`${slug}/${period}.json: accession "${file.accession}" does not match quarters.json entry "${expectedAccession}"`);
      }
      if (!isValidQuarterEnding(file.period_ending)) {
        errors.push(`${slug}/${period}.json: invalid quarter-end period_ending "${file.period_ending}"`);
      }
      if (file.value_units !== 'USD' && file.value_units !== 'USD_THOUSANDS') {
        errors.push(`${slug}/${period}.json: bad value_units "${file.value_units}"`);
      }

      // Per-position checks: shape, share/value sanity, per-share price plausibility.
      for (let i = 0; i < file.positions.length; i++) {
        const p = file.positions[i];
        const r = positionSchema.safeParse(p);
        if (!r.success) {
          errors.push(`${slug}/${period}.json position[${i}] (${p?.cusip ?? '?'}): ${r.error.message}`);
          continue;
        }
        if (p.shares_type === 'SH' && p.shares > 0 && p.value > 0) {
          const perShare = p.value / p.shares;
          if (perShare <= 0.01) {
            warnings.push(`${slug}/${period}.json position[${i}] (${p.cusip} ${p.name_of_issuer}): very low reported per-share value ${perShare.toFixed(4)} (value=${p.value}, shares=${p.shares})`);
          }
          if (perShare >= 10_000_000) {
            errors.push(`${slug}/${period}.json position[${i}] (${p.cusip} ${p.name_of_issuer}): implausible per-share price ${perShare.toFixed(4)} (value=${p.value}, shares=${p.shares})`);
          }
        }
      }
    }

    // Diff files reference real periods.
    for (const [diffPeriod, diff] of Object.entries(pf.diffFiles)) {
      if (diff.current_period !== diffPeriod) {
        errors.push(`${slug}/diff/${diffPeriod}.json: current_period "${diff.current_period}" does not match filename`);
      }
      if (!pf.quarterFiles[diff.current_period]) {
        errors.push(`${slug}/diff/${diffPeriod}.json: current_period "${diff.current_period}" has no matching ${diff.current_period}.json`);
      }
      if (diff.prior_period !== null && !pf.quarterFiles[diff.prior_period]) {
        errors.push(`${slug}/diff/${diffPeriod}.json: prior_period "${diff.prior_period}" has no matching ${diff.prior_period}.json`);
      }
    }
  }

  // pending.json
  if (!Array.isArray(d.pending.pending)) errors.push('_pending.json: pending must be an array');

  return { errors, warnings };
}
