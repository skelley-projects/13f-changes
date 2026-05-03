// scripts/run-remind.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildReminderBody, sendViaResend } from './remind.js';
import type { FundsFile, PendingFile } from './types.js';

const ROOT = process.cwd();
const funds: FundsFile[] = JSON.parse(readFileSync(join(ROOT, 'data/funds.json'), 'utf8'));
const pending: PendingFile = JSON.parse(readFileSync(join(ROOT, 'data/_pending.json'), 'utf8'));

const body = buildReminderBody(funds, pending);
if (!body) {
  console.log('No pending filings, nothing to remind about.');
  process.exit(0);
}

const apiKey = process.env.RESEND_API_KEY;
const to = process.env.EMAIL_TO ?? 'seanfkelley1@gmail.com';
const from = process.env.EMAIL_FROM ?? 'reminders@13f-changes.example.com';

if (!apiKey) {
  console.log('No RESEND_API_KEY — would have sent:');
  console.log(`Subject: ${body.subject}`);
  console.log(body.text);
  process.exit(0);
}

await sendViaResend(body, { apiKey, to, from });
console.log('Reminder sent.');
