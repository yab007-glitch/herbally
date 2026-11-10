# Sourcing policy for herb-drug interactions

Every interaction pair we publish must be traceable to a specific, reusable,
authoritative source. This document defines which sources may be cited, how
severity and evidence level are assigned, and the review runbook for adding a
pair.

The licence decisions themselves live in
[`data-source-licences.md`](./data-source-licences.md). That register is
normative: it quotes the terms each licence was verified against, lists the
rejected datasets, and records the rule that a source must be added there
before any pair cites it.

## Allowed source values

New seed data may declare only these four `source` values. Anything else is
rejected with `SOURCE_NOT_ALLOWED`; in particular `Natural Medicines Database`,
`Clinical Studies`, and `WHO Monographs` are legacy values and are not allowed
for new rows.

| `source` value | Must cite              | `source_licence`           |
| -------------- | ---------------------- | -------------------------- |
| `EMA HMPC`     | `ema.europa.eu`        | `ema-legal-notice`         |
| `NIH ODS`      | `ods.od.nih.gov`       | `us-federal-public-domain` |
| `NCCIH`        | `nccih.nih.gov`        | `us-federal-public-domain` |
| `LiverTox`     | `livertox.nlm.nih.gov` | `us-federal-public-domain` |

Every pair also declares `source_licence`. The validator checks that the
licence belongs to the cited host and that the host is the one the declared
source must use (`SOURCE_LICENCE_MISMATCH`).

## Citation allowlist

A `source_url` host must match an entry below exactly or be a subdomain of one.
The host comparison is lowercase with any trailing dot stripped.

| Host                      | Who publishes it                                         | Why its content is reusable                                                                                                                                              |
| ------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ods.od.nih.gov`          | NIH Office of Dietary Supplements                        | US federal government work; not subject to copyright in the United States (17 U.S.C. §105).                                                                              |
| `nccih.nih.gov`           | National Center for Complementary and Integrative Health | US federal government work; public domain in the United States.                                                                                                          |
| `ncbi.nlm.nih.gov`        | National Center for Biotechnology Information (NLM/NIH)  | US federal government work; cite NLM pages directly. Third-party content linked from NCBI may carry publisher terms, so cite the NCBI page itself.                       |
| `pubmed.ncbi.nlm.nih.gov` | National Library of Medicine                             | NLM metadata is public domain; abstracts may remain publisher-copyrighted. Link to the specific abstract and paraphrase minimally rather than copying full text.         |
| `livertox.nlm.nih.gov`    | National Library of Medicine (LiverTox)                  | US federal government work; public domain in the United States.                                                                                                          |
| `canada.ca`               | Government of Canada                                     | Open Government Licence – Canada permits reuse with attribution and does not imply endorsement. No `source` value maps to this host yet, so it is not currently citable. |
| `ema.europa.eu`           | European Medicines Agency                                | EMA legal notice permits reuse of documents with attribution, provided the material is not presented as official EMA advice or altered misleadingly.                     |
| `who.int`                 | World Health Organization                                | CC BY-NC-SA 3.0 IGO: attribution required, non-commercial use only, share-alike applies to adaptations. **Blocked** — see below.                                         |
| `cochrane.org`            | Cochrane                                                 | Cochrane abstract licence permits non-commercial reuse of abstracts with attribution. **Blocked** — see below.                                                           |

### who.int and cochrane.org are blocked

Both hosts stay on the technical host allowlist from the original sourcing
card, but neither may be used. Their licences are non-commercial, and HerbAlly
carries advertising, so the validator rejects them with
`LICENCE_NOT_COMMERCIAL_USE`. Neither host has a `source` value in the list
above, so a WHO or Cochrane citation also cannot satisfy the source/host check.
This is a licence decision, not a technical one: do not work around it by
citing a WHO or Cochrane page through a mirror, aggregator, or republication.

### Cite the page, not the site

Every pair must cite the **specific page** it came from: the monograph,
factsheet, label, or abstract that contains the interaction claim. A homepage,
a site search result, a category index, or a generic landing page is not an
acceptable `source_url`. If the page URL changes, update the seed and re-run
validation rather than substituting the homepage.

## Natural Medicines Database: never use it

**The Natural Medicines Database (formerly Natural Standard / Natural Medicines
Comprehensive Database) is a commercial subscription product. It must NEVER be
scraped, copied from, paraphrased into our dataset, or cited as a source.** It
is not on the allowlist and must not be added to it. The existing source value
`Natural Medicines Database` in older rows predates this policy; those rows are
legacy data, not a precedent, and must not be used to justify new citations.
Replace such rows with an allowlisted primary source when they are next
reviewed.

## Evidence level mapping

`evidence_level` describes the strength of the human evidence supporting the
pair, not the severity of the outcome.

| Value               | Use when                                                                                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `well-documented`   | Multiple consistent human studies, a systematic review, or a regulatory safety warning (FDA, EMA, Health Canada) documents the interaction.                                  |
| `moderate-evidence` | Some human data exists — a small trial, a case series, or a pharmacokinetic study — but it is not replicated or not reflected in a regulatory warning.                       |
| `limited-evidence`  | The interaction is theoretical, supported by animal or in-vitro data, or rests on isolated case reports. Use this rather than omitting a plausible mechanism-driven concern. |

## Severity policy

Severity describes the clinical consequence if the pair is combined, assuming
typical doses. When sources disagree, choose the higher severity and explain
the disagreement in the description.

| Value             | Meaning                                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- |
| `contraindicated` | The combination should be avoided. A serious outcome is documented or a regulator warns against co-administration.   |
| `severe`          | Clinically significant risk; may require avoiding the combination, changing therapy, or close specialist monitoring. |
| `moderate`        | Clinically relevant; monitor the patient or separate administration times and adjust dose as needed.                 |
| `mild`            | Minimal clinical significance; worth knowing but unlikely to require intervention beyond awareness.                  |

## How to add a pair

1. Write or edit the seed file at `data/interactions/<herb-slug>.json` using the
   schema `{ "herb_slug": "...", "pairs": [...] }`. Every pair needs
   `drug_name`, `severity`, `description`, `mechanism`, `evidence_level`,
   `source`, `source_licence`, and `source_url`. Use a `source` value from the
   table above and the licence registered for that source in
   [`data-source-licences.md`](./data-source-licences.md).
2. Run the validator:
   `npx tsx scripts/interactions/validate.ts --dir data/interactions`.
   Fix every `REJECT` line. The validator is read-only and uses the anonymous
   Supabase key.
3. Run the importer dry run:
   `npx tsx scripts/interactions/import.ts --dir data/interactions`.
   Confirm the insert/update classification and the per-herb coverage table.
4. Hand the diff of the seed file and the dry-run output to a reviewer. The
   reviewer checks the source URL actually supports the claim, the severity is
   consistent with the policy above, and no commercial database was used.
5. Apply only with explicit owner approval:
   `SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/interactions/import.ts --apply`.
   The importer refuses `--apply` when the key is absent and never writes during
   a dry run. Keep the key in the shell environment; never commit it or paste it
   into a seed file, issue, or PR.
