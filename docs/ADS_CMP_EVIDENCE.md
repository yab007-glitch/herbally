# Ads / CMP evidence — card t_eba10738, gate 2 items 2.1–2.7

Status: **ads are NOT live.** `ADS_LAUNCH_GATE` in `src/lib/ads/policy.ts` is
hard-coded `false` in the committed source and on this branch. Everything in
this document is a **local harness proof**: it is not a production deployment,
not an AdSense console change and not a launch authorisation.

- Card: `t_eba10738`, gate 2 items 2.1 to 2.7
- Branch: `feat/ads-cmp-gate-on-e2e`
- Base commit: `bc59a8cd43042756df96e688f931a23fe96fc5f4`
- Date: 2026-11-16, America/Toronto

## Verification summary

| Check            | Command                                                                            | Result                                               |
| ---------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Typecheck        | `npx tsc --noEmit -p tsconfig.json`                                                | exit 0, no output                                    |
| Unit tests       | `npx vitest run src/lib/ads src/components/ads`                                    | 11 files, 103 tests passed, exit 0                   |
| Gate-off e2e     | `npx playwright test e2e/ads.spec.ts --project=chromium`                           | 5 passed, 10 skipped, exit 0                         |
| Gate-on e2e      | `E2E_GATE_ON=1 npx playwright test e2e/ads.spec.ts --project=chromium`             | 10 passed, 5 skipped, exit 0, including tests A to J |
| CMP loader probe | HTTPS `GET https://fundingchoicesmessages.google.com/i/pub-1901058826905247?ers=1` | HTTP 200                                             |

The 10 gate-on tests skip unless `E2E_GATE_ON` is `1`. The 5 gate-off tests
skip when it is.

## Gate-on harness

The gate-on run is driven by `scripts/e2e-gate-on-server.mjs`, which Playwright
starts as its web server when `E2E_GATE_ON=1`. The harness:

1. copies the repository into the gitignored directory `.e2e-gate-on/app`;
2. flips the constant **only inside that copy**;
3. hard-links `node_modules` into the copy;
4. runs a production build and serves it on `127.0.0.1:3100`;
5. refuses to run unless the committed policy file still contains the shipped
   `false` constant.

The committed tree is never patched, and the stamp used to reuse a cached build
now hashes the content of the working tree (`git diff HEAD --binary`) as well as
`git status --porcelain`. The `.e2e-gate-on/` directory is excluded from git.

## Scenario results

All scenarios below ran against the gate-on harness. Tests other than D pin the
visitor to the US with `x-vercel-ip-country: US`; test D overrides it to `DE`.

- **Test A — `/herbs/ginger`, no stored choice, US.** Ad-network requests:
  `[]`. The consent message script element is present with the loader URL
  `https://fundingchoicesmessages.google.com/i/pub-1901058826905247?ers=1`.
- **Test B — same page, stored grant.** Exactly one ad request:
  `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1901058826905247`.
  An `ins.adsbygoogle` element is present, and a Consent Mode v2 update reports
  `ad_storage` and `ad_user_data` granted.
- **Test C — stored denial.** Ad-network requests: `[]`.
- **Test D — EEA (Germany), stored grant.** Ad-network requests: `[]` and no ad
  unit. A first-party grant cannot substitute for the CMP.
- **Test E — stored grant plus `navigator.globalPrivacyControl === true`.**
  Ad-network requests: `[]`.
- **Test F — `/herbalist`, stored grant.** Ad-network requests: `[]`.
- **Test G — `/calculator`, stored grant.** Ad-network requests: `[]`.
- **Test H — granted herb document, then click to `/herbalist`.** Two
  same-origin document loader ids: initial
  `5EADA14DB3082CD3F33F58D40F2A6AA6`, destination
  `8EC236555A994E714D12776D393CB0A9`. Every ad request belongs to the outgoing
  document, and none has a timestamp after the destination document started.
- **Test J — same with `/calculator`.** Initial loader id
  `FA7B0999DC3A8581C76D56396681CBCE`, destination
  `8B96D5748FE180EE5CA2A77CB740370D`. Same zero-crossing assertion: every ad
  request belongs to the outgoing document, and none has a timestamp after the
  destination document started.
- **Test I — revocation through the footer Ad settings control, then Turn off
  ads.** The document reloads with a new loader id, and no ad request has a
  timestamp after the reload document started. `document.cookie` contains
  `v1:denied`.

## Item mapping

The card's gate 2 numbering is used here; it is not the section numbering of
`docs/ADS_LAUNCH_CHECKLIST.md`.

| Item | Acceptance criterion                                                                        | Evidence                                                                                                                                                                                                                                                                                                                                               | Result                                                                               |
| ---- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| 2.1  | CMP live and serving on ad-eligible documents                                               | The loader probe returned HTTP 200 for the publisher loader, and test A found the consent message script element with that loader URL on `/herbs/ginger`.                                                                                                                                                                                              | Met in the gate-on harness.                                                          |
| 2.2  | EEA / UK / CH handling: no ad request before consent for those regions                      | Test D (Germany with a stored first-party grant) recorded zero ad requests and no ad unit, and the policy unit tests cover `eea` with cmp denied, missing and granted.                                                                                                                                                                                 | Met.                                                                                 |
| 2.3  | Consent Mode v2 signals wired                                                               | `cmp-bootstrap.tsx` emits the default state in the document HTML, test B observed a consent update with `ad_storage` and `ad_user_data` granted after opt-in, and `cmp.test.ts` covers the default and update builders.                                                                                                                                | Met.                                                                                 |
| 2.4  | US-state handling and Global Privacy Control honoured                                       | Test E (stored grant plus `navigator.globalPrivacyControl === true`) recorded zero ad requests, and `policy.test.ts` covers the opt-out precedence. Note: there is no per-state list — every row region uses explicit opt-in, GPC is honoured as a browser-level opt-out, and ads are requested as non-personalised (`requestNonPersonalizedAds = 1`). | Met as implemented; the legal read of per-state rules is out of scope for this card. |
| 2.5  | Pre-consent blocking proven at the network boundary with the gate ON                        | Test A: zero ad-network requests before consent.                                                                                                                                                                                                                                                                                                       | Met.                                                                                 |
| 2.6  | Revocation proven the same way                                                              | Test I: the document reloads, no ad request is observed after the reload document started, and the cookie becomes `v1:denied`.                                                                                                                                                                                                                         | Met.                                                                                 |
| 2.7  | Live loaderId plus zero-ad-request proof on `/herbalist` and `/calculator` with the gate on | The live AdSense loader request in test B, zero ad requests in tests F and G, and new document loader ids with zero crossing in tests H and J.                                                                                                                                                                                                         | Met.                                                                                 |

## Evidence files

- `docs/evidence/ads-gate-on-network-e2e-2026-11-16.log`
- `docs/evidence/ads-gate-off-network-e2e-2026-11-16.log`
- `docs/evidence/ads-unit-tests-2026-11-16.log`
- `docs/evidence/ads-typecheck-2026-11-16.txt`
- `docs/evidence/cmp-loader-probe-2026-11-16.txt`

## What this does not prove

Production still serves the gate-off build, so the consent message and the ad
slot are not served on herbally.app today. The live Funding Choices message UI
was not clicked, so the granted path for EEA readers is covered by unit tests
that stub `window.googlefc`, not by a live message. Firefox and WebKit were not
run locally (Chromium only), though CI runs the gate-off suite on chromium and
firefox. The origin-storage decision (2.9), legal review (2.10), AdSense
approval and the owner release authorisation are untouched and still open.
