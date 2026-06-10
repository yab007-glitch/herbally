@AGENTS.md

# HerbAlly - Medical Herbs SaaS

## Tech Stack

- Next.js 16 with App Router
- React 19
- Supabase (PostgreSQL + Auth + Storage)
- Tailwind CSS 4 + shadcn/ui (base-nova style)
- OpenRouter API (free or paid models) for Virtual Herbalist — see `src/app/api/chat/route.ts`
- External APIs: RxNorm, OpenFDA, PubChem

## Project Structure

- `src/app/` - Next.js pages and routes
- `src/components/` - React components (ui/, herbs/, calculator/, pharmacist/, layout/, shared/, auth/)
- `src/lib/actions/` - Server actions with ActionResponse<T> pattern
- `src/lib/supabase/` - Database client factories
- `src/lib/validations/` - Zod v4 schemas
- `src/lib/types/` - TypeScript types and database schema
- `src/lib/ai/` - OpenAI client and system prompt
- `src/lib/utils/` - Utilities (dosage calculations, RxNorm client)
- `supabase/migrations/` - SQL migrations

## Key Patterns

- Server actions return `ActionResponse<T>` = `{ success: boolean; data?: T; error?: string }`
- Supabase server client via `createClient()` from `@/lib/supabase/server`
- RLS on all tables
- URL-based filtering with searchParams
- FDA disclaimer on every page
- Brand color: green (oklch 0.44 0.16 150)

## Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
