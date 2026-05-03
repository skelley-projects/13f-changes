export function formatUSD(usd: number): string {
  const abs = Math.abs(usd);
  if (abs >= 1e9) return `$${(usd / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
  if (abs >= 1e6) return `$${(usd / 1e6).toFixed(0)}M`;
  if (abs >= 1e3) return `$${(usd / 1e3).toFixed(0)}K`;
  return `$${usd.toFixed(0)}`;
}
export function formatPct(pct: number): string {
  return `${pct.toFixed(1)}%`;
}
export function formatPctDelta(delta: number): string {
  if (delta === 0) return '0 pp';
  if (delta > 0) return `+${delta.toFixed(0)} pp`;
  return `−${Math.abs(delta).toFixed(0)} pp`;  // U+2212 minus
}
export function formatShares(n: number): string {
  return n.toLocaleString('en-US');
}
export function formatPeriod(period: string): string {
  // "2025-Q4" → "Q4 2025"
  const [year, q] = period.split('-');
  return `${q} ${year}`;
}
