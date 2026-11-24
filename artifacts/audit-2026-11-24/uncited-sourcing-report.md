# Uncited herbs — real sourcing attempt, 2026-11-24

**Question:** can the 30 published herbs with zero citations be sourced from PubMed?

**Answer: 1 of 30. The other 29 have no relevant indexed literature.**

## Method

- Pulled the 30 published herbs with `jsonb_array_length(citations) = 0` (highest traffic first).
- For each: PubMed E-utilities `esearch` with the full binomial as a `[Title/Abstract]` phrase,
  plus genus and common-name fallbacks; `esummary` for title/year/journal.
- 1 request/second, `tool=herbally` and a contact email, as NCBI asks.
- 106 raw candidates collected (`uncited-pubmed-candidates-raw.csv`).

## Validation (this is where most candidates died)

A candidate was accepted only if:

1. the **species epithet** appears in the title (genus alone is not enough — `Berkheya zeyheri`
   is not `Berkheya purpurea`), and
2. the title is not an erratum, correction, retraction, genome announcement, first-report
   virology note, taxonomy/phylogeny paper, or "new species" description.

Genus-only matching produced **junk**, and it is worth recording what it looked like:

- `berkheya-purpurea` → "Chemical analysis in *Berkheya zeyheri*: a South African nickel
  hyperaccumulator" — different species, not medicinal.
- `blephilia-ciliata` → "First Report of Cucumber mosaic virus Infecting *Blephilia hirsuta*" —
  different species, plant pathology.
- `gui-pi-tang-patent` → "Protect and restore small wetlands" — the formula name contains the
  word "restore", and a naive name match hit an ecology paper.
- `prodigiosa-mex` → "Correction to α-Glucosidase Inhibitors from *Brickellia cavanillesii*" —
  an erratum, not a study.
- `escallonia-resinosa` → two genome assemblies, relevant to botany, useless as a clinical
  source.

Any pipeline that matches on genus alone, or on words inside a product/formula name, will fill
these pages with irrelevant references. That is worse than an empty citation list.

## Result

| Outcome | Herbs |
| --- | ---: |
| Found a species-matched, non-junk paper | **1** |
| No relevant indexed literature | **29** |

The one: `black-cumin-anatolian` → PMID **39807848**, "A Comprehensive Review of the
Antioxidant, Antimicrobial, and Therapeutic Efficacies of *Nigella sativa*" (2025).

Per-herb verdicts: `uncited-sourcing-verdicts.csv`.

## What the 29 actually are

Reading the list explains the result. They are largely **ornamental or botanical-garden species
with no medicinal literature** — `Haworthia attenuata`, `Astelia nervosa`, `Plagianthus regius`,
`Hebe stricta`, `Nothoscordum bivalve`, `Veltheimia bracteata`, `Puschkinia scilloides`,
`Meconopsis regia`, `Leucadendron argenteum`, `Olearia traversii`, `Escallonia resinosa` — plus
`Trichostema` and `Stachydeoma` (North American mints with little clinical work) and one patent
formula (`gui-pi-tang`).

They were not "missing sources". They are **not medicinal herbs**, and no amount of searching
will give them a clinical citation.

## Implication

Sourcing cannot fix this tail. The options, all needing an owner decision because they change
policy or remove pages:

1. **Honest state** — mark the row `no_indexed_source`, render one sober line ("no indexed
   clinical literature was found for this species"), keep the page. Cheapest, no policy change.
2. **Consolidate** — merge ornamental species into a single "ornamental and non-medicinal
   plants" page with a redirect, removing 29 thin URLs from the index.
3. **Retire** — unpublish the non-medicinal entries. Largest effect on the thin-page ratio,
   largest policy change, and it conflicts with the current index-all decision.

Recommendation: option 1 now, option 2 for the clearly ornamental group if the AdSense verdict
does not improve. Do not attach the junk candidates.

## Note for the in-flight sourcing work

The broader pass targets the 1,714 herbs with one or two citations, where real papers do exist.
This file exists so that pass does not repeat the mistake above: **species-level match, no
errata, no genome/virology/taxonomy papers, no matching on words inside a formula name.**
