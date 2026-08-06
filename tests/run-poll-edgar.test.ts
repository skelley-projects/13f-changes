import { describe, it, expect } from 'vitest';
import { parseWatchArgs } from '../scripts/run-poll-edgar';

describe('parseWatchArgs', () => {
  it('defaults to a single non-watch sweep', () => {
    expect(parseWatchArgs([])).toEqual({
      watch: false,
      durationMinutes: 50,
      intervalSeconds: 300,
    });
  });

  it('enables watch mode with the production defaults', () => {
    const opts = parseWatchArgs(['--watch']);
    expect(opts.watch).toBe(true);
    expect(opts.durationMinutes).toBe(50);
    expect(opts.intervalSeconds).toBe(300);
  });

  it('reads overrides for duration and interval', () => {
    expect(parseWatchArgs([
      '--watch',
      '--duration-minutes=12',
      '--interval-seconds=30',
    ])).toEqual({ watch: true, durationMinutes: 12, intervalSeconds: 30 });
  });

  it('accepts fractional durations', () => {
    expect(parseWatchArgs(['--watch', '--duration-minutes=0.5']).durationMinutes).toBe(0.5);
  });

  // The watch window must stay inside its hourly cron slot, so a typo that
  // silently fell back to a default could overrun into the next scheduled run.
  it.each(['0', '-5', 'abc', ''])('rejects a non-positive or unparseable value: %s', raw => {
    expect(() => parseWatchArgs([`--duration-minutes=${raw}`])).toThrow(/positive number/);
    expect(() => parseWatchArgs([`--interval-seconds=${raw}`])).toThrow(/positive number/);
  });
});
