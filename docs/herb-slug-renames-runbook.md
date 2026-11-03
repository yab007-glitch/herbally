# Herb slug renames runbook

Six staged slug renames, applied to the database first and activated in a
separate deploy. Manifest: `data/herb-slug-renames.json`.

## 1. Why the order is fixed

A slug rename and a permanent redirect cannot both be live at once.

- Renaming first 404s the indexed URL until the redirect deploy is READY.
- Shipping the redirect first sends a permanent 308 to a slug with no row, and
  browsers and crawlers cache that.

The order is therefore **database first, redirect second**. The activation gate
is:

```sh
node scripts/verify-slug-renames.mjs --require-ready
```

## 2. The six staged pairs

| From                                | To                                 |
| ----------------------------------- | ---------------------------------- |
| `/herbs/anthonota-macrophylla`      | `/herbs/anthonotha-macrophylla`    |
| `/herbs/xanthorrhiza-simplicissima` | `/herbs/xanthorhiza-simplicissima` |
| `/herbs/hypsizygus-tessellatus`     | `/herbs/hypsizygus-tesselatus`     |
| `/herbs/notopterygium-incisium`     | `/herbs/notopterygium-incisum`     |
| `/herbs/cinnamomum-burmannii`       | `/herbs/cinnamomum-burmanni`       |
| `/herbs/rauwolfia-cardio`           | `/herbs/rauvolfia-cardio`          |

## 3. Live state verified 2026-11-03

- All six source URLs return 200 and all six destination URLs return 404.
- `sitemap.xml` returns 200 with 5,715 `<loc>` entries, 5,243 of them
  `/herbs/` URLs. It is generated from the `herbs` table by
  `src/app/sitemap.ts`, which sets `export const revalidate = 3600` (line
  589). Each of the six source slugs is present twice (English and French) and
  each destination slug is absent, so the rename does change the sitemap: the
  six old paths must disappear and the six new paths must appear twice each.
- Match whole `<loc>` URLs when checking, never substrings:
  `xanthorrhiza-simplicissima-herb` is a separate published slug that keeps
  the old token and stays in the sitemap after the rename.
- The sitemap keeps serving its pre-write render for up to one hour because of
  `revalidate = 3600`, so a check run straight after the database write can
  still show the old slugs.
- `herb_monographs` holds 1 row for each of the six source slugs.
- `herb_pubmed_monographs` holds 1 row for five of them: every pair except
  `anthonota-macrophylla`.
- `herb_regulatory_evidence` holds 1 row for `cinnamomum-burmannii` and
  `rauwolfia-cardio`.
- `garden_herbs` and `herb_ratings` hold zero rows for all six.

## 4. The foreign key trap

Migration `00056_create_herb_pubmed_monographs.sql` defines:

```sql
slug TEXT NOT NULL UNIQUE REFERENCES public.herbs(slug) ON DELETE CASCADE
```

`ON UPDATE` is not specified, so it is `NO ACTION`, and Postgres rejects the
parent slug update while a child row points at the old slug. The applier
therefore snapshots those child rows to
`artifacts/slug-rename-pubmed-backup.json`, deletes them, renames the parent,
and re-inserts them with every other column preserved. It restores the snapshot
if a later step fails.

A migration adding `ON UPDATE CASCADE` would remove the need for that dance and
is the better long term fix, but no migration runner credential is available
here.

## 5. How to run it

Dry run (reads the live database, writes nothing):

```sh
node scripts/apply-herb-slug-renames.mjs
```

Write:

```sh
node scripts/apply-herb-slug-renames.mjs --apply
```

Restrict to a comma separated list of source slugs, with or without the
`/herbs/` prefix:

```sh
node scripts/apply-herb-slug-renames.mjs --only anthonota-macrophylla,rauwolfia-cardio
```

Exit codes:

- `0`: every guard passed and, under `--apply`, every post-write read-back
  matched.
- `1`: a guard failed (malformed entry, conflicting source/destination state,
  unexpected `scientific_name`, or unlisted dependent rows), a write failed, or
  a read-back disagreed.

A second run is safe: it reports `already-renamed` and writes nothing.

Known limits of the applier:

- The pre-check accepts `scientific_name` equal to either
  `scientific_name_before` or `scientific_name_after`, while the post-write
  read-back requires `scientific_name_after`. All six live rows already carry
  the corrected binomial, so the gap cannot fire today, but a row still
  carrying the old name would be renamed and then fail the read-back.
- `already-renamed` pairs are skipped on a re-run. A crash after the parent
  rename but before a dependent move leaves an orphan that neither the re-run
  nor `verify-slug-renames.mjs` (which reads only `herbs`) detects; only the
  in-run read-back or the dependent-table census catches it.
- `artifacts/slug-rename-pubmed-backup.json` is the only copy of the five
  pubmed rows the applier deletes. Attach it to the kanban card or copy it
  outside the worktree before the worktree is reaped.

## 6. The activation step

1. After the write, run the gate and expect 6 of 6 ready:

   ```sh
   node scripts/verify-slug-renames.mjs --require-ready
   ```

2. Ship one commit that restores the
   `herbSlugRenames.renames.flatMap(...)` wiring in `next.config.ts` — one
   `{ source, destination, permanent: true }` pair per rename for
   `/herbs/<old>` and `/fr/herbs/<old>` — and flips `activation` in
   `data/herb-slug-renames.json` to `active`. Do not add a `statusCode` to
   these rules: Next prefers `statusCode` over `permanent`, so a stray 301 or
   307 silently replaces the intended 308. The manifest guard in
   `src/lib/data/__tests__/herb-name-manifests.test.ts` now evaluates the
   twelve concrete request paths (six English, six French) through Next's own
   `getPathMatch` and `getRedirectStatus`: under `deferred` it requires every
   path to stay unwired, and under `active` it requires a matching 308 to the
   new path, rejects `statusCode` 301 or 307 and any `has`/`missing` gating,
   and accepts a ginkgo-style parameterized locale rule
   (`/:locale(en|fr)/herbs/<old>` → `/:locale/herbs/<new>`). Flipping the flag
   without the wiring, or the reverse, fails the manifest suite. Do not delete
   or weaken that assertion.
3. Wait for the deployment whose `githubCommitSha` matches the merged commit
   to reach READY.
4. Check both locales with `curl`: the old path must return 308 with a
   `location` header at the new slug, and the new path must return 200, for
   `/herbs/...` and `/fr/herbs/...`.
5. Check the sitemap after its `revalidate = 3600` window, or after forcing
   a revalidation. Fetch it and count exact path matches:

   ```sh
   curl -s https://herbally.app/sitemap.xml > /tmp/sitemap.xml
   ```

   Then count exact matches per slug:

   ```python
   import re
   locs = re.findall(r"<loc>([^<]+)</loc>", open("/tmp/sitemap.xml").read())
   slugs = [
       "anthonota-macrophylla", "anthonotha-macrophylla",
       "xanthorrhiza-simplicissima", "xanthorhiza-simplicissima",
       "hypsizygus-tessellatus", "hypsizygus-tesselatus",
       "notopterygium-incisium", "notopterygium-incisum",
       "cinnamomum-burmannii", "cinnamomum-burmanni",
       "rauwolfia-cardio", "rauvolfia-cardio",
   ]
   for slug in slugs:
       print(slug, sum(1 for loc in locs if loc.endswith("/herbs/" + slug)))
   ```

   The six old slugs must print 0 and the six new slugs
   must print 2. A substring grep is not valid here:
   `xanthorrhiza-simplicissima-herb` keeps the old token.

## 7. Client state

Garden lists in `localStorage` are keyed by slug. No saved rows exist for these
six, so no client migration is needed.

## 8. Rollback

The inverse rename is the same script with a manifest whose `from` and `to` are
swapped. The pubmed backup artifact holds the exact rows moved, so the inverse
run can be checked against it.
