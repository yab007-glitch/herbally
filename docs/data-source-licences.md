# Licence register for interaction data sources

This register is the licence half of the interaction sourcing policy. A dataset
is only a candidate if its licence permits **commercial** reuse and
redistribution — HerbAlly carries advertising, so "non-commercial only" means
"never import". The technical host allowlist lives in
[`scripts/interactions/validate.ts`](../scripts/interactions/validate.ts)
(`SOURCE_HOST_ALLOWLIST`) and the narrative policy lives in
[`interaction-sourcing.md`](./interaction-sourcing.md).

**Date checked: 2026-11-01** for the interaction rows below; the open reference
inventory added on 2026-11-03 states its own date. Every row was verified on its
own date by
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

## Health Canada LNHPD — accepted 2026-11-02 (monograph evidence, not interaction pairs)

The Licensed Natural Health Products Database publishes licensed-product records
through a JSON API. Decisive terms: the dataset is published on the Open
Government Portal under the **Open Government Licence – Canada**, which permits
commercial reuse with attribution.

| Field            | Value                                                                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source`         | `Health Canada LNHPD`                                                                                                                                     |
| host             | `health-products.canada.ca`                                                                                                                               |
| `source_licence` | `canada-ogl`                                                                                                                                              |
| obligations      | attribute "Health Canada, Licensed Natural Health Products Database"; link the dataset; record the retrieval date; do not imply Health Canada endorsement |
| scope            | product purpose (indications), dose, risk statements, medicinal-ingredient quantities                                                                     |
| not usable for   | interaction severity — the LNHPD carries no interaction grading, so it never seeds `data/interactions/*.json`                                             |

Coverage measured 2026-11-02 by `scripts/harvest-lnhpd.mjs`: 832,126
medicinal-ingredient rows scanned; **1,164 of 2,699 published herbs** matched at
least one licensed product; median 25 records per herb. The remaining 1,535
herbs have no regulator record in this source and must not be padded to look
like they do.

## Open reference sources — inventory (licence and access), checked 2026-11-03

These sources support taxonomy, chemistry and literature rather than interaction
severity. Clearing a source here does not add it to `SOURCE_VALUES`; that remains
a separate change under the rule above. A source that clears here may still be
barred from a given use by its own access rules, such as robots directives or a
bot challenge. The evidence directory is `artifacts/source-probes/2026-11-03/`;
the raw bodies and the three manifests in that directory are the record.

| Source                      | Host                        | Licence                             | Verdict  | Access on 2026-11-03                                         |
| --------------------------- | --------------------------- | ----------------------------------- | -------- | ------------------------------------------------------------ |
| NCCIH                       | `nccih.nih.gov`             | `us-federal-public-domain`          | ACCEPTED | 200 static HTML; policy paths 404, NIH-wide policy 403       |
| NCBI E-utilities and PubMed | `eutils.ncbi.nlm.nih.gov`   | `nlm-terms`                         | ACCEPTED | API 200; E-utilities manual behind reCAPTCHA                 |
| PubChem                     | `pubchem.ncbi.nlm.nih.gov`  | `ncbi-fair-use`                     | ACCEPTED | PUG REST 200; docs pages reCAPTCHA                           |
| USDA PLANTS                 | `plants.sc.egov.usda.gov`   | `us-federal-public-domain`          | ACCEPTED | 200 only with a JS renderer; plain fetch is a 710-byte shell |
| GBIF                        | `api.gbif.org`              | per dataset; backbone `cc-by-4.0`   | ACCEPTED | API 200; `www.gbif.org` 403 Cloudflare challenge             |
| Wikidata                    | `www.wikidata.org`          | `cc0-1.0` data, `cc-by-sa-4.0` text | ACCEPTED | 200 static HTML and API                                      |
| Health Canada LNHPD         | `health-products.canada.ca` | `canada-ogl`                        | ACCEPTED | API 200; page 1 about 149 MB                                 |
| EMA HMPC                    | `ema.europa.eu`             | `ema-legal-notice`                  | ACCEPTED | 200 static HTML; old herbal paths 404                        |
| Kew POWO                    | `powo.science.kew.org`      | none evidenced                      | BLOCKED  | 403 Cloudflare challenge; robots disallows this agent        |

### NCCIH

Licence identifier `us-federal-public-domain`. No NCCIH licence page was
retrievable: `/about/legal-information`, `/about/policies` and
`/about/nccih-website-policies` returned 404, and
`https://www.nih.gov/web-policies-notices` returned a 403 Cloudflare challenge.
The authority is therefore the statute, not a site page: 17 U.S.C. §105,
"Copyright protection under this title is not available for any work of the
United States Government". The existing NCCIH row in Accepted sources rests on
the same basis.

- May be used for: reference prose on herbs and supplements, with credit to NCCIH.
- May not be used for: implying NCCIH endorsement.
- Scope: this inventory does not change the existing `SOURCE_VALUES` entry for NCCIH.

### NCBI E-utilities and PubMed

Licence identifier `nlm-terms` for NLM data; article text stays under publisher
copyright. Decisive terms from
`https://www.nlm.nih.gov/databases/download/terms_and_conditions.html`:
"Downloading data from the National Library of Medicine FTP servers indicates
your acceptance of the following Terms and Conditions: No charges, usage fees or
royalties are paid to NLM for this data." The same page requires users to
"acknowledge NLM as the source of the data by including the phrase "Courtesy of
the U.S. National Library of Medicine" in a clear and conspicuous manner" and
"not indicate or imply that NLM has endorsed its products/services/applications."

- May be used for: PubMed metadata and abstracts as NLM serves them, with the acknowledgement string; link the PubMed record rather than reproducing publisher text.
- May not be used for: third-party article text. The NLM terms cover NLM data, and the NCBI policies page records that "NLM does not claim the copyright on the abstracts in PubMed; however, journal publishers or authors may."
- Access: `eutils.ncbi.nlm.nih.gov/robots.txt` describes itself as a back-end server version and sets `Disallow: /`; the governing document is the NCBI usage policy. The general NCBI policies page states "Make no more than 3 requests every 1 second". The E-utilities manual itself was unreachable behind a reCAPTCHA interstitial, so the figure is taken from the policies page rather than from that manual.

### PubChem

Licence identifier `ncbi-fair-use`. The docs pages (`/docs/legal-notices` and
`/docs/downloads`) returned a reCAPTCHA interstitial to both a plain fetch and a
headless render, so the licence basis is the plain-text Fair Use Disclaimer at
`https://ftp.ncbi.nlm.nih.gov/pubchem/README`: "NCBI itself places no
restrictions on the use or distribution of the data contained therein. However,
some submitters of the original data may claim patent, copyright, or other
intellectual property rights in all or a portion of the data they have
submitted."

- May be used for: CID, names and computed properties returned by PUG REST; gingerol resolved to CID 442793 on 2026-11-03.
- May not be used for: depositor-supplied annotations without separate provenance. The disclaimer says NCBI "cannot provide comment or unrestricted permission concerning the use, copying, or distribution of the information contained in the molecular databases."
- Access: `robots.txt` sets `Crawl-delay: 5` and groups `ClaudeBot` with training crawlers under `Disallow: /`; its header describes the file as "voluntary crawler instructions", not a prohibition on reuse. Retrieve by the PUG REST path, not by crawling the site.

### USDA PLANTS

Licence identifier `us-federal-public-domain`, on the federal rule at 17 U.S.C.
§105: "Copyright protection under this title is not available for any work of
the United States Government". No PLANTS or USDA licence page was retrievable:
`https://www.usda.gov/policies-and-links` returned 403 Access Denied and
`www.nrcs.usda.gov` timed out over both HTTP and HTTP/1.1. The statute, not a
site statement, is the basis here.

- May be used for: taxonomy, nomenclature and distribution data from PLANTS profiles.
- May not be used for: the basemap. The rendered ZIOF profile carries "Copyright:(c) 2014 Esri | USDA-NRCS-NGCE & NPDT"; that attribution covers the Esri basemap, not the PLANTS data.
- Access: the site is a single-page application. A plain fetch of `/`, `/plant-profile/ZIOF` and `/robots.txt` returns the same 710-byte `<plants-app>` shell; only a headless Chromium render produces the home page and the ZIOF profile. No robots.txt exists because the server returns the app shell for that path.

### GBIF

GBIF is a platform, not a single licence. The backbone taxonomy is `cc-by-4.0`
and must be attributed. Decisive terms from the API record at
`https://api.gbif.org/v1/dataset/d7dddbf4-2cf0-4f39-9b2a-bb099caae36c`:
`"license": "http://creativecommons.org/licenses/by/4.0/legalcode"` on a record
titled `"GBIF Backbone Taxonomy"`. The `www.gbif.org` terms and citation pages
returned a 403 Cloudflare challenge, so the API record is the evidence.

- May be used for: backbone taxonomy matching, attributed under CC BY 4.0. The record's citation text is "GBIF Secretariat (2023). GBIF Backbone Taxonomy. Checklist dataset https://doi.org/10.15468/39omei accessed via GBIF.org on 2026-11-03."
- May not be used for: any occurrence dataset whose own `license` field is non-commercial. A CC BY-NC dataset is excluded by the monetisation rule.
- Rule: read the licence per dataset from the API record, never assume it from the platform.

### Wikidata

Licence identifier `cc0-1.0` for the data namespaces and `cc-by-sa-4.0` for
other namespaces. Decisive terms from
`https://www.wikidata.org/wiki/Wikidata:Licensing`: "All structured data (i.e.
the main, Property, Lexeme, and EntitySchema namespaces) is released into the
public domain under Creative Commons Zero. Text in other namespaces is
copyrighted and available under the Creative Commons Attribution-ShareAlike 4.0
License."

- May be used for: identifier resolution and cross-references; the API returned Q35625 for "Zingiber officinale" with label "ginger".
- May not be used for: copying project-page, help or policy prose, which is CC BY-SA 4.0.
- Limit: CC0 removes the licence obstacle but does not make Wikidata evidence. It resolves an identifier; the primary source carries the claim.

### Health Canada LNHPD

Licence identifier `canada-ogl`. Decisive terms from
`https://open.canada.ca/en/open-government-licence-canada`: "The Information
Provider grants you a worldwide, royalty-free, perpetual, non-exclusive licence
to use the Information, including for commercial purposes, subject to the terms
below." The required attribution is "Contains information licensed under the
Open Government Licence – Canada." The LNHPD dataset page probed for this
inventory returned 404; the licence itself is the OGL page.

- May be used for: product purpose, dose, risk statements and medicinal-ingredient quantities, as set out in the existing LNHPD section.
- May not be used for: interaction severity; the LNHPD carries no interaction grading.
- Operation: a single API page is about 149 MB (`148904933` bytes in the manifest), so harvesting must stream rather than buffer.

### EMA HMPC

Licence identifier `ema-legal-notice`. Decisive terms from
`https://www.ema.europa.eu/en/about-us/about-website/legal-notice`: "Information
and documents made available on EMA's webpages are public and may be reproduced
and / or distributed, totally or in part, irrespective of the means and / or the
formats used, for non-commercial and commercial purposes, provided that EMA is
always acknowledged as the source of the material. Such acknowledgement must be
included in each copy of the material." The same notice says "Citations may be
made from such material without prior permission, provided the source is always
acknowledged."

- May be used for: monograph and herbal-medicine reference material, with EMA acknowledged in each copy.
- May not be used for: content supplied by third parties. The notice states that the permissions do not apply to content supplied by third parties, and that where copyright vests in a third party, reproduction permission must come from that holder.
- Entry point: `https://www.ema.europa.eu/en/human-regulatory-overview/herbal-medicinal-products` returned 200. `/en/medicines/herbal` and `/en/medicines/herbal/SLUG` return 404.

### Kew POWO

Verdict BLOCKED, for two independent reasons.

- Robots: `https://powo.science.kew.org/robots.txt`, served identically by `www.kew.org`, sets `Content-Signal: search=yes,ai-train=no,use=reference` and names `ClaudeBot`, `Claude-Web` and `anthropic-ai` under `Disallow: /`. That is an explicit refusal of AI-agent access by the publisher, and the Cloudflare challenge blocks a neutral non-AI client as well. Treated as a denial.
- Access: the home page, `/about` and `/api/2/search` returned a 403 Cloudflare challenge ("Performing security verification") to both a plain fetch and a headless Chromium render.
- Licence: the only Kew terms we could retrieve, at `https://www.kew.org/terms-of-use`, reserve all rights and grant no licence: "We are the owner or the licensee of all intellectual property rights in our Website and in the content published on it. Those works are protected by copyright laws and treaties around the world. All such rights are reserved." The same page says "Nothing contained in the Website shall be considered as granting any licence" and "You must not use any part of the content on our site for commercial purposes without obtaining a licence to do so from us or our licensors." The terms do carve out science data: "our pages containing science data and digital resources are governed by separate terms of use. Data and information on these pages are available under the Creative Commons Attribution Licence (CC-BY) and copyright The Trustees of the Royal Botanic Gardens, Kew." POWO is one of those pages, so a CC-BY grant very probably exists, but the POWO-specific terms page is where the licence version and the required attribution wording are stated, and that page sits behind the same bot wall. The licence therefore stays unevidenced at the standard this register sets: version and attribution unknown is not the same as cleared.

POWO must not be used, scraped or cited until its own terms are retrieved and
recorded here, either by reaching the POWO terms or API documentation through a
route Kew permits, or by Kew confirming the licence in writing. No fallback path
is acceptable: not a mirror, not an aggregator, not a cached copy.

### Rejected for licence

| Source    | Licence        | Decisive terms                                                                                                                                                                                                                                                                              | Why rejected                                                                                                                                                |
| --------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wikipedia | `cc-by-sa-4.0` | "Permission is granted to copy, distribute and/or modify Wikipedia's text under the terms of the Creative Commons Attribution-ShareAlike 4.0 International License"; modifications must be licensed "under the Creative Commons Attribution-ShareAlike 4.0 International License or later". | ShareAlike would force our derived prose under the same licence, consistent with the existing treatment of WHO and the non-commercial interaction datasets. |

This rejection is a policy decision by the site owner, not a legal conclusion.

### What this inventory does not settle

- Individual GBIF occurrence dataset licences. The inventory read one backbone record and one occurrence record; every dataset must be read on its own before use.
- The E-utilities manual. The usage guidelines page on the NCBI Bookshelf returned a reCAPTCHA interstitial. The 3 requests per second figure recorded above is taken from the general NCBI policies page, not from that manual.
- Document-level EMA reuse beyond the legal notice. The notice covers EMA webpages; individual documents may carry third-party rights.
- Register-only licence identifiers. The identifiers nlm-terms, ncbi-fair-use, cc0-1.0 and cc-by-sa-4.0 appear in this inventory only. They are not members of SOURCE_LICENCES, so no seed pair can declare them until validate.ts is extended in the same change, as the rule for adding a source requires.
- Client identity and robots. The robots directives above were read for an automated client. A production harvester should send its own identified user agent, respect any Crawl-delay, and not reuse a name the publisher has disallowed.
- No clearance here was reviewed by a lawyer.

## Per-pair provenance

Every pair in `data/interactions/<herb>.json` carries:

```jsonc
{
  "source": "EMA HMPC",
  "source_licence": "ema-legal-notice",
  "source_url": "https://www.ema.europa.eu/en/human-regulatory-overview/herbal-medicinal-products",
  // The older /en/medicines/herbal/... path now returns 404; cite the overview URL above.
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
