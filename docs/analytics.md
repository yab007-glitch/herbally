# Analytics and the funnel report

HerbAlly uses **Vercel Web Analytics only**. No third-party tracker, pixel, or
sponsor tag is present, and none should be added: the site is health content and
the ads slot stays fail-closed (`src/components/ads/ad-slot.tsx`).

## What is measured

Page views come from the SDK's automatic tracking. Four custom events measure
the funnel, plus one language event that already existed:

| Event | Fires when | Properties |
|---|---|---|
| `calculator_used` | the dose calculator returns a number, or the age gate blocks one | `formula` (closed set), `outcome` = `computed` \| `blocked` |
| `interaction_checked` | a herb–drug pair page is opened and hydrated | `trigger` = `pair_page` \| `expand_table` |
| `chat_message_sent` | a question is sent to the virtual herbalist | `hasHerbContext` (boolean) |
| `outbound_click` | a click leaves the site (delegated listener) | `target` = `donation` \| `sponsor` \| `affiliate` \| `external`, `host` (hostname only) |
| `language_changed` | the visitor switches language | `locale`, `source` (both closed sets) |

**Nothing else is sent.** `src/lib/analytics.ts` enforces an event allowlist and
a per-event property allowlist; closed-domain values are rejected if they are
off-list. A caller that passes a herb slug, a drug name, a symptom, an age, a
weight, a dose or free text sees the property silently dropped. Message text,
search text and page query strings are never transmitted.

## Consent

Vercel Analytics is first-party and cookieless: no cookies, no localStorage
identifier, no cross-site profile, no fingerprinting.

The same consent decision gates both page views and events:

- `navigator.globalPrivacyControl === true` → nothing is sent.
- `navigator.doNotTrack` of `1`/`yes` → nothing is sent.
- `localStorage["herbally:analytics-opt-out"] = "1"` → nothing is sent.
- Storage is unreadable (throttled/blocked) → fail closed, nothing is sent.

Page views are gated in `src/components/analytics/vercel-analytics.tsx` through
the SDK's `beforeSend`, which returns `null` to drop the event. Custom events
are gated a second time inside `trackEvent()`. `web-vitals.tsx` applies the same
check before posting field metrics.

The privacy policy (`privacy.analytics` in both dictionaries) describes exactly
these feature counts and says GPC/DNT are honoured. Keep the two in sync.

## Why the dashboard used to show zero events

`window.va` is the SDK's *function* queue stub — `window.va.track` never
existed, so the old helper's call was swallowed by its own try/catch and no
custom event ever left the browser. Use `track()` from `@vercel/analytics`;
never hand-roll `window.va` calls.

Verified 29 Oct 2026: one probe event (`hermes_pipeline_probe`) was sent from
production and appeared in the query API with a count of 1, proving the
end-to-end pipeline on the current Pro team. It is the only non-product event in
the data.

## The weekly report

```bash
node scripts/analytics-weekly-report.mjs --days 7
node scripts/analytics-weekly-report.mjs --days 30 --out ~/HerbAlly-Outreach/analytics/baseline.md
node scripts/analytics-weekly-report.mjs --days 7 --gsc-json ~/gsc-export.json --bounce 87
```

Writes Markdown plus a machine-readable JSON roll-up to
`~/HerbAlly-Outreach/analytics/` (override with `--out`). It uses the local
`vercel` CLI session (`vercel api /v1/query/web-analytics/...`); no token lives
in the repo.

The report:

- separates **CA** and **FR** as the markets that matter;
- flags **CN, SG and HK** as likely non-human, with pages/visitor for the rest;
- lists page views, top pages, referrers per country, and the four funnel steps
  per 1,000 page views;
- prints **bounce** only when it is supplied with `--bounce`, because the query
  API does not expose it. It is never estimated;
- prints the GSC block only from an explicit export (`--gsc-json`), because GSC
  has no unattended credential on this machine. It is never invented.

### Bounce, exactly

The query API's allowed dimensions are `hour, day, week, month, year, country,
deviceType, environment, requestPath, referrerHostname, osName, browserName,
route, utmSource, utmMedium, utmCampaign, utmContent, utmTerm, flags` — there is
no bounce dimension. Read bounce on the dashboard and pass it in.

## After a deploy

1. Open `https://herbally.app/calculator` in a normal browser and submit a valid
   adult dose. Within ~5 minutes, `vercel api "/v1/query/web-analytics/events/aggregate?projectId=prj_aGIptlSsD7vwSUwppdWJrL8mIe59&since=<today>&until=<tomorrow>&by=eventName"` should list `calculator_used`.
2. Confirm the event's properties contain no free text.
3. Run the 7-day report once a week's worth of data exists.

Deploying is the owner's call: `feat/analytics-funnel-events` is a local branch
and nothing here authorises a push, merge or production deploy.
