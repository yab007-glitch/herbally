# HerbAlly

A medical herbs SaaS application featuring a searchable database of 2,700+ medicinal herbs, age/weight-based dosage calculator, and an AI-powered virtual pharmacist for herb-drug interaction checking.

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19
- **Database**: Supabase (PostgreSQL + Auth)
- **Styling**: Tailwind CSS 4 + shadcn/ui (base-nova)
- **AI**: OpenRouter API (free pool by default, paid model via `OPENROUTER_MODEL` env var) for virtual herbalist chat. See `src/app/api/chat/route.ts` for the fallback chain.
- **APIs**: RxNorm (drug lookup), OpenFDA (adverse events)

## Prerequisites

- Node.js 20+
- Supabase project
- OpenRouter API key (`OPENROUTER_API_KEY`)

## Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Run database migrations via Supabase dashboard or CLI

# Start development server
npm run dev
```

## Scripts

| Script                  | Description                  |
| ----------------------- | ---------------------------- |
| `npm run dev`           | Start dev server (Turbopack) |
| `npm run build`         | Production build             |
| `npm run start`         | Start production server      |
| `npm run lint`          | Run ESLint                   |
| `npm run typecheck`     | TypeScript type checking     |
| `npm run test`          | Run tests (watch mode)       |
| `npm run test:run`      | Run tests (single run)       |
| `npm run test:coverage` | Run tests with coverage      |
| `npm run format`        | Format code with Prettier    |
| `npm run format:check`  | Check formatting             |

## Project Structure

```
src/
  app/
    (auth)/         # Login, register, password reset
    (main)/         # Herbs catalog, calculator, pharmacist, dashboard
    (marketing)/    # Landing page, about, legal pages
    admin/          # Admin panel (herbs CRUD, interactions, users)
    api/            # API routes (chat, rxnorm, openfda, health)
    manifest.ts     # PWA manifest
  components/
    ui/             # shadcn/ui components
    herbs/          # Herb-specific components (incl. ProvenanceBadge, evidence-grade)
    calculator/     # Dosage calculator components
    pharmacist/     # AI chat components (incl. ChatMarkdown with PMID/evidence enrichment)
    layout/         # Navigation, footer
    auth/           # Login/register/reset forms, account menu
    shared/         # Loading skeletons, common UI
  lib/
    actions/        # Server actions (ActionResponse<T> pattern)
    ai/             # OpenRouter client, system prompt
    chat/           # Markdown enrichment (remarkHerbAlly) and safety guard
    supabase/       # Database client factories
    types/          # TypeScript types, database schema (incl. provenance.ts)
    utils/          # Dosage calculations, RxNorm client
```

## Routes

- `/` — Marketing landing page (hero, stats, feature grid, CTA).
- `/herbs` — Browseable catalog of 2,700+ herbs.
- `/herbs/[slug]` — Herb detail page with provenance badge.
- `/herbalist` — Full-screen AI chat with PMID-linkified markdown and safety guard.
- `/calculator` — Pediatric/adult dosage calculator.
- `/symptoms`, `/compare` — Adjacent tools.
- `/admin` — Herb / interaction / user CRUD (admin role required).
- `/login`, `/register`, `/forgot-password`, `/reset-password` — Supabase auth flows.
- `/auth/callback` — PKCE email-confirmation / reset callback.
- `/?herb=<slug>` and `/?medications=<list>` are 308-redirected to `/herbalist` for backward compatibility.

## AI safety

The chat route streams OpenRouter responses. After the stream completes, a
client-side safety guard (`src/lib/chat/safety-guard.ts`) scans the final
text for red-flag phrases (e.g. "stop taking your insulin") and either
appends a localised disclaimer (soft warn) or replaces the response with
a refusal (hard block) before the message is persisted.

## Herb provenance

`herbs.provenance` and `herb_monographs.provenance` are jsonb columns
introduced in migration `00024_add_provenance.sql`. The shape:

```jsonc
{
  "verification_method": "manual" | "ai_summarized" | "primary_source" | "unverified",
  "sources": ["WHO", "NCCIH"],
  "primary_url": "https://...",
  "last_verified_at": "2026-06-09T12:00:00.000Z",
  "verified_by": "Dr. Smith",
  "notes": "optional reviewer note"
}
```

Default is `{}` (interpreted as `unverified`); the badge only renders
for entries reviewed by a human. To mark a herb:

```bash
npx tsx scripts/mark-herb-provenance.ts ginger \
  --method manual \
  --sources "WHO,NCCIH" \
  --primary-url https://nccih.nih.gov/health/ginger \
  --verified-by "Dr. Smith" \
  --notes "Cross-checked WHO monograph 2024"
```

## Deployment

### Provenance migration (one-time)

Apply the migration to your Supabase project before any reviewer starts
backfilling provenance. It's idempotent — safe to re-run.

```bash
# Option 1: Supabase CLI
supabase db push

# Option 2: paste the contents of
#   supabase/migrations/00024_add_provenance.sql
# into the Supabase SQL editor.
```

The migration:

- adds `provenance jsonb NOT NULL DEFAULT '{}'::jsonb` to `herbs` and `herb_monographs`
- adds a CHECK constraint allowing only the four known `verification_method` values
- adds a GIN index for `provenance @> '{"verification_method":"manual"}'` queries
- backfills existing AI-generated monographs with `verification_method = 'ai_summarized'`

The 2,700+ existing herbs land in the soft-default `unverified` state
(no badge rendered) — backfill with `npx tsx scripts/mark-herb-provenance.ts <slug> ...` as you review each.

### Verifying deep-link redirects

The 308 redirect in `next.config.ts` is load-bearing — `src/app/(main)/herbs/[slug]/page.tsx:764` links to `/?herb=${slug}` for the "Check Interactions" CTA. After deploy:

```bash
curl -I https://herbally.app/?herb=ginger
# Expected: HTTP/2 308, location: /herbalist
```

### Smoke test the chat

```bash
# Confirm /api/chat handles the common error paths.
curl -X POST http://localhost:3000/api/chat \
  -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"hi"}]}'
# Expected: streamed text/event-stream, 200 OK
```

## Herb Coverage

HerbAlly's database covers **2,700+ medicinal herbs** across 22 therapeutic categories
including adaptogens, anti-inflammatories, cognitive enhancers, digestive aids,
cardiovascular support, women's and men's health, immune modulators, and more.
Each herb is categorized by evidence level (A through C and traditional use)
based on WHO monographs, EMA assessments, Commission E reports, and
peer-reviewed systematic reviews.

See `supabase/migrations/00028_seed_additional_herbs.sql` for the most recent
batch of additions.

## Disclaimer

HerbAlly is for educational purposes only. It is not intended to diagnose, treat, cure, or prevent any disease. Always consult a qualified healthcare provider before using herbal supplements, especially if you are pregnant, nursing, taking medications, or have a medical condition.

This application complies with FDA guidelines regarding dietary supplement information.
