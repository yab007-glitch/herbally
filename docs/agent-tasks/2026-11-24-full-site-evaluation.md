# Task brief — full-site evaluation and fix pass (2026-11-24)

Repo `/Users/yasser/herbally`; production `https://herbally.app`; DB as in the earlier briefs.
This is an **evaluation with evidence**, followed by fixes only where the correct answer is
determinate.

## Hard rules

- **No invented facts.** No new doses, interactions, contraindications, citations, reviewer
  names, or verification methods.
- **No policy changes.** Do not change the index-all decision, the generic "Reviewed and
  verified" line, the `reviewedBy` Organization, ads, consent, or analytics.
- **Do not "fix" by deletion** when the honest action is to report. Deleting a page or a field
  to clear an error is not a fix.
- Back up the database before any data write. Commit in small units. `tsc`, full tests, `eslint`,
  `prettier --check` before each commit. Push; CI deploys.

## Evaluate these categories

Record every finding with **evidence** (URL, status code, response header, DOM selector, query
row count, Lighthouse number). An issue without evidence is not a finding.

### 1. Availability and routing
- Fetch every URL in `sitemap.xml` and record status, redirects, canonical target.
- Internal links: crawl the site from `/`, `/herbs`, `/interactions`, `/symptoms`, `/medications`
  and report 4xx/5xx targets and chains of redirects longer than one hop.
- Both locales: any `/fr/...` URL that silently renders English content.

### 2. SEO and structured data
- Missing, duplicate, or over-60-character `<title>`; missing or duplicate meta description.
- Canonical correctness, hreflang reciprocity, `x-default`.
- JSON-LD: required fields per type (`MedicalWebPage`, `Article`, `FAQPage`, `BreadcrumbList`,
  `Organization`), invalid dates, duplicate entities.
- `robots` vs sitemap agreement: any sitemap URL serving `noindex`.

### 3. Content integrity
- Untranslated strings in French UI chrome (not herb names — those are a known human decision).
- Placeholder or lorem text, "TODO", "as directed" with no source, broken citation URLs
  (HEAD each citation link, report non-200).
- Images: missing `alt`, 404 image endpoints, images served far larger than their display box.

### 4. Accessibility (automated, axe-core via Playwright)
Run on `/`, `/herbs/turmeric`, `/fr/herbs/turmeric`, `/herbs`, `/interactions`, `/symptoms`,
`/medications`, `/npn-checker`, and a 404. Report violations by rule and selector.
Fix violations with a determinate fix (labels, roles, contrast, heading order, focus). Report
anything needing a design decision.

### 5. Performance regression guard
- The existing payload budget test must pass.
- Measure Lighthouse mobile on the same pages; flag anything above the pass-3 numbers.
- Confirm Sentry is still deferred and no `MISSING_MESSAGE` appears in either locale.

### 6. Security and headers
- Check `content-security-policy`, `strict-transport-security`, `x-content-type-options`,
  `referrer-policy`, `permissions-policy`, `x-frame-options`/`frame-ancestors`.
- Confirm no secret or server-only env value appears in any client chunk.
- Confirm admin/debug/API routes require auth and are not indexable.

### 7. Data integrity
- Orphan rows (FAQs, citations, interactions, regulatory evidence pointing at missing herbs).
- Herbs published with a null slug, duplicate slug, or a slug the sitemap omits.
- Rows whose `updated_at` is in the future.
- Counts that disagree between the site copy and the DB (e.g. "3,124 herbs").

## Fix policy

**Fix now:** broken internal links, sitemap URLs that 404 or redirect, duplicate/missing titles
and descriptions, invalid JSON-LD, missing `alt`, a11y rule violations with a clear fix, missing
security headers, future timestamps, orphan rows that are safe to delete (record counts first).

**Report only, with a list:** anything needing new medical content, translation judgement, a
policy change, a layout redesign, or an owner decision. Explicitly include the known open items
(French names equal to English, pages with no side effects/contraindications, uncited pages,
unverified provenance, AdSense status) as *reported, not attempted*.

## Deliverables

- `docs/audits/2026-11-24-full-site-evaluation.md`: findings table with columns **Area ·
  Finding · Evidence · Severity · Fixed?** plus a "Reported, not fixed" section with slug/URL
  lists, and the fixes' commits.
- A dated Team Memory note plus one INDEX line.
- A short live verification after deploy: re-run the same checks and show the counts moved.

## Report

State what you checked, how many URLs/pages/rows were covered, what you fixed, what you
deliberately left, and the top three issues that still need a human decision.
