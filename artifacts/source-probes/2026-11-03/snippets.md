# Verbatim snippets — licence inventory, 2026-11-03

Every quotation below is copied from a saved file under
`artifacts/source-probes/2026-11-03/`. The file path precedes each quotation.
Where a source has no sentence for an expected term, the entry reads NOT FOUND.
Line breaks inside a saved HTML file are joined; robots files are quoted line
for line. Punctuation and spelling are otherwise unchanged.

## NCCIH

NOT FOUND — no licence, public-domain or reproduction sentence was present in
the saved NCCIH pages. The policy paths returned 404 and the NIH-wide page
returned a bot challenge:

**`artifacts/source-probes/2026-11-03/manifest.json`**

> `"key": "nccih-legal"`, `"status": 404`, `"url": "https://www.nccih.nih.gov/about/legal-information"`

> `"key": "nccih-policies"`, `"status": 404`, `"url": "https://www.nccih.nih.gov/about/policies"`

**`artifacts/source-probes/2026-11-03/manifest-round3.json`**

> `"key": "nccih-website-policies"`, `"status": 404`, `"url": "https://www.nccih.nih.gov/about/nccih-website-policies"`

> `"key": "nih-web-policies"`, `"status": 403`, `"url": "https://www.nih.gov/web-policies-notices"`, `"title": "Just a moment..."`

The two 200 pages were retrieved:

**`artifacts/source-probes/2026-11-03/manifest.json`**

> `"key": "nccih-home"`, `"status": 200`, `"url": "https://www.nccih.nih.gov/"`

> `"key": "nccih-herbs"`, `"status": 200`, `"url": "https://www.nccih.nih.gov/health/herbsataglance"`

## NCBI E-utilities and PubMed

**`artifacts/source-probes/2026-11-03/pages/nlm-terms.html`**

> Downloading data from the National Library of Medicine FTP servers indicates your acceptance of the following Terms and Conditions: No charges, usage fees or royalties are paid to NLM for this data.

> acknowledge NLM as the source of the data by including the phrase "Courtesy of the U.S. National Library of Medicine" in a clear and conspicuous manner,

> not indicate or imply that NLM has endorsed its products/services/applications.

**`artifacts/source-probes/2026-11-03/pages-round3/ncbi-policies.html`**

> Information that is created by or for the US government on this site is within the public domain. Public domain information on the National Library of Medicine (NLM) Web pages may be freely distributed and copied. However, it is requested that in any subsequent use of this work, NLM be given appropriate acknowledgment.

> NLM does not claim the copyright on the abstracts in PubMed; however, journal publishers or authors may.

> Make no more than 3 requests every 1 second.

The last sentence appears on the general NCBI policies page. It was not
cross-checked against the E-utilities usage guidelines, because that page
returned a reCAPTCHA interstitial:

**`artifacts/source-probes/2026-11-03/pages/ncbi-eutils-guidelines.html`**

> Checking your browser before accessing www.ncbi.nlm.nih.gov ...

**`artifacts/source-probes/2026-11-03/pages-round3/pubmed-disclaimer.html`**

> Content in NLM literature databases may be published by academic publishers or institutions, scholarly societies, or government and non-governmental organizations.

**`artifacts/source-probes/2026-11-03/pages-round3/robots-ncbi-eutils.txt`**

> # robots.txt - robot exclusion file - back-end server version - no robots!

> User-agent: *

> Disallow: /

**`artifacts/source-probes/2026-11-03/pages/ncbi-eutils-live.json`**

> `esearchresult.count`: `"3952"`

**`artifacts/source-probes/2026-11-03/manifest.json`**

> `"key": "pubmed-home"`, `"status": 200`, `"url": "https://pubmed.ncbi.nlm.nih.gov/"`

## PubChem

**`artifacts/source-probes/2026-11-03/pages-round3/pubchem-ftp-readme.txt`**

> Therefore, NCBI itself places no restrictions on the use or distribution of the data contained therein. However, some submitters of the original data may claim patent, copyright, or other intellectual property rights in all or a portion of the data they have submitted.

> NCBI is not in a position to assess the validity of such claims and, therefore, cannot provide comment or unrestricted permission concerning the use, copying, or distribution of the information contained in the molecular databases.

**`artifacts/source-probes/2026-11-03/pages/pubchem-live.json`**

> `IdentifierList.CID[0]`: `442793`

**`artifacts/source-probes/2026-11-03/rendered/r-pubchem-legal.txt`**

> Checking your browser before accessing pubchem.ncbi.nlm.nih.gov ...

**`artifacts/source-probes/2026-11-03/pages-round3/robots-pubchem.txt`**

> User-agent: GPTBot
> User-agent: ClaudeBot
> User-agent: Amazonbot
> User-agent: CCBot
> Disallow: /

> Crawl-delay: 5

> Allow: /interactive/rest/pug/periodictable/
> Allow: /interactive/rest/pug/sourcetable/
> Allow: /rest/pug/periodictable/
> Allow: /rest/pug/sourcetable/

> # These are voluntary crawler instructions, not authentication, a universal
> # prohibition on reuse, or a guarantee against training by unlisted agents.

NOT FOUND — no licence sentence was retrievable from
`https://pubchem.ncbi.nlm.nih.gov/docs/legal-notices` or
`https://pubchem.ncbi.nlm.nih.gov/docs/downloads`; both returned the reCAPTCHA
interstitial.

## USDA PLANTS

NOT FOUND — no licence, public-domain or reproduction sentence was present in
the saved USDA pages. The policy page returned Access Denied and the NRCS host
timed out:

**`artifacts/source-probes/2026-11-03/pages-round3/usda-policies.html`**

> You don't have permission to access "http://www.usda.gov/policies-and-links" on this server.

**`artifacts/source-probes/2026-11-03/manifest-round3.json`**

> `"key": "nrcs-policies"`, `"status": 0`, `"error": "fetch failed (TimeoutError: The operation was aborted due to timeout); curl --http1.1 retry failed: Error: Command failed: ... curl: (28) Operation timed out after 60061 milliseconds with 0 bytes received"`

**`artifacts/source-probes/2026-11-03/pages/usda-plants-home.html`**

> <plants-app></plants-app>

**`artifacts/source-probes/2026-11-03/rendered/r-usda-plants-home.txt`**

> An official website of the United States government

**`artifacts/source-probes/2026-11-03/rendered/r-usda-plants-profile.txt`**

> Copyright:(c) 2014 Esri | USDA-NRCS-NGCE & NPDT

> Zingiber officinale Roscoe

## GBIF

**`artifacts/source-probes/2026-11-03/pages-round2/gbif-backbone-api.json`**

> `license`: `http://creativecommons.org/licenses/by/4.0/legalcode`

> `title`: `GBIF Backbone Taxonomy`

> `citation.text`: `GBIF Secretariat (2023). GBIF Backbone Taxonomy. Checklist dataset https://doi.org/10.15468/39omei accessed via GBIF.org on 2026-11-03.`

**`artifacts/source-probes/2026-11-03/pages-round2/gbif-occurrence-api.json`**

> `results[0].license`: `http://creativecommons.org/licenses/by/4.0/legalcode`

> `count`: `2225520`

**`artifacts/source-probes/2026-11-03/pages/gbif-live.json`**

> `scientificName`: `Zingiber officinale Roscoe`

> `status`: `ACCEPTED`

**`artifacts/source-probes/2026-11-03/rendered/r-gbif-terms.txt`**

> Performing security verification

> This website uses a security service to protect against malicious bots. This page is displayed while the website verifies you are not a bot.

**`artifacts/source-probes/2026-11-03/pages-round3/robots-gbif-api.txt`**

> User-agent: *
> # Block unsigned images
> Disallow: /v1/image/unsafe

NOT FOUND — no GBIF terms or citation-guidelines sentence was retrievable from
`https://www.gbif.org/terms`, `https://www.gbif.org/citation-guidelines` or the
dataset page; all three returned a 403 Cloudflare challenge.

## Wikidata

**`artifacts/source-probes/2026-11-03/pages/wikidata-licensing.html`**

> All structured data (i.e. the main, Property, Lexeme, and EntitySchema namespaces) is released into the public domain under Creative Commons Zero. Text in other namespaces is copyrighted and available under the Creative Commons Attribution-ShareAlike 4.0 License.

> All structured data from the main, Property, Lexeme, and EntitySchema namespaces is available under the Creative Commons CC0 License; text in the other namespaces is available under the Creative Commons Attribution-ShareAlike License; additional terms may apply.

**`artifacts/source-probes/2026-11-03/pages/wikidata-live.json`**

> `search[0].id`: `Q35625`

> `search[0].display.label.value`: `ginger`

## Health Canada LNHPD

**`artifacts/source-probes/2026-11-03/pages-round3/ogl-canada.html`**

> The Information Provider grants you a worldwide, royalty-free, perpetual, non-exclusive licence to use the Information, including for commercial purposes, subject to the terms below.

> Contains information licensed under the Open Government Licence – Canada.

**`artifacts/source-probes/2026-11-03/manifest.json`**

> `"key": "lnhpd-live"`, `"status": 200`, `"bytes": 148904933`, `"error": "body of 148904933 bytes exceeds 8388608 byte save limit; not saved"`

> `"key": "lnhpd-dataset"`, `"status": 404`, `"url": "https://open.canada.ca/data/en/dataset/d8a2b7d4-1bf7-4d0c-9c0e-000000000000"`

> `"key": "lnhpd-licence-page"`, `"status": 200`, `"url": "https://health-products.canada.ca/lnhpd-bdpsnh/info?licence=80000001"`

NOT FOUND — the LNHPD dataset page itself returned 404, so the OGL quote above
comes from the licence page, not from a dataset record.

## EMA HMPC

**`artifacts/source-probes/2026-11-03/pages/ema-legal.html`**

> Information and documents made available on EMA's webpages are public and may be reproduced and / or distributed, totally or in part, irrespective of the means and / or the formats used, for non-commercial and commercial purposes, provided that EMA is always acknowledged as the source of the material. Such acknowledgement must be included in each copy of the material.

> Citations may be made from such material without prior permission, provided the source is always acknowledged.

> The above-mentioned permissions do not apply to content supplied by third parties. Therefore, for documents where the copyright vests in a third party, permission for reproduction must be obtained from this copyright holder.

**`artifacts/source-probes/2026-11-03/pages-round2/ema-hmpc-overview.html`**

> The Committee on Herbal Medicinal Products (HMPC) issues scientific opinions on herbal substances and preparations, along with information on recommended uses and safe conditions, on behalf of the European Medicines Agency (EMA).

**`artifacts/source-probes/2026-11-03/manifest.json`**

> `"key": "ema-herbal"`, `"status": 404`, `"url": "https://www.ema.europa.eu/en/medicines/herbal"`

> `"key": "ema-monograph"`, `"status": 404`, `"url": "https://www.ema.europa.eu/en/medicines/herbal/zingiberis-officinalis-rhizoma"`

**`artifacts/source-probes/2026-11-03/manifest-round2.json`**

> `"key": "ema-hmpc-overview"`, `"status": 200`, `"url": "https://www.ema.europa.eu/en/human-regulatory-overview/herbal-medicinal-products"`

## Kew POWO

**`artifacts/source-probes/2026-11-03/pages-round3/robots-powo.txt`**

> User-agent: *
> Content-Signal: search=yes,ai-train=no,use=reference
> Allow: /

> User-agent: ClaudeBot
> Disallow: /

> User-agent: anthropic-ai
> Disallow: /

> User-agent: Claude-Web
> Disallow: /

**`artifacts/source-probes/2026-11-03/rendered/r-kew-terms.txt`**

> We are the owner or the licensee of all intellectual property rights in our Website and in the content published on it. Those works are protected by copyright laws and treaties around the world. All such rights are reserved.

> Nothing contained in the Website shall be considered as granting any licence or as a given right to use our trademark.

> You must not use any part of the content on our site for commercial purposes without obtaining a licence to do so from us or our licensors.

> Some of the content of our Website is available under specific licence terms. For example, our pages containing science data and digital resources are governed by separate terms of use.

**`artifacts/source-probes/2026-11-03/rendered/r-powo-home.txt`**

> powo.science.kew.org
> Performing security verification

> This website uses a security service to protect against malicious bots. This page is displayed while the website verifies you are not a bot.

**`artifacts/source-probes/2026-11-03/rendered/r-powo-api.txt`**

> Performing security verification

**`artifacts/source-probes/2026-11-03/manifest.json`**

> `"key": "powo-home"`, `"status": 403`, `"title": "Just a moment..."`

> `"key": "powo-live"`, `"status": 403`, `"url": "https://powo.science.kew.org/api/2/search?q=Zingiber%20officinale&limit=1"`

> `"key": "powo-about"`, `"status": 403`, `"url": "https://powo.science.kew.org/about"`

## Wikipedia (rejected)

**`artifacts/source-probes/2026-11-03/pages-round2/wikipedia-copyrights.html`**

> Permission is granted to copy, distribute and/or modify Wikipedia's text under the terms of the Creative Commons Attribution-ShareAlike 4.0 International License and, unless otherwise noted, the GNU Free Documentation License, unversioned, with no invariant sections, front-cover texts, or back-cover texts.

> If you make modifications or additions to the page you re-use, you must license them under the Creative Commons Attribution-ShareAlike 4.0 International License or later.

> Each copy or modified version that you distribute must include a licensing notice stating that the work is released under CC BY-SA and either a) a hyperlink or URL to the text of the license or b) a copy of the license.
