# Licence register for interaction data sources

This register is the licence half of the interaction sourcing policy. A dataset
is only a candidate if its licence permits **commercial** reuse and
redistribution — HerbAlly carries advertising, so "non-commercial only" means
"never import". The technical host allowlist lives in
[`scripts/interactions/validate.ts`](../scripts/interactions/validate.ts)
(`SOURCE_HOST_ALLOWLIST`) and the narrative policy lives in
[`interaction-sourcing.md`](./interaction-sourcing.md).

**Date checked: 2026-11-01.** Every row below was verified on that date by
reading the publisher's own terms or licence page for the source named in the
row, not by trusting a dataset's README, a package registry field, or a
third-party summary.
The decisive wording is quoted so a future reviewer can see what the decision
rested on. Re-verify before citing a source for the first time after a long gap
or after a publisher announces a licence change.

## Rejected sources — do not import, do not cite

| Source                     | Licence / terms                                | Decisive terms                                                                                                                                        | Why rejected                                                                                                                                                                |
| -------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DDInter 2.0                | CC BY-NC-SA 4.0                                | "This work is licensed under a Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License."                                      | Non-commercial clause blocks advertising-supported use. The ShareAlike clause would also force our derived dataset under the same licence, which we cannot accept.          |
| ClarisHerba 0.165.0        | CC BY-NC 4.0                                   | "Licensed under the Creative Commons Attribution-NonCommercial 4.0 International License."                                                            | Non-commercial clause blocks advertising-supported use. It is also a single-author sample collection rather than a maintained regulatory or clinical reference.             |
| DrugBank                   | Commercial licence; free tier is academic-only | "DrugBank data is available under the terms of a commercial license" and may not be redistributed; the free academic licence excludes commercial use. | No redistribution rights and no commercial-use right for our product.                                                                                                       |
| Natural Medicines Database | Commercial subscription product                | Subscription terms prohibit copying, redistribution, and use to build a competing or derived database.                                                | No redistribution rights; proprietary compilation. Never scrape, paraphrase, or cite it. Legacy rows carrying this source value predate the policy and are not a precedent. |

A similar-looking dataset is **never** a substitute for an approved source. If a
source above is unavailable, the correct action is to find an allowed source
that states the interaction — not to cite the rejected one through a mirror,
aggregator, or third party that republished it.

## Accepted sources

Each accepted source maps to exactly one host (`SOURCE_HOSTS` in
`validate.ts`) and one licence identifier (`HOST_LICENCES`). A seed pair must
declare the licence that belongs to its source, and the citation must be on that
source's host; anything else is `SOURCE_LICENCE_MISMATCH`.

| Source value | Publisher / host                                                           | Licence identifier         | Decisive terms                                                                                                                                                                                                                                                                                      |
| ------------ | -------------------------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EMA HMPC`   | European Medicines Agency — `ema.europa.eu`                                | `ema-legal-notice`         | EMA legal notice: information "may be reproduced and/or distributed, in whole or in part, for non-commercial or commercial purposes, provided that the source is acknowledged". EMA must be named as the source; the material must not be presented as official EMA advice or altered misleadingly. |
| `NIH ODS`    | NIH Office of Dietary Supplements — `ods.od.nih.gov`                       | `us-federal-public-domain` | ODS content is a US federal government work: "Copyright protection under this title is not available for any work of the United States Government" (17 U.S.C. §105). ODS states that its fact sheets may be copied and distributed.                                                                 |
| `NCCIH`      | National Center for Complementary and Integrative Health — `nccih.nih.gov` | `us-federal-public-domain` | NCCIH content is a US federal government work, public domain under 17 U.S.C. §105; NCCIH permits reproduction of its material with credit to NCCIH and without implying endorsement.                                                                                                                |
| `LiverTox`   | NIDDK/NLM on the NCBI Bookshelf — `livertox.nlm.nih.gov`                   | `us-federal-public-domain` | LiverTox is a US federal government work published on the NCBI Bookshelf. NLM treats Bookshelf content authored by federal agencies as public domain, consistent with 17 U.S.C. §105.                                                                                                               |

Attribution is still required in practice for EMA and expected as good
practice for the US federal sources: name the publisher, link the specific page,
and do not imply endorsement. A public-domain licence is not a licence to
misrepresent the source's conclusions.

### Hosts on the technical allowlist that are not usable

`SOURCE_HOST_ALLOWLIST` predates this register and stays as a technical
boundary. Being on it does **not** mean a host may be cited:

- `who.int` — CC BY-NC-SA 3.0 IGO. Non-commercial and share-alike; blocked by
  `LICENCE_NOT_COMMERCIAL_USE`. There is also no `SOURCE_VALUES` entry for WHO.
- `cochrane.org` — the Cochrane abstract licence permits non-commercial reuse of
  abstracts with attribution; blocked by `LICENCE_NOT_COMMERCIAL_USE`, and there
  is no `SOURCE_VALUES` entry for Cochrane.
- `canada.ca` — Open Government Licence – Canada permits commercial reuse with
  attribution ("You are free to copy, modify, publish, translate, adapt,
  distribute or otherwise use the Information in any medium, mode or format for
  any lawful purpose"). It is a viable future source, but no `SOURCE_VALUES`
  entry currently maps to it, so no pair can cite it yet. Adding one is a
  register change first, a `SOURCE_VALUES` change second.
- `ncbi.nlm.nih.gov` and `pubmed.ncbi.nlm.nih.gov` — NLM metadata is public
  domain, but the allowlist entry exists for supporting pages. No `SOURCE_VALUES`
  entry maps to them; cite LiverTox on its own host instead.

## Rule for adding a future source

1. Read the publisher's terms page and record the exact licence and quoted
   terms here **before** any pair cites the source.
2. Decide the `SOURCE_VALUES` name, the one host it must cite, and its
   `SOURCE_LICENCES` identifier. Add them to `validate.ts` in the same change.
3. A source with a non-commercial, no-derivatives, or no-redistribution term is
   rejected — the register row goes in the rejected table, not the accepted one.
4. A similar-looking dataset is never an acceptable substitute for a source that
   is unavailable, paywalled, or withdrawn.

If a publisher changes its terms, re-check this register and remove the source
from `SOURCE_VALUES` before the next import. Existing imported rows keep their
provenance in the seed artifact, which is what makes the removal auditable.

## Per-pair provenance

Every pair in `data/interactions/<herb>.json` carries:

```json
{
  "source": "EMA HMPC",
  "source_licence": "ema-legal-notice",
  "source_url": "https://www.ema.europa.eu/en/medicines/herbal/..."
}
```

The pairing of `source` and `source_licence` is what lets an auditor answer "why
is this row allowed to exist?" without guessing which host was used or under
which terms. The validator enforces:

| Code                         | Meaning                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `SOURCE_NOT_ALLOWED`         | `source` is not one of `EMA HMPC`, `NIH ODS`, `NCCIH`, `LiverTox`.                                                              |
| `SOURCE_LICENCE_MISSING`     | `source_licence` is absent or blank.                                                                                            |
| `SOURCE_LICENCE_INVALID`     | `source_licence` is not one of `SOURCE_LICENCES`.                                                                               |
| `SOURCE_LICENCE_MISMATCH`    | The declared licence is not the licence of the cited host, or the cited host is not the host that the declared source must use. |
| `LICENCE_NOT_COMMERCIAL_USE` | The declared licence is `who-cc-by-nc-sa` or `cochrane-abstract-licence`.                                                       |

`public.drug_interactions` has **no licence column** — the schema predates this
policy and is not being widened in this change. The durable record is therefore
the reviewed seed artifact (`data/interactions/*.json`, committed to git) plus
this register. The importer's dry-run output repeats the source and licence per
accepted pair so a reviewer can check provenance before `--apply`, but the dry
run itself is not retained; do not treat console output as the record.
