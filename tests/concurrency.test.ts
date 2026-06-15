import { describe, it, expect } from 'vitest';
import { mapWithConcurrency } from '../scripts/concurrency';

describe('mapWithConcurrency', () => {
  it('returns results in input order', async () => {
    const out = await mapWithConcurrency([1, 2, 3, 4], 2, async (n) => n * 10);
    expect(out).toEqual([10, 20, 30, 40]);
  });

  it('passes the index to the worker', async () => {
    const out = await mapWithConcurrency(['a', 'b', 'c'], 2, async (s, i) => `${s}${i}`);
    expect(out).toEqual(['a0', 'b1', 'c2']);
  });

  it('never exceeds the concurrency limit, but does run concurrently', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const items = Array.from({ length: 12 }, (_, i) => i);
    await mapWithConcurrency(items, 3, async (n) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return n;
    });
    expect(maxInFlight).toBeLessThanOrEqual(3);
    expect(maxInFlight).toBeGreaterThan(1); // proves it isn't accidentally serial
  });

  it('handles an empty list', async () => {
    expect(await mapWithConcurrency([], 4, async (x) => x)).toEqual([]);
  });

  it('runs every item even when the limit exceeds the item count', async () => {
    const seen: number[] = [];
    await mapWithConcurrency([1, 2], 10, async (n) => { seen.push(n); return n; });
    expect(seen.sort()).toEqual([1, 2]);
  });
});
