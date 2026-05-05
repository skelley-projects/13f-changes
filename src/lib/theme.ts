import type { TaxonomyEntry } from '../../scripts/types';

export function themeSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function themeHref(label: string): string {
  return `/themes/${themeSlug(label)}`;
}

export function themeLabelsFor(tagIds: string[], taxonomy: TaxonomyEntry[], granularOnly = false): string[] {
  const byId = new Map(taxonomy.map(t => [t.id, t]));
  const labels = new Set<string>();

  for (const id of tagIds) {
    const entry = byId.get(id);
    if (!entry) continue;
    if (granularOnly) {
      if (entry.parent !== undefined) labels.add(entry.label);
      continue;
    }
    const broadId = entry.parent ?? entry.id;
    const broadEntry = byId.get(broadId);
    if (broadEntry) labels.add(broadEntry.label);
  }

  return Array.from(labels);
}
