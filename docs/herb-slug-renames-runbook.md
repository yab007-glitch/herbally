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
- `sitemap.xml` holds 88 URLs and no `/herbs/` slug URL at all, so there is
  nothing to remove from the sitemap after the rename.
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

## 6. The activation step

1. After the write, run the gate and expect 6 of 6 ready:

   ```sh
   node scripts/verify-slug-renames.mjs --require-ready
   ```

2. Ship a deploy that restores the `herbSlugRenames` wiring in `next.config.ts`
   and flips `activation` in `data/herb-slug-renames.json` to `active`.
3. Wait for the deployment whose `githubCommitSha` matches the merged commit to
   reach READY.
4. Check both locales with `curl`: the old path must return 308 and the new
   path must return 200, for `/herbs/...` and `/fr/herbs/...`.

## 7. Client state

Garden lists in `localStorage` are keyed by slug. No saved rows exist for these
six, so no client migration is needed.

## 8. Rollback

The inverse rename is the same script with a manifest whose `from` and `to` are
swapped. The pubmed backup artifact holds the exact rows moved, so the inverse
run can be checked against it.
