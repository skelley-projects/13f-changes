import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('sanity', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
  it('can import from node:fs (verifies @types/node + ESM resolution)', () => {
    expect(typeof readFileSync).toBe('function');
  });
});
