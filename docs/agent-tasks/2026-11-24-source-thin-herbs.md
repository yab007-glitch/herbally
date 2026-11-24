# Task brief — source the thin herb pages (AdSense) (2026-11-24)

Repo `/Users/yasser/herbally`; production `https://herbally.app`; DB access as in the earlier
briefs. Standing rules from `docs/agent-tasks/2026-11-24-zero-cost-upgrade-rounds.md` apply:
**zero new spend, no invented facts, no deleting content to clear a metric.**

## Why

AdSense still reports low-value content. Current coverage across 3,124 published herbs:

- **30 pages with no citations at all**
- **1,714 pages with only 1–2 citations**
- 1,380 with 3 or more
- 263 pages with no `side_effects`, 86 with no `contraindications`
- 2,966 pages with no curated drug interactions

A page with one PMID and a two-line description is thin by any definition. The fix is to attach
**real, verifiable sources that already exist**, not to write new medical prose.

## What "source" means here

A citation is the existing JSON shape on `herbs.citations`:

```json
{"url":"https://pubmed.ncbi.nlm.nih.gov/PMID/","pmid":"PMID","year":2024,
 "title":"exact article title","source":"PubMed"}
```

Nothing else changes: no new descriptions, no new doses, no new safety claims. If a page has no
safety text and no source supports one, it stays empty and is reported.

## Free sources only (no key, no payment)

Use these in this order. Respect their terms and rate limits.

1. **PubMed E-utilities** (`eutils.ncbi.nlm.nih.gov`) — esearch + esummary/efetch. No API key:
   stay at **≤ 3 requests/second** (use 1/s), always send `tool` and a contact `email`.
2. **Europe PMC REST** (`www.ebi.ac.uk/europepmc/webservices/rest`) — free, no key; useful for
   abstracts and for records PubMed indexes late.
3. **NCBI Bookshelf / LiverTox / NCCIH** — US government works, free to cite and link. Link only.
4. **Health Canada LNHPD open data** — already in the database; use what is there.
5. **EMA HMPC monographs** — cite and link only; do **not** copy text into the page.

Do not scrape paywalled publishers, do not use Sci-Hub, do not use Wikipedia as a medical
source, do not call any API that needs a paid key.

## Method

1. Build `scripts/source-thin-herbs.ts` (or extend the existing PubMed tooling — reuse before
   writing new).
2. For each target herb, search by **Latin binomial** (and known synonyms from
   `scientific_name`/provenance) in `[Title/Abstract]`, plus the common name as a secondary
   query. Cache every response to disk so reruns cost nothing.
3. **Validate before attaching.** A hit is only accepted when:
   - the taxon (genus at minimum, species preferred) appears in the title or abstract,
   - it is not a retraction or an erratum,
   - the PMID is not already on the row.
   Anything that fails validation is logged, never attached.
4. Attach up to **3 new citations** per herb, preferring: clinical trials and systematic reviews
   → observational studies → mechanistic/phytochemistry last. Keep safety-relevant papers even
   when they are not efficacy papers.
5. Run a second, safety-specific query per herb: `taxon AND (adverse effects OR safety OR
   toxicity OR contraindications OR pregnancy)`. Attach the resulting citations only; do not
   convert them into prose.
6. Deduplicate by PMID across the whole catalogue so one paper does not become the only citation
   on 200 pages (unless it genuinely covers them).
7. Revalidate each herb bundle through `/api/revalidate-herb` in batches after the write.

## Verification (do not skip)

- HEAD or GET every new citation URL; require HTTP 200 and a PubMed/EuropePMC id that matches.
- **Manual spot-check 20 random new citations**: read the title and confirm it is about that
  plant. Report the 20 with the herb and the title.
- Re-run the coverage counts and show before → after.
- Confirm the page renders the new citations and that no `MISSING_MESSAGE` or layout break
  appears on a sample of 10 updated pages.

## Report the residue, do not paper over it

Some herbs will still have zero hits after an exhaustive search — obscure taxa, synonyms not
indexed, non-medicinal plants. Produce `artifacts/audit-2026-11-24/unsourceable-herbs.csv` with
slug, scientific name, search strings tried, and hit count.

For that list, **propose** (do not execute) options in the report:

- merge into a parent herb page with a redirect,
- keep the page but mark it clearly as "no indexed clinical literature",
- consolidate several near-duplicate entries,
- noindex — note that this contradicts the current index-all policy and needs the owner.

## Zero-cost and safety guards

- No paid API, key, proxy or data purchase.
- No LLM-generated medical statements; only metadata from real records.
- Do not change `evidence_level` — grading needs human judgement.
- Do not touch the review line, robots policy, ads or consent.
- Back up the DB before writing. Commit in small units; `tsc`, full tests, `eslint`,
  `prettier --check` before each commit; push and verify live after deploy.

## Deliverables

- The sourcing script, committed.
- `artifacts/audit-2026-11-24/sourcing-report.md` with: targets, queries, accepted/rejected
  counts, before/after coverage, the 20 spot-checks, and the unsourceable list.
- A dated Team Memory note plus one INDEX line.
- A one-paragraph recommendation on whether citations alone can move AdSense, or whether the
  thin tail needs consolidation.
