# Task brief — source integrity for every herb (2026-11-24)

Repo `/Users/yasser/herbally`; production `https://herbally.app`.
Standing rules apply: **zero new spend, no invented facts, no deleting content to clear a metric.**

## The goal, stated honestly

Every published herb page must either

1. display **at least one valid source**, or
2. display an explicit, honest state saying no indexed clinical source was found for it.

What must **never** happen: a citation attached that does not actually concern the plant, a dead
link counted as a source, or a fabricated reference. A page with no literature is an acceptable
outcome if it says so. A page with a fake source is a failure.

## What counts as a valid source

Tier 1 — regulator / pharmacopoeia (strongest):

- Health Canada LNHPD / NHPID (already in the DB),
- EMA HMPC monographs (link and cite; do not copy text),
- WHO monographs, ESCOP (cite and link only).

Tier 2 — peer-reviewed literature, indexed in PubMed or PMC:

- systematic reviews, meta-analyses, RCTs, observational studies,
- safety/toxicity papers (adverse effects, case reports, pharmacovigilance).

Tier 3 — government / public-health references:

- NCCIH, LiverTox, MedlinePlus, NIH ODS.

**Not acceptable:** Wikipedia, commercial supplement sites, blogs, news articles, AI output,
retracted papers, errata as standalone citations, or any URL that does not resolve.

A Tier 2 citation is valid only when the **taxon (genus, and species where possible) appears in
the title or abstract**, or the abstract unambiguously names the plant by its common name and the
record is about that species. Otherwise reject it and log why.

## Work, in order

### 1. Audit every existing citation (all 3,124 herbs)

Build `scripts/audit-herb-sources.ts`:

- resolve every citation URL (GET/HEAD; follow redirects; record final status),
- for PubMed/PMC, fetch the record and compare the stored `title` and `year` with the live one,
- check retraction status (PubMed `PublicationType: Retraction of Publication`, or the record's
  comment/correction fields),
- test taxon relevance against the herb's `scientific_name` and known synonyms.

Output `artifacts/audit-2026-11-24/citation-audit.csv` with one row per citation:
`slug, pmid, url, http_status, title_matches, taxon_match, retracted, verdict`.
Verdicts: `valid`, `dead`, `mismatch`, `irrelevant`, `retracted`.

**Repair policy**

- `dead` → try the DOI/PMC alternative; if none, remove and log the old value.
- `mismatch` → correct the metadata from the live record; keep only if the taxon still matches.
- `irrelevant` / `retracted` → remove and log. Do not replace with a guess.
- Never leave a herb with zero sources because a bad one was removed — the next step fills it, or
  it gets the honest state.

### 2. Fill every herb with fewer than one valid source

Use only free indexes: PubMed E-utilities (≤3 req/s, 1/s in practice, with `tool` and contact
email), Europe PMC REST, and the regulator data already in the database.

- Search by Latin binomial and synonyms, then by common name.
- Prefer Tier 1, then Tier 2 safety papers, then efficacy.
- Attach at most 3 per herb; dedupe by PMID across the catalogue.
- Validate with the same taxon rule before writing.

### 3. Honest state for the genuinely unsourceable

If an exhaustive search returns nothing valid, set a provenance flag on the row, e.g.
`provenance.source_status = "no_indexed_source"`, with the search strings tried and the date.
Surface it on the page in both locales — a short, sober line stating no indexed clinical
literature was found, without implying the herb is unsafe or ineffective.

Do **not** noindex these pages (that contradicts the current policy) and do **not** merge or
delete them. Report the count and the list.

### 4. Prove it

- Re-run the audit and show: herbs with ≥1 valid source before → after, citations removed by
  verdict, herbs in the honest state.
- **Manually read 30 random final citations** and confirm each is about that plant; publish the
  30 with herb, title, PMID.
- Confirm 10 pages render their sources, and the honest-state line renders in EN and FR.
- Confirm no `MISSING_MESSAGE`, no layout break, and that `evidence_level` was not changed.

## Guardrails

- Back up the DB before any write; keep the pre-write dump path in the report.
- Do not change the review line, robots policy, ads or consent.
- Do not touch descriptions, doses or safety prose. Sources only.
- Revalidate affected bundles via `/api/revalidate-herb` in batches after the write.
- `tsc`, full tests, `eslint`, `prettier --check` before each commit; small commits; push; verify
  live after deploy.

## Deliverables

- The audit and sourcing scripts, committed.
- `artifacts/audit-2026-11-24/source-integrity-report.md`: audit table summary, repair counts,
  before/after coverage, the 30 manual spot-checks, the unsourceable list with search strings.
- A dated Team Memory note plus one INDEX line.
- One paragraph: how many pages now carry a real source, how many honestly carry none, and what
  that means for the AdSense "low-value" verdict.
