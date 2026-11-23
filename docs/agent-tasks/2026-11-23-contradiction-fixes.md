# Task brief — HerbAlly contradiction fixes (2026-11-23)

Repo: `/Users/yasser/herbally`. Production DB: `ssh windows` →
`wsl.exe -d Ubuntu-24.04 -- docker exec -i herbally-db psql -U postgres -d postgres`.

Input data: `artifacts/audit-2026-11-23/contradictions.csv` (3,124 published herbs,
22 boolean rules) and `contradiction-fixes.csv` (one row per rule/slug, highest
traffic first). Re-run the scan after fixes with
`docs/agent-tasks/contradictions.sql` (copy the query from the audit log if it is
missing; the CSV header names every rule).

## Hard rules

- **Do not invent medical facts.** No new doses, no new interaction pairs, no new
  contraindications, no new evidence grades, no new citations.
- Fix **contradictions by removing or nulling the weaker/unsafe claim**, never by
  authoring a new one.
- Every change must be reversible: take a DB dump first
  (`pg_dump` to `/home/yasser/herbally-backups/contradictions-20261123.dump` or the
  box equivalent) and record the SQL you ran in the task report.
- Keep every page indexable and keep the generic "Reviewed and verified" line.
- Do not add named reviewer bylines or bulk "reviewed by" stamps.
- Run `npx tsc --noEmit`, `npx vitest run`, `npx eslint` on changed files before each
  commit; commit small units and push.

## Fix order (safety first)

### 1. Nursing contradiction — 20 rows (`r_nurse_contra`)

Rule: `nursing_safe = true` while a contraindication says avoid breastfeeding/nursing.

Fix: set `nursing_safe = false` where the contraindication is explicit. If the flag is
`null` or ambiguous, leave and report. Never flip a contraindication off to match the
flag. Examples: `gordolobo`, `arctium-minus`, `herb-robert`, `loquat-leaf`,
`bitter-orange-flower`.

### 2. Toxic claim with empty contraindications — 3 rows (`r_toxic_no_contra`)

`lathyrus-sativus`, `opuntia-vulgaris`, `toxicodendron-diversilobum`.

Do **not** write a contraindication. Report each with its citation count and the
sentence that says "toxic", so a human can source the warning. If the row has a
sourced monograph, confirm the safety text renders on the page and note it.

### 3. Oral dose vs "not for internal use" — 32 rows (`r_oral_but_internal_contra`)

`dosage_adult` describes oral use (tea/tincture/extract/capsule) while a
contraindication says "not for internal use".

Fix: null `dosage_adult` for rows whose contraindication is unambiguous topical-only,
keep any topical dose field intact, and log slug + old value. Do not invent a topical
dose. If both claims might be legitimate for different preparations, leave and report.
Examples: `arnica`, `tea-tree`, `eucalyptus`, `calendula`, `coltsfoot-leaf`.

### 4. Child dose vs child contraindication — 235 rows (`r_child_dose_vs_contra`)

`dosage_child` is populated while a contraindication excludes children.

Fix: set `dosage_child = null` where the contraindication explicitly names
children/pediatric. The contraindication wins; a dose for a group the page says must not
use the herb is the contradiction. Log all 235 slugs.

### 5. "No known contraindications" alongside real ones — 70 rows (`r_no_known_claim`)

Rows list both "None known" and an actual contraindication.

Fix: drop the "none/no known" array element when other elements exist. Keep it when it
is the only element (that is an honest statement, not a contradiction). Examples:
`torch-ginger`, `chrysophyllum`, `astragalus-gummifer`, `macadamia-nut-oil`.

### 6. Residual vague safety lines — 30 rows (`r_vague_safety`)

These escaped the earlier exact-match map. Rewrite to the same neutral form used
already: "Adverse effects not well documented in the reviewed literature". Do not name
specific effects unless the row already lists them. Slugs: `vietnamese-coriander`,
`birds-foot-trefoil`, `kawakawa`, `xanthorhiza-simplicissima`, `egusi-herb`,
`aframomum-corrorima`, `velvet-tamarind`, `chaya`, `sideritis`, `munyeroo`,
`poria-cocos`, `emu-bush`, `phormium-tenax`, `osmorhiza-longistylis`,
`aquilaria-sinensis`, `mentha-requenii`, `warburgia-salutaris`, `chaparro-amargosa`,
`beach-morning-glory`, `peltigera-canina`, `chanterelle`, `porcini`,
`strychnos-spinosa`, `abelmoschus-manihot`, `chrysanthemum-parthenium`,
`dioscorea-spongiosa`, `jasminum-grandiflorum`, `paeonia-anomala`,
`pennisetum-glaucum`, `sabal-serrulata`.

### 7. Image licence/credit gaps — 24 rows (`r_image_no_licence`)

Backfill `provenance.image.licence` and `provenance.image.credit` only from metadata
the row already holds (source URL, Commons/API response). If the licence cannot be
established from stored data, report the slug — do not guess a licence.

### 8. Non-numeric (404) and missing (217) adult doses

Classify only: topical/aromatherapy instructions are legitimate; placeholders like
"as directed" without a number or source become "No standard adult dose is established
in the reviewed sources" **only where that is true for that page**. Otherwise leave and
report. No numbers.

### 9. Empty fields — 263 no side effects, 86 no contraindications, 30 no citations

Do not fabricate. Produce one CSV per group with slug, traffic and whether the page has
a sourced monograph or PubMed sheet that already carries the missing safety text. That
list goes to a human.

### 10. Provenance unverified — 1,042 rows (`r_prov_unverified`)

`provenance.verification_method` is `(none)` or `unverified`. **Do not stamp a method
that was not used.** Instead map each row to the method actually applied to it if it is
recorded elsewhere (import pipeline, translation job, manual edit), and leave the rest
as-is with a count. A fabricated verification method is worse than a null.

### 11. French names — 2,125 rows (`r_fr_name_eq_en`)

Already covered by `docs/agent-tasks/2026-11-23-remaining-content.md` task 1. If that
run has completed it, only verify; do not re-translate. Report the remaining count.

## Acceptance

Re-run the contradiction scan after the fixes and report a before/after table for every
rule. Target: rules 1, 3, 4, 5, 6 at zero, rule 10 unchanged unless evidence exists,
everything else reported with a slug list. Update the vault note
`Team Memory/knowledge/2026-11-23-herbally-full-catalogue-scan.md` with the table, and
state explicitly what you refused to invent.
