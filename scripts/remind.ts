// scripts/remind.ts
import type { FundsFile, PendingFile } from './types.js';

export interface ReminderBody {
  subject: string;
  text: string;
}

export function buildReminderBody(
  funds: FundsFile[],
  pending: PendingFile,
): ReminderBody | null {
  if (pending.pending.length === 0) return null;
  const fundBySlug = new Map(funds.map(f => [f.slug, f]));
  const lines = pending.pending.map(p => {
    const f = fundBySlug.get(p.slug);
    return `· ${f?.name ?? p.slug} — period ending ${p.period_ending} — filed ${p.filing_date}`;
  });
  const subject = `13f-changes: ${pending.pending.length} filing${pending.pending.length === 1 ? '' : 's'} awaiting review`;
  const text = [
    `${pending.pending.length} new 13F filing${pending.pending.length === 1 ? '' : 's'} are queued for review.\n`,
    ...lines,
    '',
    'Run `/update-quarter` in Claude Code to process them.',
  ].join('\n');
  return { subject, text };
}

export async function sendViaResend(
  body: ReminderBody,
  opts: { apiKey: string; to: string; from: string; fetch?: typeof fetch },
): Promise<void> {
  const f = opts.fetch ?? globalThis.fetch;
  const res = await f('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: opts.from,
      to: opts.to,
      subject: body.subject,
      text: body.text,
    }),
  });
  if (!res.ok) throw new Error(`Resend HTTP ${res.status}: ${await res.text()}`);
}
