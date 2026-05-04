import type { MovementRow } from '../../scripts/types';

type PriceSide = 'current' | 'prior';

function isOrdinaryShareRow(row: MovementRow): boolean {
  return row.put_call === null && row.shares_type === 'SH';
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
