// Tests for the Le Coach French app (public/french/): the SRS scheduler,
// the text utilities, and the integrity of the curriculum data files.
// The app ships as classic browser scripts (so it works from file://), so we
// evaluate them in a vm sandbox rather than importing them as ESM.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const ROOT = join(__dirname, '..', 'public', 'french');

function loadSRS() {
  const ctx: Record<string, unknown> = { module: { exports: {} } };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(ROOT, 'js/srs.js'), 'utf8'), ctx as vm.Context);
  return (ctx.module as { exports: any }).exports;
}

function loadU() {
  const ctx: Record<string, unknown> = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(ROOT, 'js/util.js'), 'utf8'), ctx as vm.Context);
  return (ctx.window as any).U;
}

function loadData() {
  const ctx: Record<string, unknown> = { window: {} };
  vm.createContext(ctx);
  const files = ['core.js', ...readdirSync(join(ROOT, 'data')).filter((f) => /^unit\d+\.js$/.test(f)).sort()];
  for (const f of files) {
    vm.runInContext(readFileSync(join(ROOT, 'data', f), 'utf8'), ctx as vm.Context);
  }
  return (ctx.window as any).FRENCH;
}

const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;

describe('SRS scheduler', () => {
  const SRS = loadSRS();
  const now = 1_750_000_000_000;

  it('new cards are not due until first studied', () => {
    const c = SRS.newCard();
    expect(c.state).toBe('new');
    expect(SRS.isDue(c, now)).toBe(false);
  });

  it('walks learning steps on good, then graduates to 1 day', () => {
    let c = SRS.grade(SRS.newCard(), 2, now); // good → step 2 (10m)
    expect(c.state).toBe('learning');
    expect(c.due).toBe(now + 10 * MIN);
    c = SRS.grade(c, 2, now); // good → graduate
    expect(c.state).toBe('review');
    expect(c.interval).toBe(1);
    expect(c.due).toBe(now + DAY);
  });

  it('again resets to the first learning step', () => {
    let c = SRS.grade(SRS.newCard(), 2, now);
    c = SRS.grade(c, 0, now);
    expect(c.state).toBe('learning');
    expect(c.due).toBe(now + 1 * MIN);
  });

  it('easy on a new card graduates straight to 4 days', () => {
    const c = SRS.grade(SRS.newCard(), 3, now);
    expect(c.state).toBe('review');
    expect(c.interval).toBe(4);
  });

  it('good reviews grow the interval by the ease factor', () => {
    let c = SRS.grade(SRS.newCard(), 2, now);
    c = SRS.grade(c, 2, now);            // review, 1d
    c = SRS.grade(c, 2, now + DAY);      // 1 * 2.5 → 3d (rounded)
    expect(c.interval).toBe(3);
    const prev = c.interval;
    c = SRS.grade(c, 2, now + 4 * DAY);
    expect(c.interval).toBeGreaterThan(prev);
  });

  it('lapses shrink ease, enter relearning, and shorten the interval', () => {
    let c = SRS.grade(SRS.newCard(), 2, now);
    c = SRS.grade(c, 2, now);
    c = SRS.grade(c, 2, now + DAY);      // interval 3, ease 2.5
    const easeBefore = c.ease;
    c = SRS.grade(c, 0, now + 4 * DAY);
    expect(c.state).toBe('relearning');
    expect(c.lapses).toBe(1);
    expect(c.ease).toBeLessThan(easeBefore);
    expect(c.due).toBe(now + 4 * DAY + 10 * MIN);
  });

  it('ease never drops below 1.3 and intervals cap at 365 days', () => {
    let c = SRS.grade(SRS.newCard(), 2, now);
    c = SRS.grade(c, 2, now);
    for (let i = 0; i < 20; i++) c = SRS.grade(c, 0, now);
    expect(c.ease).toBeGreaterThanOrEqual(1.3);
    let d = SRS.grade(SRS.newCard(), 2, now);
    d = SRS.grade(d, 2, now);
    for (let i = 0; i < 20; i++) d = SRS.grade(d, 3, now);
    expect(d.interval).toBeLessThanOrEqual(365);
  });

  it('previewLabel renders human-friendly durations', () => {
    const fresh = SRS.newCard();
    expect(SRS.previewLabel(fresh, 0, now)).toBe('1m');
    expect(SRS.previewLabel(fresh, 3, now)).toBe('4d');
  });
});

describe('text utilities', () => {
  const U = loadU();

  it('norm is accent-, case-, and punctuation-lenient', () => {
    expect(U.norm("L'école, c'est génial !")).toBe('l ecole c est genial');
    expect(U.norm("L'école, c'est génial !")).toBe(U.norm('l ecole c est genial'));
    expect(U.norm('Où est la gare ?')).toBe('ou est la gare');
    expect(U.norm('sœur')).toBe('soeur');
  });

  it('wordDiff marks missing and extra words', () => {
    const d = U.wordDiff('je ne parle pas', 'je parle pas');
    expect(d).toEqual([
      { w: 'je', t: 'ok' }, { w: 'ne', t: 'miss' }, { w: 'parle', t: 'ok' }, { w: 'pas', t: 'ok' },
    ]);
    const d2 = U.wordDiff('du pain', 'du bon pain');
    expect(d2.filter((x: any) => x.t === 'extra')).toHaveLength(1);
  });

  it('similarity scores word overlap', () => {
    expect(U.similarity('bonjour madame', 'bonjour madame')).toBe(1);
    expect(U.similarity('bonjour madame', 'bonjour monsieur')).toBe(0.5);
  });
});

describe('curriculum data integrity', () => {
  const FRENCH = loadData();

  it('has 9 units (0–8) with unique ids', () => {
    expect(FRENCH.units).toHaveLength(9);
    const ids = FRENCH.units.map((u: any) => u.id);
    expect(new Set(ids).size).toBe(9);
    expect(FRENCH.units.map((u: any) => u.num)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('every unit carries a full activity set', () => {
    for (const u of FRENCH.units) {
      expect(u.title, u.id).toBeTruthy();
      expect(u.intro, u.id).toBeTruthy();
      expect(u.vocab.length, u.id).toBeGreaterThanOrEqual(30);
      expect(u.grammar.length, u.id).toBeGreaterThanOrEqual(2);
      expect(u.pronunciationFocus.tips.length, u.id).toBeGreaterThanOrEqual(3);
      expect(u.pronunciationFocus.drill.length, u.id).toBeGreaterThanOrEqual(5);
      expect(u.reader.fr.length, u.id).toBeGreaterThanOrEqual(2);
      expect(u.reader.fr.length, u.id).toBe(u.reader.en.length);
      expect(u.dialogue.lines.length, u.id).toBeGreaterThanOrEqual(8);
      expect(u.dictation.length, u.id).toBeGreaterThanOrEqual(5);
      expect(u.writing.length, u.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('vocab cards always have fr/en/es/hint', () => {
    for (const u of FRENCH.units) {
      for (const v of u.vocab) {
        expect(v.fr, `${u.id}: ${JSON.stringify(v)}`).toBeTruthy();
        expect(v.en, `${u.id}: ${v.fr}`).toBeTruthy();
        expect(v.es, `${u.id}: ${v.fr}`).toBeTruthy();
        expect(v.hint, `${u.id}: ${v.fr}`).toBeTruthy();
      }
    }
  });

  it('dialogue lines alternate speakers sensibly and give the learner lines', () => {
    for (const u of FRENCH.units) {
      const you = u.dialogue.lines.filter((l: any) => l.who === 'you');
      expect(you.length, u.id).toBeGreaterThanOrEqual(3);
      for (const l of u.dialogue.lines) {
        expect(['you', 'them']).toContain(l.who);
        expect(l.fr, u.id).toBeTruthy();
        expect(l.en, u.id).toBeTruthy();
      }
    }
  });

  it('reference data is present', () => {
    expect(FRENCH.cognateRules.length).toBeGreaterThanOrEqual(12);
    expect(FRENCH.fauxAmis.length).toBeGreaterThanOrEqual(15);
    expect(FRENCH.phonics.length).toBeGreaterThanOrEqual(4);
  });

  it('the deck is big enough to matter but small enough to finish', () => {
    const total = FRENCH.units.reduce((n: number, u: any) => n + u.vocab.length, 0);
    expect(total).toBeGreaterThanOrEqual(300);
    expect(total).toBeLessThanOrEqual(450);
  });
});
