# Task brief — HerbAlly remaining content work (2026-11-23)

Repo: `/Users/yasser/herbally` (Next.js 16, production DB on `DESKTOP-ESRIBBL`, reached with `ssh windows` → `wsl.exe -d Ubuntu-24.04 -- docker exec -i herbally-db psql -U postgres -d postgres`).

## Context you must respect

- The production site is `https://herbally.app`. Deploys happen automatically when `main` passes CI.
- **Every published herb page is now indexable by owner policy** (commit `13ee1e9`). Do not restore the sourced/thin noindex gate.
- **Every page shows a generic "Reviewed and verified" line.** Do not add named reviewer bylines or bulk "reviewed by" stamps.
- **Do not invent medical facts.** No dose numbers, no interaction pairs, no contraindications, no evidence grades may be created without a cited source already in the database. When data is missing, leave it missing or state honestly that it is not established.
- Never put secrets in the repo, logs, or chat. Production credentials live in `/srv/herbally/deploy/*.env` on the box.

## Task 1 — Translate the 2,125 English herb names into French

Find rows where `translations->'fr'->>'name' = name` (about 2,125 published herbs).

- Translate the common name into Canadian French, preserving the Latin binomial and any brand/product naming.
- Use the project's existing Ollama Cloud credentials from `/Users/yasser/herbally/.env.local` (`OLLAMA_CLOUD_API_KEY`, `OLLAMA_CLOUD_URL`, `OLLAMA_CLOUD_MODEL`) — the same model the site uses. Do not add new providers.
- Write only `translations.fr.name`; do not touch `name`, `scientific_name`, or descriptions.
- Reject any output that is empty, identical to the English name, or contains English stop-words; log rejects instead of guessing.
- Revalidate the affected slugs through `/api/revalidate-herb` from inside the app container (the secret never leaves the box), in batches of 200.
- Report: translated count, rejected count, 20 examples before/after.

## Task 2 — Titles longer than 60 characters (365 pages)

`generateMetadata` uses `fitTitle` from `src/lib/seo/fit-title.ts`. Inspect it and the dictionary strings (`herbT("title")`, `titleShort`, `titleBinomial`, `titleBinomialShort`).

- Make the rendered `<title>` ≤ 60 characters for every herb, without losing the herb name.
- Add or extend a unit test that asserts the limit for a long binomial and a long common name.
- Verify with a sample of the 365 offending slugs by fetching the live pages after deploy.

## Task 3 — Non-numeric adult doses (404) and missing doses (217)

- Classify, do not invent. Topical-only or aromatherapy instructions are legitimate; leave them.
- Where the field is a placeholder like "as directed" with no number and no source, replace it with an honest statement such as "No standard adult dose is established in the reviewed sources" — only if that is true for that page; otherwise leave it.
- Do not add numbers to any page.

## Task 4 — Pages with no side effects (263) or no contraindications (86)

Do not fabricate. If the page has a sourced monograph or PubMed sheet with safety text, it may already be displayed elsewhere; leave the structured field empty rather than duplicating. Report a list for human review.

## Task 5 — Pages with no citations (30)

Leave the content; report the slugs so a human can source them.

## Task 6 — Drug-interaction coverage (2,966 pages with none)

**Do not generate interaction pairs.** Produce a short written plan only: which herbs by traffic would benefit first, which regulator/PubMed sources exist in the database, and what a sourced import would require.

## Delivery requirements

- Work on `main`; run `npx tsc --noEmit`, `npx vitest run` and `npx eslint` on changed files before each commit.
- Commit in small logical units with clear messages; push (CI deploys).
- Update the vault note `Team Memory/knowledge/2026-11-23-herbally-full-catalogue-scan.md` with before/after counts.
- Report at the end: what changed, exact counts, tests, live verification, and anything you refused to invent.
