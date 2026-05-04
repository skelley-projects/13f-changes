import type { MovementRow, PriceSnapshotFile } from '../../scripts/types';

type PriceSide = 'current' | 'prior';

function isOrdinaryShareRow(row: MovementRow): boolean {
  if (row.put_call !== null || row.shares_type !== 'SH') return false;
  return !/\b(CONV|NOTE|NOTES|DEBENTURE)\b/i.test(`${row.name} ${row.title_of_class}`);
}

export function priceUnsupportedLabel(row: MovementRow): string | null {
  if (row.put_call) return `${row.put_call} option`;
  if (row.shares_type === 'PRN') return 'principal amt.';
  if (/\b(CONV|NOTE|NOTES|DEBENTURE)\b/i.test(`${row.name} ${row.title_of_class}`)) return 'conv. note';
  return null;
}

export function impliedPositionPrice(row: MovementRow, side: PriceSide): number | null {
  if (!isOrdinaryShareRow(row)) return null;
  const value = side === 'current' ? row.current_value : row.prior_value;
  const shares = side === 'current' ? row.current_shares : row.prior_shares;
  if (value === null || shares === null || value <= 0 || shares <= 0) return null;
  return value / shares;
}

export function weightedImpliedPositionPrice(rows: MovementRow[], side: PriceSide): number | null {
  let value = 0;
  let shares = 0;
  for (const row of rows) {
    if (!isOrdinaryShareRow(row)) continue;
    const rowValue = side === 'current' ? row.current_value : row.prior_value;
    const rowShares = side === 'current' ? row.current_shares : row.prior_shares;
    if (rowValue === null || rowShares === null || rowValue <= 0 || rowShares <= 0) continue;
    value += rowValue;
    shares += rowShares;
  }
  return shares > 0 ? value / shares : null;
}

export interface EstimatedGain {
  value: number;
  pct: number;
  as_of: string;
}

export interface UnderlyingMove {
  pct: number;
  as_of: string;
}

export function estimateLatestGain(
  row: MovementRow,
  prices: PriceSnapshotFile | null,
): EstimatedGain | null {
  if (!prices || !row.ticker || !isOrdinaryShareRow(row)) return null;
  if (row.current_value === null || row.current_shares === null || row.current_shares <= 0) return null;
  const quote = prices.records[row.ticker.toUpperCase()];
  if (!quote || quote.currency !== 'USD' || quote.price <= 0) return null;
  const cost = impliedPositionPrice(row, 'current');
  if (cost === null || cost <= 0) return null;
  const value = (quote.price - cost) * row.current_shares;
  return {
    value,
    pct: ((quote.price - cost) / cost) * 100,
    as_of: quote.as_of,
  };
}

export function estimateLatestGainForRows(
  rows: MovementRow[],
  prices: PriceSnapshotFile | null,
): EstimatedGain | null {
  let value = 0;
  let basis = 0;
  let latestValue = 0;
  let latestAsOf = '';

  for (const row of rows) {
    const gain = estimateLatestGain(row, prices);
    if (!gain || row.current_value === null) continue;
    value += gain.value;
    basis += row.current_value;
    latestValue += row.current_value + gain.value;
    if (gain.as_of > latestAsOf) latestAsOf = gain.as_of;
  }

  if (basis <= 0) return null;
  return {
    value,
    pct: ((latestValue - basis) / basis) * 100,
    as_of: latestAsOf,
  };
}

export function estimateUnderlyingMove(
  row: MovementRow,
  prices: PriceSnapshotFile | null,
): UnderlyingMove | null {
  if (!prices || !row.ticker || !row.put_call) return null;
  const quote = prices.records[row.ticker.toUpperCase()];
  if (!quote || quote.currency !== 'USD' || quote.price <= 0) return null;
  const current = row.current_value !== null && row.current_shares !== null && row.current_shares > 0
    ? row.current_value / row.current_shares
    : null;
  const prior = row.prior_value !== null && row.prior_shares !== null && row.prior_shares > 0
    ? row.prior_value / row.prior_shares
    : null;
  const reference = current ?? prior;
  if (reference === null || reference <= 0) return null;
  return {
    pct: ((quote.price - reference) / reference) * 100,
    as_of: quote.as_of,
  };
}

export function priceRangeFor(
  row: MovementRow,
  period: string,
  prices: PriceSnapshotFile | null,
) {
  if (!prices?.ranges || !row.ticker || !isOrdinaryShareRow(row)) return null;
  return prices.ranges[`${row.ticker.toUpperCase()}:${period}`] ?? null;
}
