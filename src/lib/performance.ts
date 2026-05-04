import type { FilingFile, Position, PriceSnapshotFile, SecuritiesFile } from '../../scripts/types';

export interface PositionPerformanceRow {
  cusip: string;
  ticker: string;
  name: string;
  shares: number;
  reported_value: number;
  reported_price: number;
  latest_price: number;
  latest_value: number;
  delta_value: number;
  delta_pct: number;
  as_of: string;
}

function isPriceEligible(position: Position, securities: SecuritiesFile): boolean {
  if (position.put_call !== null || position.shares_type !== 'SH' || position.shares <= 0) return false;
  const security = securities[position.cusip];
  if (!security?.ticker) return false;
  if (security.name.toUpperCase().includes('CONV NOTES')) return false;
  return true;
}

export function buildPositionPerformance(
  filing: FilingFile,
  securities: SecuritiesFile,
  prices: PriceSnapshotFile | null,
): PositionPerformanceRow[] {
  if (!prices) return [];
  const rows: PositionPerformanceRow[] = [];

  for (const position of filing.positions) {
    if (!isPriceEligible(position, securities)) continue;
    const security = securities[position.cusip];
    const ticker = security.ticker!;
    const quote = prices.records[ticker.toUpperCase()];
    if (!quote || quote.currency !== 'USD') continue;

    const reportedPrice = position.value / position.shares;
    if (reportedPrice <= 0) continue;
    const latestValue = quote.price * position.shares;
    rows.push({
      cusip: position.cusip,
      ticker,
      name: security.name ?? position.name_of_issuer,
      shares: position.shares,
      reported_value: position.value,
      reported_price: reportedPrice,
      latest_price: quote.price,
      latest_value: latestValue,
      delta_value: latestValue - position.value,
      delta_pct: ((quote.price - reportedPrice) / reportedPrice) * 100,
      as_of: quote.as_of,
    });
  }

  rows.sort((a, b) => Math.abs(b.delta_value) - Math.abs(a.delta_value));
  return rows;
}
