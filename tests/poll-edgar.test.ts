import { describe, it, expect, vi } from 'vitest';
import { discoverNewFilings } from '../scripts/poll-edgar';

describe('discoverNewFilings', () => {
  it('returns nothing when accession matches the newest known quarter', async () => {
    const fetchEdgar = vi.fn(async () => [{
      accession: 'A1', filing_date: '2026-02-11', period_ending: '2025-12-31',
    }]);
    const known = { 'fund-x': { latestAccession: 'A1' } };
    const result = await discoverNewFilings(
      [{ slug: 'fund-x', cik: '0000000001' }],
      known,
      { fetchEdgar },
    );
    expect(result).toEqual([]);
  });

  it('returns a pending entry when EDGAR has a newer accession', async () => {
    const fetchEdgar = vi.fn(async () => [{
      accession: 'A2', filing_date: '2026-02-11', period_ending: '2025-12-31',
    }]);
    const known = { 'fund-x': { latestAccession: 'A1' } };
    const result = await discoverNewFilings(
      [{ slug: 'fund-x', cik: '0000000001' }],
      known,
      { fetchEdgar },
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ slug: 'fund-x', accession: 'A2' });
  });
});
