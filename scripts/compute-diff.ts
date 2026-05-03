import type {
  FilingFile, Position, SecuritiesFile, TagsFile, MovementRow, DiffFile, Breakdown,
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

  // sort each bucket by absolute |delta_value| desc
  for (const bucket of ['new', 'closed', 'increased', 'decreased'] as const) {
    movements[bucket].sort((a, b) => Math.abs(b.delta_value) - Math.abs(a.delta_value));
  }

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
    sector_breakdown: emptyBreakdown(),    // filled in next task
    theme_breakdown: null,                  // filled in next task
  };
}

function emptyBreakdown(): Breakdown {
  return { current: [], prior: [], deltas: [] };
}
