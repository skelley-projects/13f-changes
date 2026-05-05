import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { segmentPrimers } from '../src/lib/segment-primers';
import { themeSlug } from '../src/lib/theme';
import type { TagsFile } from '../scripts/types';

function readTags(slug: string): TagsFile {
  return JSON.parse(readFileSync(join('data', 'funds', slug, 'tags.json'), 'utf8')) as TagsFile;
}

describe('segment primers', () => {
  it('covers every granular taxonomy segment', () => {
    const missing: string[] = [];

    for (const fund of ['situational-awareness', 'duquesne']) {
      const tags = readTags(fund);
      for (const entry of tags.taxonomy.filter(tag => tag.parent !== undefined)) {
        const slug = themeSlug(entry.label);
        if (!segmentPrimers[slug]) missing.push(`${fund}: ${entry.label} (${slug})`);
      }
    }

    expect(missing).toEqual([]);
  });

  it('includes usable overview and major-name metadata', () => {
    for (const [slug, primer] of Object.entries(segmentPrimers)) {
      expect(primer.summary.length, `${slug} summary`).toBeGreaterThan(80);
      expect(primer.overview.length, `${slug} overview`).toBeGreaterThanOrEqual(2);
      expect(primer.marketMap.length, `${slug} market map`).toBeGreaterThanOrEqual(4);
      expect(primer.watchItems.length, `${slug} watch items`).toBeGreaterThanOrEqual(4);
      expect(primer.majorPlayers.length, `${slug} major players`).toBeGreaterThanOrEqual(4);
    }
  });
});
