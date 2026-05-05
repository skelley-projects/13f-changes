import type {
  FilingFile, Position, SecuritiesFile, TagsFile, MovementRow, MovementActivity, DiffFile, Breakdown,
  BreakdownDelta, BreakdownEntry, ActivityBreakdown,
} from './types.js';

export interface ComputeDiffInput {
  current: FilingFile;
  prior: FilingFile | null;     // null = first filing
  securities: SecuritiesFile;
  tags: TagsFile;
}

function positionKey(p: Position): string {
  return `${p.cusip}|${p.title_of_class}|${p.put_call ?? ''}`;
}

function decoratedRow(
  cusip: string,
  curr: Position | undefined,
  prior: Position | undefined,
  securities: SecuritiesFile,
  tags: TagsFile,
  totalCurrent: number,
): MovementRow {
  const sec = securities[cusip];
  const cName = curr?.name_of_issuer ?? prior?.name_of_issuer ?? cusip;
  return {
    cusip,
    ticker: sec?.ticker ?? null,
    name: sec?.name ?? cName,
    title_of_class: curr?.title_of_class ?? prior?.title_of_class ?? '',
    shares_type: curr?.shares_type ?? prior?.shares_type ?? 'SH',
    put_call: curr?.put_call ?? prior?.put_call ?? null,
    sector: sec?.sector ?? 'Unclassified',
    industry: sec?.industry ?? 'Unclassified',
    tags: tags.assignments[cusip] ?? [],
    current_value: curr?.value ?? null,
    prior_value: prior?.value ?? null,
    current_shares: curr?.shares ?? null,
    prior_shares: prior?.shares ?? null,
    delta_value: (curr?.value ?? 0) - (prior?.value ?? 0),
    delta_shares: (curr?.shares ?? 0) - (prior?.shares ?? 0),
    delta_pct: prior && curr && prior.shares > 0
      ? ((curr.shares - prior.shares) / prior.shares) * 100
      : null,
    current_pct_of_portfolio: curr ? (curr.value / totalCurrent) * 100 : null,
  };
}

export function computeDiff(input: ComputeDiffInput): DiffFile {
  const { current, prior, securities, tags } = input;

  const movements = {
    new: [] as MovementRow[],
    closed: [] as MovementRow[],
    increased: [] as MovementRow[],
    decreased: [] as MovementRow[],
    activity: [] as MovementActivity[],
    unchanged_count: 0,
    unchanged_value: 0,
  };

  const currentMap = new Map<string, Position>();
  for (const p of current.positions) currentMap.set(positionKey(p), p);
  const priorMap = new Map<string, Position>();
  if (prior) for (const p of prior.positions) priorMap.set(positionKey(p), p);

  const seenInCurrent = new Set<string>();
  for (const [k, currPos] of currentMap.entries()) {
    seenInCurrent.add(k);
    const priorPos = priorMap.get(k);
    const row = decoratedRow(currPos.cusip, currPos, priorPos, securities, tags, current.total_value);
    if (!priorPos) {
      movements.new.push(row);
    } else if (currPos.shares > priorPos.shares) {
      movements.increased.push(row);
    } else if (currPos.shares < priorPos.shares) {
      movements.decreased.push(row);
    } else {
      movements.unchanged_count += 1;
      movements.unchanged_value += currPos.value;
    }
  }
  for (const [k, priorPos] of priorMap.entries()) {
    if (seenInCurrent.has(k)) continue;
    const row = decoratedRow(priorPos.cusip, undefined, priorPos, securities, tags, current.total_value);
    movements.closed.push(row);
  }

  movements.activity = extractBuySellActivity(movements.new, movements.closed);

  // sort each bucket by absolute |delta_value| desc
  for (const bucket of ['new', 'closed', 'increased', 'decreased'] as const) {
    movements[bucket].sort((a, b) => Math.abs(b.delta_value) - Math.abs(a.delta_value));
  }
  movements.activity.sort((a, b) =>
    Math.max(b.current_value, b.prior_value) - Math.max(a.current_value, a.prior_value),
  );

  const sectorKey = (p: Position): string =>
    securities[p.cusip]?.sector ?? 'Unclassified';

  const granular = buildGranularBreakdown(current, prior, tags);
  const activity = buildActivityBreakdowns(movements, tags);

  return {
    slug: current.slug,
    current_period: current.period,
    prior_period: prior?.period ?? null,
    totals: {
      current_value: current.total_value,
      prior_value: prior?.total_value ?? 0,
      net_flow: current.total_value - (prior?.total_value ?? 0),
    },
    movements,
    sector_breakdown: buildBreakdown(current, prior, sectorKey),
    theme_breakdown: buildThemeBreakdown(current, prior, tags),
    granular_breakdown: granular.breakdown,
    granular_coverage_pct: granular.coverage_pct,
    theme_activity_breakdown: activity.theme,
    granular_activity_breakdown: activity.granular,
  };
}

function activityKey(row: MovementRow): string | null {
  if (row.ticker) return `ticker:${row.ticker.toUpperCase()}`;
  const normalized = row.name
    .toUpperCase()
    .replace(/\b(CONV|CONVERTIBLE)\b.*$/g, '')
    .replace(/\b(CL|CLASS)\s+[A-Z]\b/g, '')
    .replace(/\b(COM|COMMON|INC|CORP|LTD|PLC|HLDGS|HOLDINGS)\b/g, '')
    .replace(/[^A-Z0-9]/g, '');
  return normalized.length >= 4 ? `name:${normalized}` : null;
}

function groupRows(rows: MovementRow[]): Map<string, MovementRow[]> {
  const grouped = new Map<string, MovementRow[]>();
  for (const row of rows) {
    const key = activityKey(row);
    if (!key) continue;
    const bucket = grouped.get(key) ?? [];
    bucket.push(row);
    grouped.set(key, bucket);
  }
  return grouped;
}

function sumRows(rows: MovementRow[], field: 'current_value' | 'prior_value'): number {
  return rows.reduce((sum, row) => sum + (row[field] ?? 0), 0);
}

function extractBuySellActivity(newRows: MovementRow[], closedRows: MovementRow[]): MovementActivity[] {
  const newByKey = groupRows(newRows);
  const closedByKey = groupRows(closedRows);
  const activityKeys = new Set(
    [...newByKey.keys()].filter(key => closedByKey.has(key)),
  );
  if (activityKeys.size === 0) return [];

  const activity: MovementActivity[] = [];
  for (const key of activityKeys) {
    const bought = newByKey.get(key)!;
    const sold = closedByKey.get(key)!;
    const representative = bought[0] ?? sold[0];
    const tags = Array.from(new Set([...bought, ...sold].flatMap(row => row.tags)));
    const currentValue = sumRows(bought, 'current_value');
    const priorValue = sumRows(sold, 'prior_value');
    activity.push({
      key,
      ticker: representative.ticker,
      name: representative.name,
      sector: representative.sector,
      industry: representative.industry,
      tags,
      bought,
      sold,
      current_value: currentValue,
      prior_value: priorValue,
      net_delta_value: currentValue - priorValue,
    });
  }

  for (let i = newRows.length - 1; i >= 0; i--) {
    const key = activityKey(newRows[i]);
    if (key && activityKeys.has(key)) newRows.splice(i, 1);
  }
  for (let i = closedRows.length - 1; i >= 0; i--) {
    const key = activityKey(closedRows[i]);
    if (key && activityKeys.has(key)) closedRows.splice(i, 1);
  }

  return activity;
}

function buildThemeBreakdown(
  current: FilingFile,
  prior: FilingFile | null,
  tags: TagsFile,
): Breakdown | null {
  if (tags.taxonomy.length === 0) return null;
  const labelById = new Map(tags.taxonomy.map(t => [t.id, t.label]));
  const parentById = new Map(tags.taxonomy.map(t => [t.id, t.parent]));

  // Resolve a position's tag ids to the SET of broad theme labels it counts toward.
  // Sub-tags are rolled up to their parent. Top-level tags map to themselves.
  // De-duplicated so a position tagged ["ai-compute", "photonics"] counts toward
  // "AI compute" exactly once.
  const broadLabelsForPosition = (cusip: string): Set<string> => {
    const labels = new Set<string>();
    const ids = tags.assignments[cusip] ?? [];
    for (const id of ids) {
      const parent = parentById.get(id);
      const broadId = parent ?? id;
      const label = labelById.get(broadId);
      if (label) labels.add(label);
    }
    return labels;
  };

  const aggregateBroad = (filing: FilingFile): Map<string, number> => {
    const out = new Map<string, number>();
    for (const p of filing.positions) {
      for (const label of broadLabelsForPosition(p.cusip)) {
        out.set(label, (out.get(label) ?? 0) + p.value);
      }
    }
    return out;
  };

  const currentMix = aggregateBroad(current);
  const priorMix = prior ? aggregateBroad(prior) : new Map<string, number>();
  const labels = new Set([...currentMix.keys(), ...priorMix.keys()]);

  const currentTotal = current.total_value || 1;
  const priorTotal = prior?.total_value || 1;

  const currentEntries: BreakdownEntry[] = [];
  const priorEntries: BreakdownEntry[] = [];
  const deltas: BreakdownDelta[] = [];
  for (const label of labels) {
    const cv = currentMix.get(label) ?? 0;
    const pv = priorMix.get(label) ?? 0;
    const cPct = (cv / currentTotal) * 100;
    const pPct = (pv / priorTotal) * 100;
    if (cv > 0) currentEntries.push({ label, value: cv, pct: cPct });
    if (pv > 0) priorEntries.push({ label, value: pv, pct: pPct });
    deltas.push({ label, delta_pct_pts: cPct - pPct });
  }
  currentEntries.sort((a, b) => b.value - a.value);
  priorEntries.sort((a, b) => b.value - a.value);
  deltas.sort((a, b) => Math.abs(b.delta_pct_pts) - Math.abs(a.delta_pct_pts));
  return { current: currentEntries, prior: priorEntries, deltas };
}

function buildActivityBreakdowns(
  movements: {
    new: MovementRow[];
    closed: MovementRow[];
    increased: MovementRow[];
    decreased: MovementRow[];
    activity: MovementActivity[];
  },
  tags: TagsFile,
): { theme: ActivityBreakdown | null; granular: ActivityBreakdown | null } {
  if (tags.taxonomy.length === 0) return { theme: null, granular: null };

  const labelById = new Map(tags.taxonomy.map(t => [t.id, t.label]));
  const parentById = new Map(tags.taxonomy.map(t => [t.id, t.parent]));
  const subTagIds = new Set(tags.taxonomy.filter(t => t.parent !== undefined).map(t => t.id));

  const broadLabelsForTags = (ids: string[]): Set<string> => {
    const labels = new Set<string>();
    for (const id of ids) {
      const broadId = parentById.get(id) ?? id;
      const label = labelById.get(broadId);
      if (label) labels.add(label);
    }
    return labels;
  };

  const granularLabelsForTags = (ids: string[]): Set<string> => {
    const labels = new Set<string>();
    for (const id of ids) {
      if (!subTagIds.has(id)) continue;
      const label = labelById.get(id);
      if (label) labels.add(label);
    }
    return labels;
  };

  type ActivityLeg = { tags: string[]; bought: number; sold: number };
  const legs: ActivityLeg[] = [];

  for (const row of movements.new) {
    legs.push({ tags: row.tags, bought: row.current_value ?? 0, sold: 0 });
  }
  for (const row of movements.closed) {
    legs.push({ tags: row.tags, bought: 0, sold: row.prior_value ?? 0 });
  }
  for (const row of movements.increased) {
    legs.push({ tags: row.tags, bought: estimateAddedValue(row), sold: 0 });
  }
  for (const row of movements.decreased) {
    legs.push({ tags: row.tags, bought: 0, sold: estimateReducedValue(row) });
  }
  for (const activity of movements.activity) {
    for (const row of activity.bought) {
      legs.push({ tags: row.tags, bought: row.current_value ?? 0, sold: 0 });
    }
    for (const row of activity.sold) {
      legs.push({ tags: row.tags, bought: 0, sold: row.prior_value ?? 0 });
    }
  }

  return {
    theme: aggregateActivity(legs, broadLabelsForTags),
    granular: subTagIds.size === 0 ? null : aggregateActivity(legs, granularLabelsForTags),
  };
}

function estimateAddedValue(row: MovementRow): number {
  if (
    row.delta_shares > 0 &&
    row.current_shares !== null &&
    row.current_shares > 0 &&
    row.current_value !== null
  ) {
    return (row.current_value / row.current_shares) * row.delta_shares;
  }
  return Math.max(row.delta_value, 0);
}

function estimateReducedValue(row: MovementRow): number {
  if (
    row.delta_shares < 0 &&
    row.prior_shares !== null &&
    row.prior_shares > 0 &&
    row.prior_value !== null
  ) {
    return (row.prior_value / row.prior_shares) * Math.abs(row.delta_shares);
  }
  return Math.max(-row.delta_value, 0);
}

function aggregateActivity(
  legs: Array<{ tags: string[]; bought: number; sold: number }>,
  labelsForTags: (ids: string[]) => Set<string>,
): ActivityBreakdown | null {
  const byLabel = new Map<string, { bought: number; sold: number }>();

  for (const leg of legs) {
    if (leg.bought === 0 && leg.sold === 0) continue;
    for (const label of labelsForTags(leg.tags)) {
      const entry = byLabel.get(label) ?? { bought: 0, sold: 0 };
      entry.bought += leg.bought;
      entry.sold += leg.sold;
      byLabel.set(label, entry);
    }
  }

  const entries = [...byLabel.entries()]
    .map(([label, value]) => ({
      label,
      bought: value.bought,
      sold: value.sold,
      net: value.bought - value.sold,
    }))
    .filter(entry => entry.bought > 0 || entry.sold > 0)
    .sort((a, b) => (b.bought + b.sold) - (a.bought + a.sold));

  if (entries.length === 0) return null;

  return {
    entries,
    total_bought: entries.reduce((sum, entry) => sum + entry.bought, 0),
    total_sold: entries.reduce((sum, entry) => sum + entry.sold, 0),
    net: entries.reduce((sum, entry) => sum + entry.net, 0),
  };
}

function buildGranularBreakdown(
  current: FilingFile,
  prior: FilingFile | null,
  tags: TagsFile,
): { breakdown: Breakdown | null; coverage_pct: number | null } {
  const subTagIds = new Set(
    tags.taxonomy.filter(t => t.parent !== undefined).map(t => t.id),
  );
  if (subTagIds.size === 0) {
    return { breakdown: null, coverage_pct: null };
  }
  const labelById = new Map(tags.taxonomy.map(t => [t.id, t.label]));

  const aggregateGranular = (filing: FilingFile): Map<string, number> => {
    const out = new Map<string, number>();
    for (const p of filing.positions) {
      const ids = tags.assignments[p.cusip] ?? [];
      for (const id of ids) {
        if (!subTagIds.has(id)) continue;
        const label = labelById.get(id);
        if (!label) continue;
        out.set(label, (out.get(label) ?? 0) + p.value);
      }
    }
    return out;
  };

  // Coverage: % of current AUM held by positions that have at least one sub-tag.
  let coveredValue = 0;
  for (const p of current.positions) {
    const ids = tags.assignments[p.cusip] ?? [];
    if (ids.some(id => subTagIds.has(id))) coveredValue += p.value;
  }
  const coveragePct = current.total_value > 0
    ? (coveredValue / current.total_value) * 100
    : 0;

  const currentMix = aggregateGranular(current);
  if (currentMix.size === 0 && (!prior || aggregateGranular(prior).size === 0)) {
    return { breakdown: null, coverage_pct: null };
  }
  const priorMix = prior ? aggregateGranular(prior) : new Map<string, number>();
  const labels = new Set([...currentMix.keys(), ...priorMix.keys()]);

  const currentTotal = current.total_value || 1;
  const priorTotal = prior?.total_value || 1;

  const currentEntries: BreakdownEntry[] = [];
  const priorEntries: BreakdownEntry[] = [];
  const deltas: BreakdownDelta[] = [];
  for (const label of labels) {
    const cv = currentMix.get(label) ?? 0;
    const pv = priorMix.get(label) ?? 0;
    const cPct = (cv / currentTotal) * 100;
    const pPct = (pv / priorTotal) * 100;
    if (cv > 0) currentEntries.push({ label, value: cv, pct: cPct });
    if (pv > 0) priorEntries.push({ label, value: pv, pct: pPct });
    deltas.push({ label, delta_pct_pts: cPct - pPct });
  }
  currentEntries.sort((a, b) => b.value - a.value);
  priorEntries.sort((a, b) => b.value - a.value);
  deltas.sort((a, b) => Math.abs(b.delta_pct_pts) - Math.abs(a.delta_pct_pts));
  return {
    breakdown: { current: currentEntries, prior: priorEntries, deltas },
    coverage_pct: coveragePct,
  };
}

function buildBreakdown(
  current: FilingFile,
  prior: FilingFile | null,
  groupKey: (p: Position) => string,
): Breakdown {
  const currentMix = aggregate(current, groupKey);
  const priorMix = prior ? aggregate(prior, groupKey) : new Map<string, number>();
  const labels = new Set([...currentMix.keys(), ...priorMix.keys()]);

  const currentTotal = current.total_value || 1;
  const priorTotal = prior?.total_value || 1;

  const currentEntries: BreakdownEntry[] = [];
  const priorEntries: BreakdownEntry[] = [];
  const deltas: BreakdownDelta[] = [];

  for (const label of labels) {
    const cv = currentMix.get(label) ?? 0;
    const pv = priorMix.get(label) ?? 0;
    const cPct = (cv / currentTotal) * 100;
    const pPct = (pv / priorTotal) * 100;
    if (cv > 0) currentEntries.push({ label, value: cv, pct: cPct });
    if (pv > 0) priorEntries.push({ label, value: pv, pct: pPct });
    deltas.push({ label, delta_pct_pts: cPct - pPct });
  }

  currentEntries.sort((a, b) => b.value - a.value);
  priorEntries.sort((a, b) => b.value - a.value);
  deltas.sort((a, b) => Math.abs(b.delta_pct_pts) - Math.abs(a.delta_pct_pts));

  return { current: currentEntries, prior: priorEntries, deltas };
}

function aggregate(filing: FilingFile, key: (p: Position) => string): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of filing.positions) {
    const k = key(p);
    out.set(k, (out.get(k) ?? 0) + p.value);
  }
  return out;
}
