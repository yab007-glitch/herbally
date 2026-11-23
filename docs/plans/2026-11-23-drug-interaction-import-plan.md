# HerbAlly Drug-Interaction Coverage Plan (2026-11-23)

## Current Coverage & Policy Constraint

- **Published herbs:** `3,124`
- **Herbs with curated `drug_interactions` rows:** `158` (`513` interaction rows total across all sources)
- **Herbs with zero curated `drug_interactions`:** `2,966` (`94.9%`)
- **Non-negotiable rule:** Never generate or infer herb-drug interaction pairs without a verified primary/regulatory source in the database or a cited clinical reference. All `2,579` legacy rows in `herb_monographs` (`status = archived`, `generation_method = ai-assisted`) are **excluded** from automated import unless every claim is re-verified against a primary source.

---

## Existing Verified / Structured Sources in Postgres

| Table / Source                                                                                         |                                                    Records |                                                        Coverage Among 2,966 Uncovered Herbs | Notes for Interaction Import                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------: | ------------------------------------------------------------------------------------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `herb_monograph_sources` (`Health Canada`, `EMA HMPC`, `LiverTox`, `NCCIH`, historical dispensatories) |                             `834` rows across `447`+ slugs |                                                                                 `339` herbs | Highest-priority structured regulator/NIH excerpts (`Health Canada`: 133, `EMA HMPC`: 85, `LiverTox`: 82, `NCCIH`: 53). Contains `safety` JSON arrays and source URLs.                 |
| `herb_regulatory_evidence` (`Health Canada LNHPD`)                                                     |                       `1,182` herbs (`1,173` with `risks`) |                                                                               `1,011` herbs | Official Licensed Natural Health Products Database `risks` statements (cautions/contraindications/drug classes) with `source_urls`.                                                    |
| `herb_pubmed_monographs` (compiled sheets)                                                             | `3,082` published herbs (`3,046` with `article_count > 0`) | `284` herbs with non-placeholder `drugInteractions` text (`2,905` with `article_count > 0`) | Contains `citedPmids` and `drugInteractions` narrative; requires verifying each extracted drug pair directly against the cited PMID abstracts before promoting to `drug_interactions`. |
| `drug_interactions` (existing curated table)                                                           |                              `513` rows across `158` herbs |                                                                                           — | Primary existing sources: `NCCIH` (138), `Health Canada` (93), `LiverTox` / `NIH LiverTox` (47), `MSK About Herbs` (19+), `EMA HMPC` (18+), `PubMed` (14+).                            |

---

## Traffic-Prioritized Import Waves

### Wave 1 — High-Traffic Herbs with Regulator / Monograph Sources Already in DB (Top 30 by `view_count`)

These uncovered herbs already have Health Canada, EMA HMPC, LiverTox, NCCIH, or LNHPD records in Postgres and attract the highest organic traffic:

| Views | Slug                         | Name                       | Evidence | Monograph Sources                 | Reg Source (Risks)      | PubMed IX Text |
| ----: | ---------------------------- | -------------------------- | -------- | --------------------------------- | ----------------------- | -------------: |
|   799 | `acacia-nilotica`            | Acacia nilotica            | trad     | —                                 | Health Canada LNHPD (6) |             No |
|   770 | `acacia`                     | Acacia                     | trad     | —                                 | Health Canada LNHPD (7) |             No |
|   472 | `acapulco`                   | Acapulco                   | B        | —                                 | Health Canada LNHPD (7) |             No |
|   442 | `tamanu`                     | Tamanu                     | C        | —                                 | Health Canada LNHPD (1) |             No |
|   440 | `abelmoschus-moschatus-herb` | Abelmoschus Moschatus Herb | C        | —                                 | Health Canada LNHPD (4) |             No |
|   416 | `abies-alba`                 | Abies alba                 | trad     | —                                 | Health Canada LNHPD (5) |             No |
|   410 | `abrus-precatorius`          | Abrus precatorius          | C        | King's American Dispensatory 1898 | Health Canada LNHPD (1) |             No |
|   405 | `piscidia-piscipula`         | Piscidia piscipula         | C        | —                                 | Health Canada LNHPD (1) |             No |
|   396 | `abutilon-indicum`           | Abutilon indicum           | C        | —                                 | Health Canada LNHPD (6) |             No |
|   378 | `acacia-catechu`             | Acacia catechu             | trad     | —                                 | Health Canada LNHPD (6) |             No |
|   372 | `amla-dried`                 | Amla Dried                 | trad     | —                                 | Health Canada LNHPD (4) |             No |
|   368 | `evodia-rutaecarpa`          | Evodia Rutaecarpa          | C        | —                                 | Health Canada LNHPD (2) |            Yes |
|   359 | `acer-saccharum-herb`        | Acer Saccharum Herb        | trad     | —                                 | Health Canada LNHPD (2) |             No |
|   357 | `agave-plant`                | Agave Plant                | C        | —                                 | Health Canada LNHPD (2) |             No |
|   356 | `mentha-longifolia`          | Mentha longifolia          | trad     | —                                 | Health Canada LNHPD (8) |             No |
|   355 | `chaga`                      | Chaga                      | trad     | —                                 | Health Canada LNHPD (6) |             No |
|   350 | `ginger-wild`                | Ginger Wild                | B        | —                                 | Health Canada LNHPD (3) |             No |
|   350 | `cardamom-seeds`             | Cardamom Seeds             | trad     | —                                 | Health Canada LNHPD (8) |             No |
|   349 | `meadowsweet`                | Meadowsweet                | B        | European Medicines Agency (HMPC)  | Health Canada LNHPD (9) |             No |
|   347 | `albizia`                    | Albizia                    | C        | —                                 | Health Canada LNHPD (3) |             No |
|   343 | `picao-preto`                | Picao Preto                | trad     | —                                 | Health Canada LNHPD (5) |             No |
|   342 | `astragalus-complanatus`     | Astragalus Complanatus     | B        | —                                 | Health Canada LNHPD (4) |             No |
|   342 | `hawthorn-berry-chinese`     | Hawthorn Berry Chinese     | trad     | —                                 | Health Canada LNHPD (3) |             No |
|   341 | `valeriana-jatamansi`        | Valeriana jatamansi        | B        | —                                 | Health Canada LNHPD (6) |             No |
|   341 | `aucklandia-lappa`           | Aucklandia lappa           | C        | —                                 | Health Canada LNHPD (5) |             No |
|   339 | `pine-pollen`                | Pine Pollen                | trad     | —                                 | Health Canada LNHPD (8) |             No |
|   338 | `lavandula-latifolia`        | Lavandula latifolia        | C        | —                                 | Health Canada LNHPD (4) |             No |
|   338 | `bai-he`                     | Bai He                     | C        | —                                 | Health Canada LNHPD (6) |             No |
|   337 | `scoparia-dulcis`            | Scoparia Dulcis            | trad     | —                                 | Health Canada LNHPD (2) |             No |
|   336 | `nettle-leaf`                | Nettle Leaf                | B        | Fernie's Herbal Simples 1897      | —                       |             No |

### Wave 2 — Highest-Traffic Herbs Overall Without Interactions (Top 25 by `view_count`)

Where Wave 2 herbs lack `herb_monograph_sources` (e.g., `cay-xao-tam-phan` with `1,638` views), prioritize manual/PubMed-verified clinical literature lookup or explicitly state "no documented interactions in reviewed sources" only after PMID review:

| Views | Slug                         | Name                       | Evidence | Monograph Sources                 | Reg Source          | PubMed Articles | PubMed IX Text |
| ----: | ---------------------------- | -------------------------- | -------- | --------------------------------- | ------------------- | --------------: | -------------: |
|  1638 | `cay-xao-tam-phan`           | Cay Xao Tam Phan           | C        | —                                 | —                   |              22 |             No |
|   799 | `acacia-nilotica`            | Acacia nilotica            | trad     | —                                 | Health Canada LNHPD |              30 |             No |
|   770 | `acacia`                     | Acacia                     | trad     | —                                 | Health Canada LNHPD |              30 |             No |
|   472 | `acapulco`                   | Acapulco                   | B        | —                                 | Health Canada LNHPD |              20 |             No |
|   442 | `tamanu`                     | Tamanu                     | C        | —                                 | Health Canada LNHPD |              29 |             No |
|   440 | `abelmoschus-moschatus-herb` | Abelmoschus Moschatus Herb | C        | —                                 | Health Canada LNHPD |              18 |             No |
|   416 | `abies-alba`                 | Abies alba                 | trad     | —                                 | Health Canada LNHPD |              17 |             No |
|   415 | `acacia-confusa`             | Acacia confusa             | C        | —                                 | —                   |              13 |             No |
|   410 | `abrus-precatorius`          | Abrus precatorius          | C        | King's American Dispensatory 1898 | Health Canada LNHPD |              27 |             No |
|   405 | `piscidia-piscipula`         | Piscidia piscipula         | C        | —                                 | Health Canada LNHPD |              12 |             No |
|   397 | `acanthopanax-sessiliflorus` | Acanthopanax Sessiliflorus | trad     | —                                 | —                   |              30 |             No |
|   396 | `achillea-biebersteinii`     | Achillea biebersteinii     | C        | —                                 | —                   |              25 |             No |
|   396 | `abutilon-indicum`           | Abutilon indicum           | C        | —                                 | Health Canada LNHPD |              14 |             No |
|   392 | `acanthopanax-gracilistylus` | Acanthopanax gracilistylus | C        | —                                 | —                   |              27 |             No |
|   378 | `acacia-catechu`             | Acacia catechu             | trad     | —                                 | Health Canada LNHPD |              11 |             No |
|   374 | `opopanax-chironium`         | Opopanax chironium         | C        | —                                 | —                   |               5 |             No |
|   374 | `ximenia-caffra`             | Ximenia Caffra             | C        | —                                 | —                   |              22 |             No |
|   372 | `amla-dried`                 | Amla Dried                 | trad     | —                                 | Health Canada LNHPD |              18 |             No |
|   368 | `evodia-rutaecarpa`          | Evodia Rutaecarpa          | C        | —                                 | Health Canada LNHPD |              30 |            Yes |
|   367 | `acacia-obtusifolia`         | Acacia obtusifolia         | C        | —                                 | —                   |               1 |             No |
|   366 | `acinos-arvensis`            | Acinos arvensis            | C        | —                                 | —                   |               0 |             No |
|   365 | `achillea-ligustica`         | Achillea ligustica         | trad     | —                                 | —                   |              14 |             No |
|   365 | `japanese-myoga-ginger`      | Japanese Myoga Ginger      | B        | —                                 | —                   |              30 |             No |
|   362 | `salvia-nemorosa`            | Salvia nemorosa            | C        | —                                 | —                   |               8 |             No |
|   360 | `piper-sarmentosum`          | Piper sarmentosum          | trad     | —                                 | —                   |              23 |             No |

### Wave 3 — Remaining `herb_monograph_sources` & `Health Canada LNHPD` Long Tail (`~1,100` herbs)

Batch-extract class-level and drug-level interactions from the remaining `herb_monograph_sources` (`339` minus Wave 1) and `herb_regulatory_evidence` (`1,011` minus Wave 1) rows, skipping any entry whose regulator text lists only non-drug cautions (e.g., pregnancy/allergy).

---

## What a Sourced Import Pipeline Requires

1. **Source & Citation Gate (Mandatory):** Every inserted `drug_interactions` row must populate `source` (e.g., `Health Canada`, `EMA HMPC`, `NCCIH`, `LiverTox`, `PubMed`), `source_url` (official monograph URL or `https://pubmed.ncbi.nlm.nih.gov/<pmid>/`), and `evidence_note` quoting or summarizing the exact source statement. Reject any candidate without a verifiable URL/PMID.
2. **Drug Entity & RxNorm Normalization:** Map extracted drug or drug-class names (`drug_name`) to canonical RxNorm identifiers (`rxcui`) via the existing RxNorm normalization helpers so `/medications/[drug]` reverse-lookup pages and interaction checks resolve cleanly without duplicate synonyms (e.g., `Warfarin` vs `warfarin sodium`).
3. **Conservative Severity Rubric:** Map source wording to `interaction_severity` (`contraindicated` | `severe` | `moderate` | `mild`) using explicit deterministic rules (only `contraindicated` when a regulator explicitly contraindicates co-administration; default theoretical/precautionary statements to `mild` or `moderate`).
4. **Mechanism & Evidence Level:** Populate `mechanism` (CYP450, P-gp, pharmacodynamic additive bleeding/hypoglycemia/sedation, etc.) and `evidence_level` only when explicitly stated in the source; leave `NULL` rather than guessing.
5. **Bilingual French Translation (`translations.fr`):** Translate `description` and `mechanism` into Canadian French via `OLLAMA_CLOUD_MODEL` (preserving `drug_name` and clinical terms), validating against empty/English leakage before DB insert.
6. **Idempotent Upsert + Cache Refresh:** Deduplicate on `(herb_id, lower(drug_name))`, wrap imports in transactions, run `refresh_herb_page_bundles(500)` to sync `herb_page_bundles`, and purge affected slugs via `/api/revalidate-herb` (plus `/medications/[drug]` paths).
7. **Human Clinical Spot-Check:** Require manual sign-off on all `contraindicated` / `severe` additions and a random 10% sample of `moderate`/`mild` rows before marking `herb` provenance/review notes.
