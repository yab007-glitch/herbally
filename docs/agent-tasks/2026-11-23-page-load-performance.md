# Task brief — HerbAlly page load performance (2026-11-23)

Repo `/Users/yasser/herbally`; production `https://herbally.app`; DB access as in
`docs/agent-tasks/2026-11-23-remaining-content.md`.

## Why

Cloudflare Web Analytics (real browsers, bots excluded) for `herbally.app`:

| Window    | Page load time | LCP good / needs improvement / poor |
| --------- | -------------- | ----------------------------------- |
| Last 24 h | 2,396 ms       | 93 % / 4 % / 4 %                    |
| Last 7 d  | 2,786 ms       | 79 % / 9 % / 12 %                   |
| Last 30 d | 3,002 ms       | 82 % / 7 % / 11 %                   |

Roughly one load in nine has a **poor LCP**, and median page load is ~3 s. That hurts both
ranking and the AdSense quality signal.

## Measured baseline (2026-11-23, production)

Home `/`:

- TTFB 0.21 s, total 0.24 s, HTML 79 KB

Herb page `/herbs/turmeric`:

- TTFB 0.45 s, total 0.52 s, **HTML 272 KB**
- **152 KB of inline `<script>`**, 43 script tags, largest single inline script **55 KB**
- 8 `self.__next_f` flight rows
- only 2 `<img>` tags, **0 `srcset` attributes**, **0 `fetchpriority="high"`**, 5 preloads
- hero photo is a remote Wikimedia URL

Directory `/herbs`:

- TTFB 0.22 s, total 0.29 s, HTML 276 KB

TTFB is healthy. The weight is the document itself: serialized RSC/flight payload plus
inline scripts. That is the first thing to fix; images are secondary but still
unoptimised on herb pages (no srcset, no priority hint).

## Order of work

### 1. Find what is being serialized into the herb page

The herb page passes the whole page bundle through server components. Look for client
components receiving large objects (herb row with all translations, citations, FAQs,
related herbs, regulatory rows, PubMed sheet, interactions) when they only need a few
fields.

- Identify the biggest contributors to the 152 KB inline script / flight payload.
- Pass only the fields each client component uses; keep server-only data on the server.
- Do not remove content that is actually rendered — reduce the serialized copy, not the page.
- Target: herb page HTML **≤ 150 KB** (roughly 45 % smaller), with no visual change.

### 2. Hero image

- Confirm whether the LCP element is the herbal photo.
- Serve it through `next/image` with a real `srcset`, correct `sizes`, and
  `priority` / `fetchpriority="high"` only on the one LCP image.
- No other image on the page should be `priority`.
- Check the Wikimedia original is not being served at full resolution on mobile.

### 3. Fonts and third-party

- Check font loading (self-hosted vs remote, `display`, preload count).
- Check ads/consent scripts: they must not block first paint. Do **not** remove AdSense,
  consent, or analytics; defer or lazy-load them if they are render-blocking.
- Check whether the chat widget or any other client bundle loads on first paint when it
  is not needed.

### 4. Add a budget so this does not regress

- Add one test that renders a herb page (or the metadata/route handler used to build it)
  and asserts the serialized document stays under a generous ceiling, e.g. 200 KB, with
  the measured value printed so the number is visible in CI.
- Keep it stable: assert a range that will not flake on wording changes.

## Measurement (do this, do not guess)

Before and after, capture for **four URLs**: `/`, `/herbs/turmeric`,
`/fr/herbs/turmeric`, `/herbs`.

- Document size, inline-script KB, script-tag count (parse the HTML).
- TTFB and total time (curl).
- If a headless Chrome is available, run Lighthouse mobile (throttled) or at minimum
  PerformanceObserver LCP/CLS through the existing Playwright setup; record LCP, CLS, TBT.
- After deploy, re-read Cloudflare Web Analytics for the 24 h window and report it, but
  note that p75 needs a day of traffic to move — do not claim a win from one hour of data.

## Targets

- Herb page HTML ≤ 150 KB; at worst ≤ 200 KB.
- Median page load under 2 s on the Web Analytics measure.
- LCP "poor" share under 5 %.
- CLS unchanged or better; no layout shift introduced.
- No visual regression on the herb page (photo, byline, citations, FAQ, ads slot).

## Guardrails

- **Do not** remove or disable ads, consent, analytics, or the chat widget to win a
  number. Defer them instead.
- **Do not** change copy, medical content, robots directives, or the "Reviewed and
  verified" line.
- Keep every page indexable.
- Run `npx tsc --noEmit`, `npx vitest run`, `npx eslint` on changed files before each
  commit; commit in small logical units and push.
- Verify on the live site after deploy; if the Cloudflare edge serves a stale copy, note
  it rather than concluding the fix failed.

## Report

State, per URL and per metric: before → after, what actually changed in the payload, what
you deliberately did not touch, and the residual bottleneck you could not fix without a
redesign.
