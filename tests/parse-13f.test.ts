import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFiling } from '../scripts/parse-13f';

const fixtures = join(__dirname, 'fixtures');

describe('parseFiling — Situational Awareness Q4 2025 (modern X02 schema, values in dollars)', () => {
  it('parses Situational Awareness Q4 2025', () => {
    const primary = readFileSync(join(fixtures, 'sa-2025-q4-primary_doc.xml'), 'utf8');
    const table = readFileSync(join(fixtures, 'sa-2025-q4-informationtable.xml'), 'utf8');

    const result = parseFiling({ primaryDocXml: primary, holdingsXml: table });

    expect(result.schema_version).toBe('X02');
    expect(result.value_units).toBe('USD');
    expect(result.period_ending).toBe('2025-12-31');
    expect(result.position_count).toBe(29);
    // Sum-of-positions equals the cover page total
    const sum = result.positions.reduce((s, p) => s + p.value, 0);
    expect(sum).toBe(result.total_value);
    // Bloom Energy common stock position (the largest)
    const bloomCommon = result.positions.find(
      p => p.cusip === '093712107' && p.put_call === null,
    );
    expect(bloomCommon).toBeDefined();
    expect(bloomCommon!.shares).toBe(10076022);
    expect(bloomCommon!.value).toBe(875505552); // already in dollars
  });
});

describe('parseFiling — legacy fixture (Duquesne 2019, values in thousands)', () => {
  it('detects thousands via heuristic and normalizes to dollars', () => {
    const primary = readFileSync(join(fixtures, 'duquesne-2019-q2-primary_doc.xml'), 'utf8');
    const table = readFileSync(join(fixtures, 'duquesne-2019-q2-informationtable.xml'), 'utf8');

    const result = parseFiling({ primaryDocXml: primary, holdingsXml: table });

    // Duquesne 2019 has no <schemaVersion> element — parser should default to X01.
    expect(result.schema_version).toBe('X01');
    // Heuristic detects raw values are in thousands.
    expect(result.value_units).toBe('USD_THOUSANDS');
    // After normalization, the largest position is non-trivial and per-share price is plausible.
    const largest = [...result.positions].sort((a, b) => b.value - a.value)[0];
    expect(largest.value).toBeGreaterThan(1_000_000);
    const perShare = largest.value / largest.shares;
    expect(perShare).toBeGreaterThan(1);
    expect(perShare).toBeLessThan(20_000);
  });
});

describe('parseFiling — edge cases', () => {
  it('keeps options positions distinct from the underlying common', () => {
    const primary = readFileSync(join(fixtures, 'sa-2025-q4-primary_doc.xml'), 'utf8');
    const table = readFileSync(join(fixtures, 'sa-2025-q4-informationtable.xml'), 'utf8');
    const result = parseFiling({ primaryDocXml: primary, holdingsXml: table });

    const bloomRows = result.positions.filter(p => p.cusip === '093712107');
    expect(bloomRows.length).toBe(2);
    expect(bloomRows.find(p => p.put_call === null)).toBeDefined();
    expect(bloomRows.find(p => p.put_call === 'Call')).toBeDefined();
  });

  it('preserves letter-prefix (foreign-listed) CUSIPs', () => {
    const primary = readFileSync(join(fixtures, 'sa-2025-q4-primary_doc.xml'), 'utf8');
    const table = readFileSync(join(fixtures, 'sa-2025-q4-informationtable.xml'), 'utf8');
    const result = parseFiling({ primaryDocXml: primary, holdingsXml: table });

    // Bitdeer's Cayman class A ordinary shares
    const bitdeer = result.positions.find(p => p.cusip === 'G11448100');
    expect(bitdeer).toBeDefined();
    expect(bitdeer!.name_of_issuer).toMatch(/BITDEER/i);
  });
});
