/**
 * Bounded-concurrency async map.
 *
 * Runs `worker` over `items` with at most `limit` promises in flight at once,
 * returning results in input order. Like `Promise.all`, the first rejection
 * rejects the whole call, so wrap per-item error handling inside `worker` when
 * you want partial results.
 *
 * Use this for IO / network / API-bound batches (e.g. one HTTP call per item):
 * it gives a real speedup over a serial `for ... await` loop while letting you
 * cap concurrency to stay within an external service's rate limit. (For
 * CPU-bound work in Node, reach for worker_threads instead.)
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  if (items.length === 0) return results;
  const max = Math.max(1, Math.min(Math.floor(limit) || 1, items.length));
  let cursor = 0;
  async function runner(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: max }, () => runner()));
  return results;
}
