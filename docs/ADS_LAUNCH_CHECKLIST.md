# AdSense launch checklist — prerequisites and blockers

Status: **ads are NOT live. The hard gate is OFF** (`ADS_LAUNCH_GATE` in
`src/lib/ads/policy.ts` is `false`). Nothing in this document authorizes a
launch; only the site owner can.

This checklist is the contract the code enforces. Every item below is a
prerequisite for flipping the gate, and each one is either **verified**,
**open**, or **blocked on someone other than code**.

---

## 1. What the code now guarantees (locally verified; the gate is OFF unless a row says otherwise)

| Guarantee                                                 | Where it lives                                              | How it is enforced                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No ad markup, no provider script, no ad-network request   | `ad-slot.tsx`                                               | Gate is checked before anything else; the `<script>` is created only after gate + identifiers + page class + document origin + consent + region all pass.                                                                                                                                         |
| No ad origin in any sensitive document's CSP              | `src/lib/ads/csp.ts`, `src/proxy.ts`                        | `adsCspHosts()` returns `[]` unless `gate && isAdEligiblePath(path)`. Chat, checker, calculator, symptoms, compare, garden, profile, admin, auth, API never receive an ad origin.                                                                                                                 |
| One CSP per response (no silent intersection)             | `next.config.ts`                                            | Config-level `headers()` no longer sets `Content-Security-Policy`; the proxy is the single owner. Two policies on one response are intersected by the browser, which would have blocked ads even with the gate on.                                                                                |
| No ad script can survive navigation into a health tool    | `document-state.ts`, `ad-slot.tsx`, `ad-document-guard.tsx` | Ads require the document to have been _born_ at an ad-eligible path. Once a provider script is active, internal link clicks are upgraded to real document navigations, and a programmatic route change to a non-ad-eligible path forces one reload.                                               |
| No document holds an ad unit and a health-query input     | `floating-chat-button.tsx`                                  | The floating chat launcher is not rendered on ad-eligible paths while the gate is on. Ads and the chat only ever meet across a document navigation.                                                                                                                                               |
| No ad request before an explicit opt-in                   | `consent.ts`, `ad-consent.tsx`                              | Cookie holds `v1:granted` / `v1:denied` only. Reject is offered next to Allow; revoke is always reachable from the footer control. A revoke after a script loaded reloads the document, because unmounting cannot unload third-party code.                                                        |
| EEA / UK / CH consent comes from Google's consent message | `policy.ts`, `cmp.ts`, `ad-cmp.tsx`                         | Funding Choices is the CMP for the `eea` region. Ads there require it to report **both** `ad_storage` and `ad_user_data` granted; loading, absent or denied reads as `cmp-missing` / `cmp-denied` and blocks. The first-party banner never renders in those regions and is never a consent basis. |
| Consent Mode v2 defaults ship before any Google tag       | `cmp-bootstrap.tsx`, `cmp.ts`                               | A server component emits the inline default in the document HTML — ad, analytics and personalization storage denied, `security_storage` granted, `wait_for_update: 500` — so no tag can race an unset default. It renders only while the gate is on and a client is configured.                   |
| Global Privacy Control outranks every stored choice       | `policy.ts`, `ad-slot.tsx`                                  | `navigator.globalPrivacyControl === true` returns `gpc-opt-out` before the region, CMP and first-party consent checks. Only an explicit `true` opts out; missing or malformed values are never permission.                                                                                        |
| Launch gate cannot be switched by deploy config           | `policy.ts`                                                 | The gate is a hard-coded `boolean` constant, deliberately not an environment variable. A production build with `NEXT_PUBLIC_ADSENSE_CLIENT` and `NEXT_PUBLIC_ADSENSE_SLOT_HERB` set still renders nothing.                                                                                        |

Tests covering these guarantees live in `src/lib/ads/__tests__/`,
`src/components/ads/__tests__/`, `src/app/api/ads/__tests__/`,
`src/components/layout/__tests__/floating-chat-button.test.tsx`, and
`src/__tests__/ads-proxy.test.ts`.

---

## 2. Blockers that code cannot clear

### 2.1 AdSense approval is not verified — **OPEN**

Last observed console state was “Getting ready”. Ads must not be enabled on an
unapproved account. Action: confirm approval in the AdSense console and record
the date and the approving account.

2026-11-15: the site had no ownership signal at all, which stalls the review.
`src/app/[locale]/layout.tsx` now emits
`<meta name="google-adsense-account" content="ca-pub-1901058826905247">` on every
page. This is a verification tag only — it loads no script, makes no request
and shows no ad, so the launch gate stays off and this item stays OPEN until
the console reports approval.

Verified live on 2026-11-15 (deploy `3b72875`): the tag is present in the
server HTML of `/fr` and the herb pages. The console still reads "Getting
ready"; nothing further can be done from this side.

### 2.2 ads.txt — **VERIFIED (file), re-verify after approval**

`public/ads.txt` contains
`google.com, pub-1901058826905247, DIRECT, f08c47fec0942fa0`. It is served at
`/ads.txt` and is excluded from locale routing. Re-verify against the live
domain after any publisher-ID change.

### 2.3 EEA / UK / CH consent — **VERIFIED locally, live message unclicked**

The region is now wired to Google's own consent message (Funding Choices).
`cmp.ts` loads the message on ad-eligible documents and reads `window.googlefc`;
`policy.ts` allows an `eea` ad only when the CMP reports both `ad_storage` and
`ad_user_data` granted. No ad request is made before it reports a grant:
loading, absent and denied all fail closed. The first-party banner is still not
a certified CMP and is never a consent basis there. Evidence, including the
gate-on harness: `docs/ADS_CMP_EVIDENCE.md`.

### 2.4 Origin-storage isolation — **OPEN, owner decision required**

A third-party script running in a document on `herbally.app` executes with the
app origin's privileges. While ads are off this is moot. Before launch the
owner must choose one of:

- (a) accept that an ad script could read non-HttpOnly Supabase auth cookies
  and `localStorage` garden/notes data, and document that acceptance; or
- (b) move ad-bearing pages to a separate origin/subdomain so ad code never
  shares an origin with authenticated app state; or
- (c) make the authenticated surfaces same-site-but-cross-origin and move all
  auth state to HttpOnly cookies.

Document isolation does **not** isolate origin storage. This is the single
largest remaining privacy question.

### 2.5 Google policy review of the content — **OPEN**

Health content is a sensitive category. Ad serving may be limited or refused on
medical pages, and personalized ads on health topics carry additional
restrictions. The implementation already requests non-personalized ads
(`requestNonPersonalizedAds = 1`) and places units only on public herb
reference pages. Action: confirm the site passes AdSense program policies and
that no unit sits next to symptom/dosage interaction controls.

### 2.6 Consent record and legal review — **OPEN**

The cookie stores only the choice (`v1:granted` / `v1:denied`), with no
identifier and no timestamp, so it is not a consent _record_ in the
GDPR/Quebec Law 25 evidentiary sense. If the owner needs an audit trail, that is
a separate, deliberate design change (and a privacy trade-off).

### 2.7 Gate-on network proof — **VERIFIED locally**

`E2E_GATE_ON=1 npx playwright test e2e/ads.spec.ts --project=chromium` runs the
ten gate-on tests (A to J) against a disposable copy of the repository in the
gitignored `.e2e-gate-on/app`. The harness flips `ADS_LAUNCH_GATE` only in that
copy, hard-links `node_modules`, builds for production and serves it on
`127.0.0.1:3100`; it refuses to run unless the committed `policy.ts` still
contains the shipped `false` constant. The gate-on run passed 10 and skipped
the 5 gate-off tests; the gate-off run passed 5 and skipped the 10 gate-on
tests. Evidence: `docs/ADS_CMP_EVIDENCE.md` and `docs/evidence/`.

---

## 3. Flipping the gate (owner-authorized only)

1. Confirm 2.1, 2.3, 2.4, 2.5 are closed and recorded here.
2. Set `NEXT_PUBLIC_ADSENSE_CLIENT` (`ca-pub-…`) and
   `NEXT_PUBLIC_ADSENSE_SLOT_HERB` (numeric slot) in the deployment environment.
3. Flip `ADS_LAUNCH_GATE` to `true` in `src/lib/ads/policy.ts` — a code change,
   reviewed like any other.
4. Verify on the deployed build, in this order:
   - `/herbs/<slug>` HTML contains **no** `adsbygoogle` script element before
     consent (the script is created client-side only after opt-in);
   - `/herbalist`, `/calculator`, `/interactions`, `/symptoms`, `/garden`,
     `/admin` responses contain **no** ad origin in `Content-Security-Policy`;
   - `/api/ads/region` returns `row` for a non-EEA vantage point and `eea` via
     an EEA proxy, with `Cache-Control: private, no-store`;
   - clicking a link from an ad-bearing herb page performs a full document
     navigation (no client-side route change);
   - rejecting consent makes zero requests to `pagead2.googlesyndication.com`
     (network panel, fresh profile);
   - the consent message script must load on a herb page and no ad request may
     exist before it reports a grant;
   - `navigator.globalPrivacyControl === true` must yield zero ad requests even
     with a stored grant;
   - revoking after granting reloads the document and leaves no ad request.
5. Watch for a week: ad requests, CLS, and any health-tool page that starts
   contacting an ad host.

## 4. Rollback

Set `ADS_LAUNCH_GATE` back to `false` and redeploy. This removes the provider
hosts from every CSP and stops the consent UI and the ad slot from doing
anything at all; no cookie cleanup is required (the cookie is inert).
