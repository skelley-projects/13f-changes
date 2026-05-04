import { describe, it, expect } from 'vitest';
import { formatUSD, formatPrice, formatPct, formatPctDelta, formatShares, formatPeriod } from '../src/lib/format';

describe('formatters', () => {
  it('formatUSD renders compact ($420M, $1.2B, $5.5B)', () => {
    expect(formatUSD(420_000_000)).toBe('$420M');
    expect(formatUSD(1_200_000_000)).toBe('$1.2B');
    expect(formatUSD(5_516_758_344)).toBe('$5.5B');
    expect(formatUSD(800_000)).toBe('$800K');
  });
  it('formatPct rounds to 1 decimal', () => {
    expect(formatPct(17.456)).toBe('17.5%');
  });
  it('formatPrice renders cents', () => {
    expect(formatPrice(86.8912)).toBe('$86.89');
  });
  it('formatPctDelta shows sign and pp', () => {
    expect(formatPctDelta(8)).toBe('+8 pp');
    expect(formatPctDelta(-6)).toBe('−6 pp');   // U+2212
    expect(formatPctDelta(0)).toBe('0 pp');
  });
  it('formatShares uses thousands separators', () => {
    expect(formatShares(2_400_000)).toBe('2,400,000');
  });
  it('formatPeriod renders 2025-Q4 as "Q4 2025"', () => {
    expect(formatPeriod('2025-Q4')).toBe('Q4 2025');
  });
});
