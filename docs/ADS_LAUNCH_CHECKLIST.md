# AdSense launch checklist — prerequisites and blockers

Status: **ads are NOT live. The hard gate is OFF** (`ADS_LAUNCH_GATE` in
`src/lib/ads/policy.ts` is `false`). Nothing in this document authorizes a
launch; only the site owner can.

This checklist is the contract the code enforces. Every item below is a
prerequisite for flipping the gate, and each one is either **verified**,
**open**, or **blocked on someone other than code**.

---

## 1. What the code now guarantees (locally verified, gate OFF)

| Guarantee | Where it lives | How it is enforced |
| --- | --- | --- |
| No ad markup, no provider script, no ad-network request | `ad-slot.tsx` | Gate is checked before anything else; the `<script>` is created only after gate + identifiers + page class + document origin + consent + region all pass. |
| No ad origin in any sensitive document's CSP | `src/lib/ads/csp.ts`, `src/proxy.ts` | `adsCspHosts()` returns `[]` unless `gate && isAdEligiblePath(path)`. Chat, checker, calculator, symptoms, compare, garden, profile, admin, auth, API never receive an ad origin. |
| One CSP per response (no silent intersection) | `next.config.ts` | Config-level `headers()` no longer sets `Content-Security-Policy`; the proxy is the single owner. Two policies on one response are intersected by the browser, which would have blocked ads even with the gate on. |
| No ad script can survive navigation into a health tool | `document-state.ts`, `ad-slot.tsx`, `ad-document-guard.tsx` | Ads require the document to have been *born* at an ad-eligible path. Once a provider script is active, internal link clicks are upgraded to real document navigations, and a programmatic route change to a non-ad-eligible path forces one reload. |
| No document holds an ad unit and a health-query input | `floating-chat-button.tsx` | The floating chat launcher is not rendered on ad-eligible paths while the gate is on. Ads and the chat only ever meet across a document navigation. |
| No ad request before an explicit opt-in | `consent.ts`, `ad-consent.tsx` | Cookie holds `v1:granted` / `v1:denied` only. Reject is offered next to Allow; revoke is always reachable from the footer control. A revoke after a script loaded reloads the document, because unmounting cannot unload third-party code. |
| EEA / UK / CH are excluded | `policy.ts`, `src/app/api/ads/region/route.ts` | Coarse region (`row` / `eea` / `unknown`) from `x-vercel-ip-country` / `cf-ipcountry`. `eea` and `unknown` block ads and render no consent banner (a custom banner is not a certified CMP). The endpoint returns no country code and is `no-store`. |
| Launch gate cannot be switched by deploy config | `policy.ts` | The gate is a hard-coded `boolean` constant, deliberately not an environment variable. A production build with `NEXT_PUBLIC_ADSENSE_CLIENT` and `NEXT_PUBLIC_ADSENSE_SLOT_HERB` set still renders nothing. |

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

### 2.2 ads.txt — **VERIFIED (file), re-verify after approval**
`public/ads.txt` contains
`google.com, pub-1901058826905247, DIRECT, f08c47fec0942fa0`. It is served at
`/ads.txt` and is excluded from locale routing. Re-verify against the live
domain after any publisher-ID change.

### 2.3 EEA / UK / CH consent — **BLOCKED on a Google-certified CMP**
Google's EU user consent policy requires a Google-certified CMP for ads served
to those regions. HerbAlly's own banner is not one, and must not be described
as one. Until a certified CMP is integrated, the region gate keeps ads off for
EEA/UK/CH, and the consent UI renders nothing there. Do not "fix" this by
softening `regionForCountry`.

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
identifier and no timestamp, so it is not a consent *record* in the
GDPR/Quebec Law 25 evidentiary sense. If the owner needs an audit trail, that is
a separate, deliberate design change (and a privacy trade-off).

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
   - revoking after granting reloads the document and leaves no ad request.
5. Watch for a week: ad requests, CLS, and any health-tool page that starts
   contacting an ad host.

## 4. Rollback

Set `ADS_LAUNCH_GATE` back to `false` and redeploy. This removes the provider
hosts from every CSP and stops the consent UI and the ad slot from doing
anything at all; no cookie cleanup is required (the cookie is inert).
