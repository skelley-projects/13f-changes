import { describe, it, expect } from 'vitest';
import { buildReminderBody } from '../scripts/remind';
import type { FundsFile, PendingFile } from '../scripts/types';

describe('buildReminderBody', () => {
  const funds: FundsFile[] = [
    { slug: 'a', name: 'Alpha LP', manager_name: 'A', cik: '0000000001', location: '',
      description: '', added: '2026-01-01', active: true },
  ];
  it('returns null when nothing pending', () => {
    const result = buildReminderBody(funds, { pending: [] });
    expect(result).toBeNull();
  });
  it('builds a body listing each pending filing', () => {
    const pending: PendingFile = { pending: [{
      slug: 'a', cik: '0000000001', accession: 'X', period_ending: '2025-12-31',
      filing_date: '2026-02-11',
      edgar_url: 'https://example.com', discovered_at: '2026-02-11T00:00:00Z',
    }]};
    const body = buildReminderBody(funds, pending)!;
    expect(body.subject).toMatch(/1 filing/);
    expect(body.text).toMatch(/Alpha LP/);
    expect(body.text).toMatch(/2025-12-31/);
  });
});
