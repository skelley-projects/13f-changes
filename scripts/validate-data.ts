import { z } from 'zod';
import type { FundsFile, SecuritiesFile, PendingFile, QuartersFile, TagsFile, FilingFile, DiffFile } from './types.js';

const fundSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  manager_name: z.string(),
  cik: z.string().regex(/^\d{10}$/),
  location: z.string(),
  description: z.string(),
  added: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  active: z.boolean(),
});

const cusipRegex = /^[A-Z0-9]{9}$/;

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

export interface DatasetForValidation {
  funds: FundsFile[];
  securities: SecuritiesFile;
  pending: PendingFile;
  perFund: Record<string, {
    quarters: QuartersFile;
    tags: TagsFile;
    quarterFiles: Record<string, FilingFile>;
    diffFiles: Record<string, DiffFile>;
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
    if (!r.success) errors.push(`securities.json[${k}]: ${r.error.message}`);
  }

  // per-fund
  for (const [slug, pf] of Object.entries(d.perFund)) {
    if (pf.quarters.slug !== slug) errors.push(`${slug}/quarters.json: slug mismatch`);
    if (pf.tags.slug !== slug) errors.push(`${slug}/tags.json: slug mismatch`);

    // taxonomy ID coverage
    const taxonomyIds = new Set(pf.tags.taxonomy.map(t => t.id));
    for (const [cusip, ids] of Object.entries(pf.tags.assignments)) {
      for (const id of ids) {
        if (!taxonomyIds.has(id)) errors.push(`${slug}/tags.json: assignment ${cusip} references unknown tag ${id}`);
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
  }

  // pending.json
  if (!Array.isArray(d.pending.pending)) errors.push('_pending.json: pending must be an array');

  return { errors, warnings };
}
