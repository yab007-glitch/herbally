# HerbAlly

A medical herbs SaaS application featuring a searchable database of 2,700+ medicinal herbs, age/weight-based dosage calculator, and an AI-powered virtual pharmacist for herb-drug interaction checking.

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19
- **Database**: Supabase (PostgreSQL + Auth)
- **Styling**: Tailwind CSS 4 + shadcn/ui (base-nova)
- **AI**: Ollama Cloud API (glm5:cloud) for virtual herbalist chat
- **APIs**: RxNorm (drug lookup), OpenFDA (adverse events)

## Prerequisites

- Node.js 20+
- Supabase project
- Ollama Cloud API key (or OpenRouter as alternative)

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
  components/
    ui/             # shadcn/ui components
    herbs/          # Herb-specific components
    calculator/     # Dosage calculator components
    pharmacist/     # AI chat components
    layout/         # Navigation, footer
    shared/         # Loading skeletons, common UI
  lib/
    actions/        # Server actions (ActionResponse<T> pattern)
    ai/             # OpenRouter client, system prompt
    supabase/       # Database client factories
    types/          # TypeScript types, database schema
    utils/          # Dosage calculations, RxNorm client
    validations/    # Zod v4 schemas
```

## Disclaimer

HerbAlly is for educational purposes only. It is not intended to diagnose, treat, cure, or prevent any disease. Always consult a qualified healthcare provider before using herbal supplements, especially if you are pregnant, nursing, taking medications, or have a medical condition.

This application complies with FDA guidelines regarding dietary supplement information.
