# Content-depth audit — 2026-11-03

What the catalogue actually contains, measured against the production database, and
what the commercially-usable source landscape can and cannot support.

Reproduce the catalogue numbers with `node scripts/audit-content-depth.mjs`
(`--json`, `--csv out.csv`). The source-coverage numbers below came from fetching
the two publishers' own index pages on 2026-11-03 and matching them against the
`herbs` table by name, scientific name and common names.

## The catalogue

| Measure                            | Value               |
| ---------------------------------- | ------------------- |
| Published herbs                    | **2,699**           |
| Description length, median         | **17 words**        |
| Description length, mean / p90/max | 32 / 51 / 215 words |
| ≤ 20 words                         | **1,890 (70.0%)**   |
| ≤ 30 words                         | **2,368 (87.7%)**   |
| No citations at all                | **998 (37.0%)**     |
| No `provenance.sources` entry      | **2,188 (81.1%)**   |
| Adult dosage present               | 2,699 (100%)        |
| Botanical photograph               | 0                   |
| PubChem CID                        | 0                   |

The dosage column being 100% populated while 81% of rows have no provenance is the
shape of the problem: every row has a claim, most rows have no evidence attached
to it. A 17-word description with a dosage range and four contraindications is a
medical claim with nothing behind it.

## What the trusted, commercially-usable sources can cover

The licence policy in [`data-source-licences.md`](./data-source-licences.md) is
the filter here: a source has to permit **commercial** reuse and redistribution,
because the site carries advertising.

| Source                                 | Licence                  | Herbs matched in HerbAlly |
| -------------------------------------- | ------------------------ | ------------------------- |
| NCCIH "Herbs at a Glance"              | US federal public domain | 52                        |
| NIH ODS dietary supplement fact sheets | US federal public domain | 31                        |
| **Union**                              |                          | **69 of 2,699 (2.6%)**    |

Two sources that belong in this table are missing for mechanical reasons, not
licensing ones:

- **EMA EU herbal monographs** are accepted and cited by policy, but
  `ema.europa.eu` served a bot-verification wall to every scripted request during
  this audit, and the old catalogue URLs (`/en/medicines/herbal`) now 404 after
  their site reorganisation. The monographs are usable by a human or a browser
  session; they are simply not enumerable from a script today. Expect up to
  roughly 150 further matches once they are walked by hand.
- **LiverTox** (public domain, NCBI Bookshelf) covers herbal hepatotoxicity and
  would add a narrower but high-value slice — safety, not uses.

Everything else that looks like an answer is blocked by licence:

| Source                 | Why it cannot be used                                                                |
| ---------------------- | ------------------------------------------------------------------------------------ |
| Natural Medicines      | Commercial; terms forbid derived databases                                           |
| MedlinePlus herb pages | Licensed from Natural Medicines — same block                                         |
| DDInter, ClarisHerba   | Non-commercial / share-alike clauses                                                 |
| WHO monographs         | CC BY-NC-SA — non-commercial                                                         |
| DrugBank               | Academic-only free tier, no redistribution                                           |
| Plants For A Future    | No redistribution right for commercial reuse                                         |
| Wikipedia              | CC BY-SA: usable, but ShareAlike would force our adapted text under the same licence |

**The honest conclusion: there is no open herb library that covers 2,699 species.**
The best legally-reusable coverage in existence is on the order of 200–250
species — under 10% of the catalogue — and it is concentrated on exactly the
popular herbs that already have the longest descriptions. Coverage of the
long tail (median description 17 words) is _zero_, and no amount of searching
changes that: those species have no authoritative monograph to copy from, in any
licence.

## The interaction table has a licence problem

`drug_interactions` holds 174 pairs. By source:

| Source value               | Rows | Status under our own policy                        |
| -------------------------- | ---- | -------------------------------------------------- |
| Natural Medicines Database | 95   | **Rejected source.** Register says: never cite it. |
| Clinical Studies           | 72   | Vague label, `source_url` null on every row        |
| WHO Monographs             | 7    | CC BY-NC-SA — blocked for commercial use           |

The register calls these "legacy rows [that] predate the policy and are not a
precedent", so they are not a policy breach by themselves — but they are now 55%
of the interaction dataset, they are rendered on public pages, and the repo that
says "never cite Natural Medicines Database" is public. Either those rows get
re-sourced from EMA/NCCIH/LiverTox/PubMed, or the source label changes to
something that is true. Leaving it is the one option that is both a licensing
risk and a credibility risk.

## Options

**A. Depth where depth is possible.** Enrich the ~69–250 herbs that have a
licensing-clean source, using the publishers' own words with attribution and a
link. Leave the rest thin but honest. Cheapest, no legal risk, but it does not
move the 2,400 thin pages that make up 89% of the catalogue — and those are the
pages Google currently sees as near-duplicate filler.

**B. Cut the tail.** Noindex (or unpublish) the pages that cannot be sourced.
Fewer pages, much higher average quality; the crawl budget concentrates on pages
that can rank. Cost: gives up the long-tail surface area, and it is a decision
about the product, not a technical fix — the brief's "open decisions" list.

**C. Both, staged.** Enrich the sourced subset first, measure whether those
pages earn impressions in Search Console, and only then decide the tail on
evidence rather than on hope.

## What is not negotiable in any of them

No generated herb text may state a use, dose, side effect, contraindication or
interaction that the cited source does not state. Where a source is silent, the
page says so. A 17-word description is bad; an invented 200-word description is
worse — it is the failure mode the founder memo already named as the site's
biggest risk.
