# HerbAlly — Full Audit Report
**Date:** 2026-06-19 20:52 EDT
**Auditor:** OpenClaw (automated full scan)
**Project:** HerbAlly v0.1.0 — Medical Herbs SaaS
**Scope:** Codebase, security, performance, architecture, tests, i18n, DB, CI/CD, production health
**Production URL:** https://herbally.app

---

## Executive Summary

| Category | Grade | Status |
|----------|-------|--------|
| Build & Compile | A | ✅ Clean — 32 routes, standalone output |
| TypeScript | A | ✅ 0 errors — strict mode |
| ESLint | A | ✅ 0 warnings |
| Prettier | A | ✅ All files formatted |
| Unit Tests | A | ✅ 402 tests, 48 files, all passing |
| E2E Tests | A | ✅ 29 passed, 9 skipped, 7 spec files, 3 browsers |
| Coverage | C+ | ⚠️ 25.8% stmts / 26% lines — below 40% target |
| Dependencies | A | ✅ 0 vulnerabilities (npm audit) |
| Security Headers | A | ✅ CSP, HSTS, X-Frame-Options, Permissions-Policy |
| Security — Auth | A | ✅ DB-verified admin, HttpOnly guest cookies |
| Security — AI | A | ✅ Prompt injection defense, safety guard, Zod validation |
| Security — DB/RLS | A | ✅ 40 migrations, 81 RLS policies, security hardening |
| Security — API | A | ✅ All routes rate-limited + Zod-validated |
| Production Health | A | ✅ HTTP 200, healthy, all headers present |
| Architecture | A | ✅ Clean separation, error boundaries, Sentry |
| i18n | A+ | ✅ 949 keys EN/FR perfectly synced |
| Docker | A | ✅ Multi-stage, non-root, healthcheck |
| CI/CD | A | ✅ 9 jobs: lint, typecheck, test, coverage, format, e2e, build, secrets, db |
| Dead Code | B+ | ⚠️ 1,776 lines of unused code across 8 files |
| Code Quality | A- | ✅ No TODOs, no raw console.logs, good error handling |

**Overall Grade: A-** — Production-ready, well-architected, with minor cleanup and coverage gaps.

---

## 1. Build & Compilation — A ✅

- `npm run build` — passes, standalone output
- 283 source files, ~30,133 lines of TypeScript/TSX
- 32 routes (mix of static and dynamic)
- ISR: herbs (24h), sitemap (1h), symptoms/compare (1h)
- `output: "standalone"` for Docker
- `poweredByHeader: false`, `compress: true`
- `optimizePackageImports` for lucide-react and react-markdown
- Image formats: AVIF + WebP, 30-day cache TTL
- Bundle: 2.8 MB static chunks, 3.0 MB total static

---

## 2. Type Safety & Linting — A ✅

- `tsc --noEmit` — 0 errors (strict mode)
- `eslint` — 0 warnings
- `prettier --check .` — all files formatted
- Only 6 `eslint-disable` comments (3 in test setup with `@ts-ignore`, 3 `react-hooks/exhaustive-deps` in client components — all justified)
- Only 1 `as any` in production code (`window as any` for Vercel Analytics — standard pattern)

---

## 3. Dependencies — A ✅

### npm audit: 0 vulnerabilities

**Production (22):** next ^16.2.9, react 19.2.7, @supabase/ssr ^0.12.0, @supabase/supabase-js ^2.108.2, openai ^6.44.0, stripe ^22.2.2, zod ^4.4.3, next-intl ^4.13.0, @sentry/nextjs ^10.58.0, shadcn ^4.10.0, sonner ^2.0.7, web-vitals ^5.3.0

**Dev (18):** vitest ^4.1.9, playwright ^1.61.0, testing-library, eslint 9, prettier 3, tailwind 4, typescript ^5

All current, no vulnerabilities, no outdated major versions.

---

## 4. Security — Deep Analysis

### 4.1 Security Headers (Production Verified) — A ✅

Live response headers from `herbally.app`:
- **CSP:** `default-src 'self'; script-src 'self' 'unsafe-inline' *.stripe.com; connect-src 'self' *.supabase.co *.openrouter.ai *.stripe.com; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; frame-src *.stripe.com; frame-ancestors 'none'`
- **HSTS:** `max-age=63072000; includeSubDomains; preload`
- **X-Frame-Options:** DENY
- **X-Content-Type-Options:** nosniff
- **Referrer-Policy:** strict-origin-when-cross-origin
- **Permissions-Policy:** camera=(), microphone=(), geolocation=()
- **X-DNS-Prefetch-Control:** on

⚠️ CSP uses `unsafe-inline` for scripts (Next.js requirement — consider nonce-based CSP long-term)

### 4.2 Authentication & Authorization — A ✅

- **Admin auth:** DB-verified `profiles.role` (not JWT metadata) — prevents token tampering
- **Service role key:** Server-side only (`admin.ts`, webhooks, garden guest path, AI cache)
- **Guest identity:** HttpOnly, Secure, SameSite=lax cookie, `crypto.randomUUID()`, UUID-validated
- **Open redirect protection:** `auth/callback` only allows same-origin absolute-less paths
- **Stripe webhook:** Signature verification + idempotency guard
- **Supabase PKCE:** Code exchange flow with safe redirect

### 4.3 AI Safety — A ✅

- System prompt injection defense (untrusted data wrapped in markers)
- Zod rejects `role: "system"` in client messages
- Safety guard: 50+ regex patterns (EN/FR), leet-speak normalization, zero-width char removal
- Hard blocks: medication cessation, cure claims, doctor dismissal, unsafe dosing, emergency misdirection
- Guard applied pre-cache AND on cache read
- Only primary-model responses cached (not free-tier fallback)
- Temperature 0.3 for factual responses
- 20s upstream timeout + 30s streaming inactivity timeout
- Context fetcher grounds responses in verified DB data

### 4.4 Input Validation — A ✅

Every API route has Zod schemas with length/size limits:
- `/api/chat`: messages (max 50, 8000 chars each), body 50KB max
- `/api/donate`: amount (int, 100–1,000,000 cents)
- `/api/garden`: herbs (max 100), slug/name (max 200), body validation
- `/api/rxnorm`: term (2–100 chars)
- `/api/openfda`: term (1–100 chars)
- `/api/interpret-search`: query (2–200 chars), body 10KB max
- `/api/health`: rate-limited (30/min)

### 4.5 Rate Limiting — A ✅

| Route | Limit | Window |
|-------|-------|--------|
| /api/chat | 20 burst + 200 daily | per-IP |
| /api/garden | 30 | per-min |
| /api/rxnorm | 20 | per-min |
| /api/openfda | 20 | per-min |
| /api/health | 30 | per-min |
| /api/donate | 10 | per-min |
| /api/interpret-search | 20 | per-min |
| /api/webhooks/stripe | — | signature-gated |

Backends: memory (default) or Upstash Redis (`RATE_LIMIT_BACKEND=upstash`).
⚠️ Memory backend doesn't scale across instances — ensure Upstash is configured in production.

### 4.6 Database & RLS — A ✅

- 40 SQL migrations, well-structured
- 81 RLS policies across 22 tables
- Security hardening migration (00038): profiles.role self-escalation, guest fn IDOR, WITH CHECK policies
- Guest function revocation (00041): authenticated EXECUTE revoked
- webhook_events table for Stripe idempotency
- AI response cache: anon reads only, service-role writes (prevents poisoning)
- Donations: RLS enabled, admin-SELECT only, service-role writes via webhook
- Garden: authenticated users get RLS-scoped access, guests use service-role with cookie identity

### 4.7 `dangerouslySetInnerHTML` — A ✅ (Fixed this session)

9 occurrences, all for JSON-LD structured data (SEO). All now escape `<` to `\u003c`:
- 6 in SEO components (already had escaping)
- 3 in page components (fixed in PR #34)

---

## 5. Test Coverage — C+ ⚠️

### Current: 402 tests, 48 files, all passing

| Area | Coverage | Status |
|------|---------|--------|
| `safety-guard.ts` | 100% | ✅ |
| `monographs.ts` | 100% | ✅ (New — PR #34) |
| `utils/` | 98% | ✅ |
| `enrichment.ts` | 89% | ✅ |
| `i18n/` | 79% | ✅ |
| `actions/` | 61% | Medium |
| `garden/` | 59-81% | Medium |
| `context-fetcher.ts` | 61% | ✅ (Improved — PR #34) |
| `system-prompt.ts` | 13% | Low (string concat) |
| `openai-client.ts` | 0% | Low (config wrapper) |
| `ollama-cloud-client.ts` | 0% | Used by scripts only |
| `monograph-priority.ts` | 0% | Static data |
| `supabase/` | 0% | Client factories (hard to test) |
| `proxy.ts` | 0% | Middleware (hard to unit test) |
| App routes/pages | 0% | Next.js routes (need integration tests) |

### E2E Tests — A ✅

- 7 spec files, 3 browsers (chromium, firefox, webkit)
- 29 passed, 9 skipped
- Coverage: homepage, herbs catalog, chat/AI, calculator, accessibility, smoke

---

## 6. Dead Code — B+ ⚠️

1,776 lines of unused code across 8 files (not imported anywhere in app code):

| File | Lines | Notes |
|------|-------|-------|
| `ollama-cloud-client.ts` | 109 | Used by standalone scripts only (batch generators) |
| `monograph-priority.ts` | 930 | Static data for prioritization — reference doc |
| `instant-search.tsx` | 217 | Component — never imported |
| `animated-counter.tsx` | 108 | Component — never imported |
| `floating-herbs.tsx` | 83 | Component — never imported |
| `mission-modal.tsx` | 124 | Component — never imported |
| `herb-safety-badges.tsx` | 54 | Component — never imported |
| `copy-link-button.tsx` | 50 | Component — never imported |
| `surprise-me-button.tsx` | 29 | Component — never imported |
| `meta-tags.tsx` | 72 | SEO helper — superseded by metadata API |

**Recommendation:** Remove the 6 unused components (625 lines) and `meta-tags.tsx`. Keep `ollama-cloud-client.ts` (used by scripts) and `monograph-priority.ts` (reference data).

---

## 7. Production Health — A ✅

| Check | Result |
|-------|--------|
| HTTP status | 200 |
| Health endpoint | `{"status":"healthy","version":"0.1.0"}` |
| Security headers | All present |
| HSTS | Enabled (2-year + preload) |
| CSP | Configured correctly |
| Server | Vercel |
| Response time | < 200ms |
| `/api/chat` (GET) | 405 (correct — POST only) |

---

## 8. Architecture — A ✅

### Strengths
- Clean separation: `app/` (routes), `components/` (UI), `lib/` (logic), `supabase/` (DB)
- 26 `error.tsx` error boundaries with Sentry integration
- 26 `loading.tsx` suspense fallbacks
- 2 `not-found.tsx` pages
- `ActionResponse<T>` pattern for server actions
- Three Supabase client factories: `server.ts` (RLS), `admin.ts` (service-role), `anonymous.ts` (anon)
- i18n: URL-as-truth with `x-locale` header, 949 keys EN/FR perfectly synced
- 95 client/server directive declarations
- 206 React hooks usages
- OpenRouter fallback chain (primary → free models)
- AI response caching with safety guard
- Sentry error tracking on all error boundaries
- PWA manifest
- Vercel Analytics integration

### Git Activity
- 255 total commits
- 100 commits since June 1, 2026
- Active development with PR-based workflow

---

## 9. CI/CD — A ✅

Single workflow file (`.github/workflows/ci.yml`) with 9 jobs:
1. **secrets** — Secret scanning (`detect-secrets.sh`)
2. **verify-db** — Herb database integrity verification
3. **lint** — ESLint
4. **typecheck** — TypeScript type checking
5. **test** — Unit tests (Vitest)
6. **coverage** — Test coverage report
7. **format** — Prettier format check
8. **test-e2e** — Playwright E2E (3 browsers)
9. **build** — Next.js production build

Branch protection on `main`: requires `build` status check, PR-only updates.

---

## 10. Docker — A ✅

- Multi-stage: build (node:22-alpine) → runner (node:22-alpine)
- Non-root user: `nextjs:nodejs` (uid 1001)
- `NEXT_TELEMETRY_DISABLED=1`
- Healthcheck: `GET /api/health` every 30s
- Standalone output (minimal image)
- `HOSTNAME=0.0.0.0` (container-friendly)

---

## 11. Performance — A- ✅

- ISR on herb pages (24h), sitemap (1h), symptoms/compare (1h)
- 24h revalidation on OpenFDA API calls
- Image formats: AVIF + WebP
- Image cache TTL: 30 days
- Streaming for AI responses
- `optimizePackageImports` for lucide-react and react-markdown
- Bundle: 2.8 MB chunks / 3.0 MB total static
- gzip compression enabled
- Font preloading configured
- `@vercel/analytics` for RUM

### Minor
- Consider code-splitting heavy client components (chat-interface.tsx is 400+ lines)
- Consider `next/dynamic` imports for below-the-fold components

---

## 12. i18n — A+ ✅

- 949 translation keys, EN/FR perfectly synced
- URL-as-truth routing (`/fr/*` prefix, `x-locale` header)
- Cookie only for first-visit detection (never causes drift)
- Accept-Language fallback
- 153 i18n-related imports across the codebase
- French and English dictionaries (1,333 lines each)

---

## 13. Findings Summary

### Critical: None 🎉

### High Priority
1. **Remove 6 dead components** (625 lines): `instant-search.tsx`, `animated-counter.tsx`, `floating-herbs.tsx`, `mission-modal.tsx`, `herb-safety-badges.tsx`, `copy-link-button.tsx`, `surprise-me-button.tsx`, `meta-tags.tsx`
2. **Raise test coverage to 40%+** — currently 25.8%. Biggest gaps: app routes, supabase clients, proxy.ts
3. **Ensure `RATE_LIMIT_BACKEND=upstash` in production** — memory backend doesn't share state across Vercel instances

### Medium Priority
4. **Consider nonce-based CSP** to replace `unsafe-inline` for scripts (long-term Next.js evolution)
5. **Code-split `chat-interface.tsx`** (400+ lines, loaded on chat page only)
6. **Add integration tests for `/api/chat`** with mocked OpenRouter responses

### Low Priority
7. **`monograph-priority.ts`** (930 lines) is reference data — consider moving to `docs/` instead of `src/`
8. **`ollama-cloud-client.ts`** is scripts-only — consider moving to `scripts/lib/`

### Already Fixed (This Session — PR #34)
- ✅ XSS defense-in-depth on 3 JSON-LD pages (`<`-escaping)
- ✅ Tests for `monographs.ts` (0% → 100%)
- ✅ Tests for `context-fetcher.ts` (47% → 61%)
- ✅ Deep audit report in `docs/`

### Previously Fixed (Earlier Commits)
- ✅ Guest ID from cookie (not body) — SEC-9
- ✅ `getClientIP` leftmost IP
- ✅ `profiles.role` self-escalation — SEC-1 (00038)
- ✅ Guest functions search_path + IDOR — SEC-4 (00038, 00041)
- ✅ AI cache poisoning — service-role writes only
- ✅ Daily per-IP chat cap (200/day)
- ✅ Stripe webhook idempotency (`webhook_events` table)
- ✅ Stripe webhook DB error → 500 (not 200)
- ✅ Web vitals endpoint uses `getAnonClient()`

---

## 14. Grades Summary

| Category | Grade | Change from Previous |
|----------|-------|----------------------|
| Build & Compile | A | — |
| TypeScript | A | — |
| ESLint | A | — |
| Unit Tests | A | ↑ (383→402 tests) |
| E2E Tests | A | — |
| Coverage | C+ | ↑ (23%→25.8%) |
| Dependencies | A | — |
| Security Headers | A | — |
| Security Auth | A | — |
| Security AI | A | — |
| Security DB | A | — |
| Security API | A | — |
| Production Health | A | — |
| Architecture | A | — |
| i18n | A+ | — |
| Docker | A | — |
| CI/CD | A | — |
| Dead Code | B+ | New finding |
| Code Quality | A- | ↑ (fixed XSS escaping) |

**Overall: A-** — Solid production-grade medical SaaS with strong security posture, clean architecture, and comprehensive testing infrastructure. Main gaps are test coverage and dead code cleanup.

---

_Report generated: 2026-06-19T20:57:00-04:00_
_Audit tool: OpenClaw automated full scan_
_Previous audit: 2026-06-19 16:50 EDT (deep audit)_