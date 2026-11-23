# HerbAlly Contradiction Fixes Report (2026-11-23)

- **Input scan:** [`artifacts/audit-2026-11-23/contradictions.csv`](../../artifacts/audit-2026-11-23/contradictions.csv) (3,124 published herbs, 22 boolean rules)
- **After scan:** [`artifacts/audit-2026-11-23/contradictions-after.csv`](../../artifacts/audit-2026-11-23/contradictions-after.csv) (re-run via [`docs/agent-tasks/contradictions.sql`](../agent-tasks/contradictions.sql))
- **Pre-write DB backup:** `/home/yasser/herbally-backups/contradictions-20261123.dump` (39M, custom-format `pg_dump` taken prior to any write)
- **Migration applied:** [`supabase/migrations/00096_contradiction_fixes_20261123.sql`](../../supabase/migrations/00096_contradiction_fixes_20261123.sql) (799 unique published herbs updated, `herb_page_bundles` refreshed to 0 dirty, 799 slugs revalidated via `/api/revalidate-herb`)

---

## Before / After Comparison (All 22 Scan Rules, 3,124 Published Herbs)

| Rule                         | Before |   After | Disposition / Notes                                                                                                                                                                                                                |
| ---------------------------- | -----: | ------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `r_preg_contra`              |      0 |   **0** | Clean; maintained                                                                                                                                                                                                                  |
| `r_nurse_contra`             |     20 |   **0** | **Fixed:** `nursing_safe = false`, route-split booleans cleared on all 20 explicit breastfeeding contraindication rows                                                                                                             |
| `r_preg_abort`               |      0 |   **0** | Clean; maintained                                                                                                                                                                                                                  |
| `r_oral_but_internal_contra` |     32 |  **29** | **3 nulled** (`jatropha-gossypiifolia`, `calotropis-gigantea`, `nepenthes-mirabilis`); **29 left intact** (12 topical-only/FDA-ban regex false positives + 17 preparation/population/duration-qualified rows); see disposition CSV |
| `r_child_dose_vs_contra`     |    235 |   **0** | **Fixed:** `dosage_child` (+ FR `dosage_child`) nulled on all 235 rows; old values logged                                                                                                                                          |
| `r_evid_a_thin`              |      0 |   **0** | Clean; maintained                                                                                                                                                                                                                  |
| `r_evid_a_none`              |      0 |   **0** | Clean; maintained                                                                                                                                                                                                                  |
| `r_no_citations`             |     30 |  **30** | Left intact (no fabricated citations); exported CSV for human sourcing                                                                                                                                                             |
| `r_vague_safety`             |     30 |   **0** | **Fixed:** all 30 vague safety entries rewritten (EN + FR), preserving existing listed adverse effects and PMIDs                                                                                                                   |
| `r_toxic_no_contra`          |      3 |   **3** | Left intact (no invented contraindications); reported below                                                                                                                                                                        |
| `r_dup_contra`               |      0 |   **0** | Clean; maintained                                                                                                                                                                                                                  |
| `r_placeholder`              |      0 |   **0** | Clean; maintained                                                                                                                                                                                                                  |
| `r_fr_name_eq_en`            |  2,125 | **668** | Already executed by `2026-11-23-remaining-content.md` Task 1 (`1,457` translated, `668` logged rejects); verified only                                                                                                             |
| `r_english_in_fr_desc`       |      0 |   **0** | Clean; maintained                                                                                                                                                                                                                  |
| `r_no_image`                 |      0 |   **0** | Clean; maintained                                                                                                                                                                                                                  |
| `r_image_no_licence`         |     24 |   **0** | **Fixed:** backfilled `provenance.image.licence` and `credit` strictly from stored `license` and `attribution`                                                                                                                     |
| `r_dose_nonnumeric`          |    404 | **404** | Classified in prior Task 3 pass (`12` bare placeholders normalized; `4` remaining `Traditional use...` rows are toxic/unestablished warnings); 0 numbers added                                                                     |
| `r_no_dose`                  |    217 | **220** | +3 from Rule 3 (`jatropha-gossypiifolia`, `calotropis-gigantea`, `nepenthes-mirabilis`); no doses fabricated                                                                                                                       |
| `r_no_contra`                |     86 |  **86** | Left intact (no fabricated contraindications); exported CSV for human review                                                                                                                                                       |
| `r_no_side`                  |    263 | **263** | Left intact (no fabricated side effects); exported CSV for human review                                                                                                                                                            |
| `r_prov_unverified`          |  1,042 | **548** | **494** LNHPD regulator-imported rows mapped to `primary_source`; **548** `unverified — no source attached` rows left untouched                                                                                                    |
| `r_no_known_claim`           |     70 |  **68** | **2** multi-element contradictions cleaned (`macadamia-nut-oil`, `sumac-herb`); **68** honest single-element statements kept intact                                                                                                |

---

## Per-Rule Execution Summary

### 1. Nursing contradiction (`r_nurse_contra`: 20 → 0)

All 20 rows had `nursing_safe = true` (`nursing_safe_oral = true`, `nursing_safe_topical = true`) alongside the explicit contraindication `"Pregnancy and breastfeeding (medical advice required)"`. Set `nursing_safe = false` and cleared `nursing_safe_oral` / `nursing_safe_topical` to `NULL` without modifying `contraindications`:

`gordolobo`, `arctium-minus`, `herb-robert`, `loquat-leaf`, `reindeer-lichen`, `bitter-orange-flower`, `cyclopia-subternata`, `purple-loosestrife`, `basil-holy-seed`, `combretum-micranthum`, `patchouli`, `bamboo-leaf`, `coix-lacryma-jobi-var`, `heather`, `si-gua-luo`, `dong-kui-zi`, `murraya-paniculata`, `magnolia-virginiana`, `viola-tricolor-herb`, `sweet-cicely`.

### 2. Toxic claim with empty contraindications (`r_toxic_no_contra`: 3 → 3, no DB write)

No contraindications were invented. Live page checks confirmed safety rendering for the PubMed sheets:

| Slug                         | Views | Citations | PubMed Sheet | Description / Safety Signal                                                                                                    | Live Page Status                                                                               |
| ---------------------------- | ----: | --------: | ------------ | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `lathyrus-sativus`           |     0 |         3 | 76 articles  | Description names neurotoxin β-ODAP / excitotoxicity and neurolathyrism                                                        | PubMed safety text (`neurolathyrism`, `PMID:39519947`) renders on `/herbs/lathyrus-sativus`    |
| `opuntia-vulgaris`           |     0 |         3 | 14 articles  | Regex false positive (`"protective effects against liver and renal toxicity"`); PubMed safety is `"No PubMed data available."` | Renders description; no PubMed safety warning                                                  |
| `toxicodendron-diversilobum` |     0 |         3 | 5 articles   | Regex matched genus `Toxicodendron` (western poison oak); contains allergenic urushiol                                         | PubMed safety text (`urushiol`, `PMID:1185545`) renders on `/herbs/toxicodendron-diversilobum` |

### 3. Oral dose vs "not for internal use" (`r_oral_but_internal_contra`: 32 → 29)

Full per-row log: [`artifacts/audit-2026-11-23/rule3-oral-vs-internal-disposition.csv`](../../artifacts/audit-2026-11-23/rule3-oral-vs-internal-disposition.csv).

- **Nulled `dosage_adult` (+ FR `dosage_adult`), keeping `preparation_notes` intact (3 rows):**
  - `jatropha-gossypiifolia` — old `dosage_adult`: `"Leaf decoction 3-5g 2x/day (traditional)"`; contraindication: `"all internal use without guidance"`
  - `calotropis-gigantea` — old `dosage_adult`: `"Topical latex for skin conditions; 1-2g bark powder (extreme caution)"`; contraindication: `"internal use (cardiac glycosides - toxic)"`
  - `nepenthes-mirabilis` — old `dosage_adult`: `"Fluid from pitcher as eye wash (folk); leaf tea 3-5g"`; contraindication: `"internal use"`
- **Left intact — strictly topical/external-only or explicit FDA/Health Canada ban warnings where the scan regex tripped on `"tea"`, `"tincture"`, `"extract"`, `"decoction"`, `"powder"`, or `"oral"` (12 rows):**
  `acacia-confusa`, `arnica`, `calendula`, `tea-tree`, `calophyllum-brasiliense`, `tradescantia-pallida`, `barringtonia-asiatica`, `lantana-camara`, `soapberry-amazonian`, `mimosa-tenuiflora`, `hevea-brasiliensis`, `gobernadora`.
- **Left intact — legitimate preparation-specific, population-specific, or duration-limited internal cautions (17 rows):**
  `eucalyptus`, `eucalyptus-radiata`, `oak-bark`, `white-oak-bark`, `black-walnut`, `thuja`, `frangipani`, `harungana-madagascariensis`, `east-indian-lemongrass`, `kigelia-africana`, `lawsonia-inermis`, `barringtonia-racemosa`, `wrightia-arborea`, `iris-pallida`, plus 3 pyrrolizidine-alkaloid (PA) herbs flagged for human clinical review (`coltsfoot-leaf`, `ageratum-conyzoides`, `alkanet`).

### 4. Child dose vs child contraindication (`r_child_dose_vs_contra`: 235 → 0)

All 235 rows had an explicit contraindication naming children/pediatrics (`Children (medical advice required)`, `Strictly contraindicated in pregnancy, breastfeeding, children...`, `children under 6`, `Children under 12`, `Reye syndrome risk in children`, etc.). Nulled `dosage_child` and `translations.fr.dosage_child` on all 235 rows. Full pre-write log with all 235 slugs and old values: [`artifacts/audit-2026-11-23/rule4-child-dose-cleared.csv`](../../artifacts/audit-2026-11-23/rule4-child-dose-cleared.csv).

### 5. "No known contraindications" alongside real ones (`r_no_known_claim`: 70 → 68; 0 contradictions)

- **2 multi-element rows fixed (EN + FR):**
  - `macadamia-nut-oil`: removed `"None established as food"` / `"Aucun constaté comme aliment"`, leaving `["Nut allergy"]` / `["Allergie aux noix"]`.
  - `sumac-herb`: removed `"None established as food"` / `"Aucune contre-indication établie en alimentation"`, leaving `["Kidney stones with high oxalate sensitivity"]` / `["Calculs rénaux avec sensibilité aux oxalates élevés"]`.
- **68 single-element rows left intact:** all 68 have `array_length(contraindications, 1) = 1` (e.g., `torch-ginger`, `chrysophyllum`, `astragalus-gummifer`, `cloudberry`, `sweet-fern`), which are honest single statements rather than contradictions.

### 6. Residual vague safety lines (`r_vague_safety`: 30 → 0)

All 30 slugs updated (EN + FR):

- **15 pure vague entries** rewritten to `"Adverse effects not well documented in the reviewed literature"` (FR: `"Effets indésirables peu documentés dans la littérature examinée"`): `vietnamese-coriander`, `kawakawa`, `egusi-herb`, `aframomum-corrorima`, `munyeroo`, `poria-cocos`, `emu-bush`, `phormium-tenax`, `osmorhiza-longistylis`, `mentha-requienii`, `chaparro-amargosa`, `beach-morning-glory`, `peltigera-canina`, `chanterelle`, `porcini`.
- **8 rows with specific effects already listed** had the vague phrase dropped while retaining the specific effect verbatim: `birds-foot-trefoil` (`Mild nausea`), `xanthorhiza-simplicissima` (`GI upset`), `velvet-tamarind` (`diarrhea with excess`), `chaya` (`Prussic acid toxicity if consumed raw`), `sideritis` (`Rare GI sensitivity`), `aquilaria-sinensis` (`GI upset`), `warburgia-salutaris` (`GI irritation`), `strychnos-spinosa` (`Bark toxic in high doses`).
- **7 PubMed-cited rows** had vague wording replaced/removed while preserving their existing PMIDs and documented adverse effects: `abelmoschus-manihot`, `chrysanthemum-parthenium`, `dioscorea-spongiosa`, `jasminum-grandiflorum`, `paeonia-anomala`, `pennisetum-glaucum`, `sabal-serrulata`.

### 7. Image licence/credit gaps (`r_image_no_licence`: 24 → 0)

All 24 rows (`triphala`, `iberogast-digestive`, `peony-licorice-combo`, `triphala-guggulu`, `dang-gui-jian-zhong`, `liu-wei-di-huang-wan`, `chromium-metabolic-v2`, `artemisia-judaica`, `bai-bu-root`, `shakuyaku-kanzo-kampo`, `jamu-kunyit-asam`, `si-wu-tang-patent`, `juzen-taiho-kampo`, `tokishakuyakusan`, `niacinamide-skin`, `hachimijiogan`, `tou-gu-cao`, `ssanghwa-korean`, `jamu-herbs-mix`, `keishi-bukuryo-gan`, `trikatu-indian`, `yokukansan-kampo`, `crypthecodinium-cohnii`, `polygonatum-cyrtonema`) already stored `provenance.image.license` and `provenance.image.attribution` from Wikimedia Commons / iNaturalist. Backfilled `licence` and `credit` directly from those stored fields.

### 8. Non-numeric (404) and missing (220) adult doses

Verified against production after the earlier Task 3 pass (`e6ba461` → `4e33784`): `404` non-numeric doses remain legitimately classified (toxic/supervision, topical/EO, culinary, ceremonial/homeopathic, mixed topical+oral, and `12` normalized to `"No standard adult dose is established in the reviewed sources."`). The 4 entries matching `^Traditional use` (`allamanda-cathartica`, `heliamphora-nutans`, `kopsia-fruticosa`, `scadoxus-multiflorus`) are explicit toxicity/unestablished warnings, not bare placeholders. `r_no_dose` moved from `217` to `220` due to the 3 Rule 3 nulls. Zero numbers were added.

### 9. Empty safety & citation fields (CSVs for human review)

- [`artifacts/audit-2026-11-23/empty-side-effects.csv`](../../artifacts/audit-2026-11-23/empty-side-effects.csv) — **263** rows (`1` with monograph-source safety, `3` with LNHPD regulatory risks, `1` with non-placeholder PubMed safety text).
- [`artifacts/audit-2026-11-23/empty-contraindications.csv`](../../artifacts/audit-2026-11-23/empty-contraindications.csv) — **86** rows (`0` with monograph-source safety, `0` with LNHPD regulatory risks, `21` with non-placeholder PubMed safety text, `0` with PubMed pregnancy text).
- [`artifacts/audit-2026-11-23/empty-citations.csv`](../../artifacts/audit-2026-11-23/empty-citations.csv) — **30** rows (`0` with monograph sources, `0` with regulatory evidence, `15` with compiled PubMed sheets).

### 10. Provenance unverified (`r_prov_unverified`: 1,042 → 548)

- **494 rows** imported by `scripts/import-expanded-herbs.mjs` and `scripts/import-tcm-herbs.mjs` lacked the `provenance.verification_method` key despite carrying `provenance.verified_by LIKE 'regulator record (LNHPD)%'` and an explicit `{type: "regulator", name: "Health Canada LNHPD"}` entry in `provenance.sources`. Mapped those 494 rows to `verification_method = "primary_source"`.
- **548 rows** marked `verification_method = "unverified"` (`verified_by = "unverified — no source attached"`) were left untouched.

### 11. French herb names (`r_fr_name_eq_en`: 2,125 → 668)

Verified in the live DB after `2026-11-23-remaining-content.md` Task 1 (`4fa42a2`): `668` remain equal to English (the logged rejects); no re-translation was performed.

---

## What We Refused to Invent

1. **No contraindications on Rule 2 toxic rows (3 rows)** — `lathyrus-sativus`, `opuntia-vulgaris`, and `toxicodendron-diversilobum` were left with empty `contraindications` and reported for human sourcing.
2. **No rewritten topical doses on Rule 3 (29 rows)** — We refused to fabricate topical dosing text for `jatropha-gossypiifolia`, `calotropis-gigantea`, or `nepenthes-mirabilis` (nulled `dosage_adult` instead), and refused to strip legitimate topical/warning or qualified internal instructions on the remaining 29 rows.
3. **No removal of honest single-element "None established" statements on Rule 5 (68 rows)** — Preserved as non-contradictory statements.
4. **No numeric doses or placeholder overrides on Rule 8 (404 non-numeric, 220 missing)** — Zero numbers invented; only verified non-contradictory classifications retained.
5. **No fabricated side effects, contraindications, or citations on Rule 9 (263 / 86 / 30 rows)** — Exported three review CSVs with existing monograph/regulatory/PubMed flags instead.
6. **No fabricated verification methods on Rule 10 (548 rows)** — Left all 548 `unverified — no source attached` rows untouched; never set `review_status = 'human_reviewed'` or added named reviewer bylines.
