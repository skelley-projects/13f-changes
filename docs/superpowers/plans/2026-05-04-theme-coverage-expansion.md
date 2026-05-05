# Theme coverage expansion notes

Date: 2026-05-04

## Goal

Expand theme-level and granular-level analysis beyond the first Situational Awareness AI basket without making the tags feel like a thin duplicate of GICS sectors.

## Options tested

### 1. Sector-derived themes

Use sector and industry labels directly as themes.

Result: very high coverage, but weak insight. The output mostly repeats the existing sector-shift panel, so it does not justify a separate editorial layer.

### 2. Single global taxonomy

Use one master taxonomy across every fund.

Result: attractive long-term, but too blunt right now. Situational Awareness wants AI bottleneck language; Duquesne wants broader portfolio lenses like Health care, Consumer platforms, Market beta & EM, and Industrial & real assets. A single taxonomy would either be too generic or too crowded.

### 3. Fund-specific editorial lenses

Keep tags per fund, but enforce a discipline:

- Broad themes should describe the fund's apparent portfolio lenses.
- Granular tags should be mostly non-overlapping business buckets.
- Do not force small or ambiguous names into a theme just to hit 100% coverage.
- Use an audit script before each deploy to expose the largest untagged or top-level-only positions.

Result: best balance. It produces readable shift bars and table labels while keeping the taxonomy honest.

## Implemented pass

### Situational Awareness

Added granular buckets under the existing AI taxonomy:

- Fuel cells
- Power equipment
- Oilfield power services
- Accelerated cloud
- AI datacenter hosting
- Bitcoin / HPC miners
- Storage media
- Platform silicon
- AI networking silicon
- Specialty foundry

Coverage after pass:

- Theme coverage: 98.9% of current AUM
- Granular coverage: 98.9% of current AUM
- Largest intentionally untagged names: KRC and INFY

Top granular shifts after pass:

- Fuel cells +15.2pp
- Photonics +8.2pp
- GPU / accelerator -7.2pp
- Nuclear power -6.1pp
- Accelerated cloud -3.9pp
- Storage media +3.5pp

### Duquesne

Seeded a new fund-specific taxonomy:

- Health care
- Consumer platforms
- Financials & credit
- Semis & AI hardware
- Industrial & real assets
- Market beta & EM

Each has granular buckets for the fund's current/prior holdings, such as Diagnostics & research, Therapeutics biotech, E-commerce marketplaces, Financial ETFs, AI foundry, Power & electrification, and EM / country ETFs.

Coverage after pass:

- Theme coverage: 100.0% of current AUM
- Granular coverage: 100.0% of current AUM

Top granular shifts after pass:

- Financial ETFs +6.0pp
- Broad-market ETFs +4.8pp
- Pharma / generics -4.2pp
- Digital media & apps -4.0pp
- EM / country ETFs +3.7pp
- Therapeutics biotech -3.1pp

## New workflow

Run:

```bash
npm run tag-audit
```

This prints, for each active fund:

- Theme coverage
- Granular coverage
- Top theme shifts
- Top granular shifts
- Largest untagged current positions
- Largest positions that have only a top-level theme but no granular tag

The audit is now the guardrail for future expansion. If a new quarter introduces a large untagged position, it will be obvious before deploy.

## Hypothesis

The theme layer should become less about "what sector is this?" and more about "what portfolio argument does this name belong to?" The granular layer should then answer, "which specific expression of that argument changed?"

For SA, that means AI bottlenecks. For Duquesne, it means broader portfolio construction lenses. For future funds, the same method should work, but the taxonomy should be seeded from the fund's actual holdings rather than imported wholesale.
