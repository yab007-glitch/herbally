# Retirement log — 2026-11-24

Owner decision: **Option 3, limited to the two entries whose own records state there is no
traditional medicinal use.** The broader "non-medicinal" framing was wrong — 28 of the 29
zero-citation herbs carry documented traditional uses (see `uncited-sourcing-report.md`).

## Retired (`is_published = false`)

| Slug | Name | Reason |
|---|---|---|
| `nothoscordum-bivalve` | False Garlic / Crow Poison | Record states "no traditional medicinal use"; lookalike for wild garlic |
| `zigadenus-elegans` | Mountain Death Camas | Record states "no traditional medicinal use — toxic plant"; zygacine poisoning risk |

Both were zero-citation and carried no curated interactions. Together they held 1,500 lifetime
view-counter hits across the 29-herb group; all crawler-inflated.

## Backup

`/home/yasser/herbally-backups/pre-retire-2-20261124T062103.dump` (40.7 MB, custom format),
taken before the write.

## Verification

- `UPDATE 2`, both rows confirmed `is_published = false`.
- Revalidated both slugs: `{"ok":true,"revalidated":2}`.
- Live: both URLs now return **HTTP 404** with the "Page not found" body, EN and FR.
- Sitemap: **8,078 → 8,074** entries, **0** references to either slug.
- Cloudflare purged so the edge cannot serve the stale 200.

## Deliberately not retired

The other 28 zero-citation herbs keep their pages. They have documented traditional use and, in
several cases, recognised medicinal status (`calumba-jateorhiza`, `mahonia-nervosa`,
`life-root`, `prodigiosa-mex`, `yokukansan-kampo`). Their correct treatment is the honest
`no_indexed_source` state, not deletion.

## Reversal

Re-publish with:
`UPDATE herbs SET is_published = true, updated_at = now() WHERE slug IN ('nothoscordum-bivalve','zigadenus-elegans');`
then revalidate both slugs and purge the edge. The pre-write dump allows a full restore.
