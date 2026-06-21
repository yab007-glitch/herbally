# Full Workflow Audit Report — HerbAlly

**Date:** 2026-06-20  
**Scope:** Complete application workflow audit — all user flows, data flows, API routes, security, SEO, build/deploy, error handling, and infrastructure  

---

## Executive Summary

The HerbAlly application is architecturally solid with well-designed security boundaries, proper input validation, bilingual AI safety guards, and a robust locale system. However, this audit identifies **15 findings** across 8 workflow categories: 2 medium severity, 9 low, and 4 informational. The most impactful issues are a stale locale-reading pattern in server actions, a service worker referencing a non-existent API endpoint, and the service worker not supporting French offline pages.

---

## 1. Authentication & Authorization Flow

### 1.1 Login / Register / Password Reset

| Check | Status | Notes |
|-------|--------|-------|
| PKCE flow via Supabase SSR | ✅ | `createServerClient` with cookie-based session |
| Email confirmation redirect | ✅ | `/auth/callback` exchanges code, then redirects to safe `next` param |
| Open redirect prevention | ✅ | `nextRaw.startsWith("/") && !nextRaw.startsWith("//")` |
| Password reset flow | ✅ | `resetPasswordForEmail` → `/reset-password` page |
| Guest data migration on login | ✅ | `migrateGuestData()` called after session established |
| Guest migration on signup confirmation | ✅ | Called in `/auth/callback` after `exchangeCodeForSession` |
| Migration is idempotent | ✅ | `guest_id` set to NULL after claim, WHERE clauses no longer match |
| Migration deduplicates garden herbs | ✅ | Checks for existing `(user_id, herb_slug)` collisions before claiming |
| Migration never blocks login | ✅ | Try-catch with `logger.error`, returns `false` on failure |
| Guest cookie cleared after migration | ✅ | Prevents cross-account data leak on shared devices |
| Error messages from Supabase surfaced to user | ✅ | `state.error` displayed in form |
| Logout redirects to home | ✅ | `redirect("/")` after `signOut()` |

### 1.2 Admin Authorization

| Check | Status | Notes |
|-------|--------|-------|
| Admin role verified from DB profile | ✅ | Not JWT `user_metadata` (client-supplied at signup) |
| Non-admin users redirected to `/` | ✅ | `redirect("/")` if `role !== "admin"` |
| Unauthenticated users redirected to `/` | ✅ | `redirect("/")` if no user |
| Admin layout runs before page render | ✅ | Layout-level guard, not per-page |

### 1.3 Guest Identity

| Check | Status | Notes |
|-------|--------|-------|
| Guest ID in HttpOnly cookie | ✅ | Client JS cannot read or forge |
| Guest ID validated as UUID | ✅ | `isValidGuestId()` rejects non-UUID values |
| `getGuestId()` mints + sets cookie immediately | ✅ | Previously minted but never persisted |
| `readGuestId()` doesn't mint new ID | ✅ | Used in migration to avoid side-effect |
| `clearGuestId()` expires cookie | ✅ | `maxAge: 0` |
| Garden API ignores client-supplied guestId | ✅ | "intentionally IGNORED" — derived from cookie only |

---

## 2. Chat / AI Flow

### 2.1 Message Lifecycle

| Check | Status | Notes |
|-------|--------|-------|
| System prompt owned by server | ✅ | Client `role:"system"` rejected by Zod schema |
| Verified DB context fetched before AI call | ✅ | `fetchVerifiedContext()` queries herbs + interactions |
| User-supplied data marked as UNTRUSTED | ✅ | Prompt-injection defense framing |
| AI response cached by prompt hash | ✅ | SHA-256 of full message array (includes system prompt → locale-specific) |
| Cache only stores primary model responses | ✅ | Fallback model output not cached (quality concern) |
| Cached responses re-guarded on read | ✅ | `guardResponse()` called on cache hit |
| Streaming with 30s timeout | ✅ | `scheduleTimeout()` cancels reader |
| Model fallback chain | ✅ | Primary → free models, stops on 401/429 |
| Error messages don't leak internals | ✅ | "AI service is temporarily unavailable" |
| Body size limit (50KB) | ✅ | `MAX_BODY_SIZE` check |
| Message count limit (50) | ✅ | Zod `.max(50)` |
| Content length limit (8000 chars/msg) | ✅ | Zod `.max(8000)` |

### 2.2 Safety Guard

| Check | Status | Notes |
|-------|--------|-------|
| Hard blocks (medication cessation, cure claims, etc.) | ✅ | 20 EN + 10 FR regex patterns |
| Soft warns (diagnostic language, guarantees, etc.) | ✅ | 11 EN + 9 FR regex patterns |
| Both locale pattern sets always loaded | ✅ | French abuse can't bypass English session |
| Adversarial normalization (leet-speak, zero-width chars) | ✅ | NFKD decomposition, char substitution |
| Server-side guard on cache write | ✅ | `persistToCache` calls `guardResponse` first |
| Server-side guard on cache read | ✅ | Re-guarded on hit |
| Client-side guard on live stream | ✅ | `evaluateAssistantContent` in chat-interface |
| Bilingual refusal/warning messages | ✅ | EN + FR localized strings |

### 2.3 Guest Chat Persistence

| Check | Status | Notes |
|-------|--------|-------|
| RPC functions (SECURITY DEFINER) | ✅ | Anon key safe for guest operations |
| Session ownership verified before message fetch | ✅ | Session found in guest's own list first |
| `addGuestMessage` takes `p_guest_id` | ✅ | RPC enforces ownership |
| Delete session scoped to guest_id | ✅ | `delete_guest_chat_session` RPC |

### 2.4 Context Fetcher

| Check | Status | Notes |
|-------|--------|-------|
| Herb name extraction (common names + DB search) | ✅ | 50+ common herbs in set, DB fallback |
| Medication name extraction | ✅ | 100+ common medications in set |
| Up to 5 herbs looked up in parallel | ✅ | `Promise.all` |
| Interactions cross-referenced | ✅ | Herb × drug matching |
| **Herb data not localized** | ⚠️ LOW | `lookupHerb` returns raw DB rows — no `localizeHerb()` call. AI system prompt always gets English herb descriptions/uses. The AI translates as it responds, but verified data section is English-only. |
| **Sequential DB queries for herb extraction** | ℹ️ INFO | `extractHerbNames` does a DB query, then `lookupHerb` does up to 5 more queries (parallelized). Could batch into fewer queries. |

---

## 3. Herb Database Flow

### 3.1 Search & Browse

| Check | Status | Notes |
|-------|--------|-------|
| Keyword expansion via synonym map | ✅ | `expandQueryToKeywords()` |
| Symptom keyword overlap search | ✅ | `overlaps("symptom_keywords", keywords)` |
| Text search fallback (ILIKE) | ✅ | name, scientific_name, description |
| Evidence-level ordering for keyword matches | ✅ | A→B→C→D→trad |
| Pagination (20/page) | ✅ | `ITEMS_PER_PAGE` |
| Query length capped (200 chars) | ✅ | `MAX_QUERY_LENGTH` |
| Results localized via `localizeHerb` | ✅ | Per-herb FR overlay with EN fallback |
| Categories localized via `localizeCategoryName` | ✅ | `name_fr` column |
| **Server action reads locale from cookie, not x-locale header** | ⚠️ MEDIUM | `herbs.ts:getLocale()` reads `herbally-locale` cookie instead of `x-locale` header. This is the same stale pattern fixed in `herbs/page.tsx` and `calculator/page.tsx`. The cookie can drift from the URL, causing French-URL visitors to get English herb data from server actions. |

### 3.2 Herb Detail

| Check | Status | Notes |
|-------|--------|-------|
| SSG for top 200 herbs | ✅ | `generateStaticParams` with `view_count` ordering |
| ISR (24h revalidation) | ✅ | `revalidate = 86400` |
| 404 on missing slug | ✅ | `notFound()` called, PGRST116 suppressed |
| Drug interactions localized | ✅ | `localizeInteraction()` per interaction |
| Monograph generation | ✅ | `generateMonograph()` for safety notes |
| Comparison herbs fetched | ✅ | `getComparisonHerbs()` |
| Pre-generated FAQs | ✅ | `HerbFAQSchema` with structured data |
| Breadcrumbs with localized "Home" | ✅ | `t("common.breadcrumbHome")` (fixed in this PR) |
| SEO: WebPageSchema, HerbSchema, FAQSchema | ✅ | All generated with localized data |

### 3.3 Daily Herb

| Check | Status | Notes |
|-------|--------|-------|
| Deterministic per UTC date | ✅ | `dayOfYear % count` |
| Stable ordering | ✅ | `.order("name")` before range |
| Benefit from first traditional use or description | ✅ | Fallback chain |
| Localized | ✅ | `localizeHerb()` applied |

### 3.4 API Search Endpoints

| Check | Status | Notes |
|-------|--------|-------|
| `/api/herbs/search` rate limited | ✅ | 30/min |
| `/api/herbs/random` rate limited | ✅ | 20/min |
| `/api/interpret-search` rate limited | ✅ | 20/min |
| Search results deduplicated | ✅ | `Set` tracking by herb id |
| Search results sorted by evidence level | ✅ | A→B→C→D→trad |
| **Search results not localized** | ⚠️ LOW | `/api/herbs/search` returns raw DB rows without `localizeHerb()`. French users get English herb names in search API results. (The server action `searchHerbs` in `herbs.ts` does localize, but the API route does not.) |
| **Search term not sanitized for ILIKE wildcards** | ℹ️ INFO | User search term used directly in `ilike.%${term}%`. A `%` in the search term becomes a wildcard. Not a security issue (Supabase parameterizes), but could return unexpected results. |

---

## 4. Garden Flow

### 4.1 Add / Remove / Sync

| Check | Status | Notes |
|-------|--------|-------|
| Local-first (localStorage) with server sync | ✅ | `local-garden.ts` + `/api/garden` |
| Authenticated users: RLS-scoped writes | ✅ | `user_id` via server client |
| Guest users: admin client with cookie-derived guestId | ✅ | Not client-supplied |
| Upsert with conflict resolution | ✅ | `onConflict: "user_id,herb_slug"` or `"guest_id,herb_slug"` |
| DELETE scoped to user/guest | ✅ | `.eq("user_id", user.id)` or `.eq("guest_id", guestId)` |
| Rate limited (30/min) | ✅ | |
| Input validated (Zod) | ✅ | `herbSchema` with length limits |
| Max 100 herbs per sync | ✅ | `.max(100)` |
| Local + server merge on load | ✅ | `mergeServerGarden()` |

### 4.2 Streak Tracking

| Check | Status | Notes |
|-------|--------|-------|
| Visit recording via localStorage | ✅ | `recordVisit()` |
| Explored count tracked | ✅ | `getExploredCount()` |
| Streak calculation | ✅ | Day-by-day comparison |

---

## 5. Donation Flow

### 5.1 Checkout Creation

| Check | Status | Notes |
|-------|--------|-------|
| Stripe checkout session created server-side | ✅ | `/api/donate` POST |
| Amount validated (100¢ min, $10K max) | ✅ | Zod schema |
| Rate limited (10/min) | ✅ | |
| Success/cancel URLs point to app | ✅ | `success_url`, `cancel_url` |
| No client-supplied idempotency key | ✅ | Checkout sessions aren't charges |
| Stripe not configured → 503 | ✅ | Graceful degradation |
| Error details not leaked | ✅ | Generic "Failed to create checkout session" |

### 5.2 Webhook Processing

| Check | Status | Notes |
|-------|--------|-------|
| Signature verification | ✅ | `constructEvent()` |
| Idempotency guard (webhook_events table) | ✅ | Unique constraint on event id |
| Multiple event types handled | ✅ | completed, async_succeeded, expired, failed, refunded, disputed |
| DB errors return 500 (Stripe retries) | ✅ | |
| Full vs partial refund distinction | ✅ | `amount_refunded` vs `amount_captured` |
| Donation status tracking | ✅ | completed, pending, expired, failed, refunded, partially_refunded, disputed |

---

## 6. Dosage Calculator Flow

| Check | Status | Notes |
|-------|--------|-------|
| Four formulas (Clark's, Young's, BSA, Fried's) | ✅ | Medically recognized |
| Auto-recommendation based on available data | ✅ | `recommendFormula()` |
| Dose clamped to adult reference | ✅ | Prevents overdose from implausible input |
| Weight unit conversion (kg ↔ lbs) | ✅ | `lbsToKg()`, `kgToLbs()` |
| Pre-fill from herb data | ✅ | `parseDosage()` extracts dose + unit |
| Form labels localized | ✅ | `t()` for all labels |
| Error messages localized | ✅ | `t("calculator.errors.*")` |

---

## 7. i18n / Locale Flow

| Check | Status | Notes |
|-------|--------|-------|
| URL is single source of truth | ✅ | `/fr/*` → rewrite with `x-locale` header |
| Cookie as first-visit hint only | ✅ | Never used for rendering |
| Proxy handles locale routing | ✅ | Custom proxy replaces next-intl middleware |
| Accept-Language detection with q-weights | ✅ | `detectLocaleFromAcceptLanguage()` |
| Hard navigation on toggle | ✅ | `window.location.assign()` |
| Keyboard shortcut (⌘+⇧+L) | ✅ | |
| First-visit banner for detected language | ✅ | sessionStorage dismiss |
| Screen reader announcement on change | ✅ | `aria-live="polite"` |
| Sitemap includes both locales | ✅ | Every URL has EN + FR counterpart |
| hreflang alternates on all pages | ✅ | `buildAlternateUrls()` |
| `<html lang>` dynamically set | ✅ | From `getLocaleFromRequest()` |
| Dictionary key parity (1000/1000) | ✅ | |
| **All French pages verified clean** | ✅ | No English UI text on any /fr/* page |

---

## 8. Security

### 8.1 Input Validation

| Check | Status | Notes |
|-------|--------|-------|
| Zod schemas on all API routes | ✅ | Every route validates input |
| Body size limits (chat: 50KB, interpret-search: 10KB) | ✅ | |
| Message content length capped (8000 chars) | ✅ | |
| Search term length capped (200 chars) | ✅ | |
| Medication array capped (20 items, 200 chars each) | ✅ | |

### 8.2 Rate Limiting

| Check | Status | Notes |
|-------|--------|-------|
| Chat: 20/min + 200/day (two-tier) | ✅ | In proxy (before session refresh) |
| Donate: 10/min | ✅ | |
| Garden: 30/min | ✅ | |
| Herbs search: 30/min | ✅ | |
| Herbs random: 20/min | ✅ | |
| Interpret search: 20/min | ✅ | |
| OpenFDA: 20/min | ✅ | |
| RxNorm: 20/min | ✅ | |
| Health: 30/min | ✅ | |
| Web vitals: 60/min | ✅ | |
| **Memory-based limiter doesn't work across instances** | ⚠️ MEDIUM | If `RATE_LIMIT_BACKEND` is not set to `upstash`, each serverless instance has its own counter. An attacker can multiply their rate by the number of instances. Code warns in production, but doesn't fail. |
| **`/api/chat` has no in-route rate limiting** | ℹ️ INFO | Relies on proxy. If proxy is bypassed (misconfigured matcher), no fallback. All other routes have their own rate limiting. |

### 8.3 Headers & CSP

| Check | Status | Notes |
|-------|--------|-------|
| Content-Security-Policy | ✅ | `default-src 'self'`, Stripe whitelisted |
| X-Frame-Options: DENY | ✅ | Clickjacking protection |
| X-Content-Type-Options: nosniff | ✅ | |
| Referrer-Policy: strict-origin-when-cross-origin | ✅ | |
| HSTS in production | ✅ | `max-age=63072000; includeSubDomains; preload` |
| Permissions-Policy | ✅ | camera, microphone, geolocation disabled |

### 8.4 Data Access

| Check | Status | Notes |
|-------|--------|-------|
| RLS on authenticated writes | ✅ | `auth.uid() = user_id` |
| Service role only in admin routes + guest writes | ✅ | Never exposed to client |
| Anon client for public reads | ✅ | Safe for read-only |
| Health endpoint doesn't leak details | ✅ | Only aggregate status returned publicly |
| Web vitals stored via anon key | ✅ | If RLS allows anon INSERT |
| Guest ID HttpOnly + UUID-validated | ✅ | |

### 8.5 Supabase Middleware

| Check | Status | Notes |
|-------|--------|-------|
| Session refresh in proxy | ✅ | `updateSession()` called after locale routing |
| Non-null assertions on env vars | ⚠️ LOW | `process.env.NEXT_PUBLIC_SUPABASE_URL!` will throw `TypeError` if unset. Health check detects this, but middleware crashes silently on cold start without env vars. |

---

## 9. SEO Flow

| Check | Status | Notes |
|-------|--------|-------|
| Dynamic metadata per page | ✅ | `generateMetadata()` with locale-aware titles |
| hreflang alternates | ✅ | `buildAlternateUrls()` generates en, fr, x-default |
| Sitemap includes all pages × 2 locales | ✅ | Static + dynamic (herbs, symptoms, comparisons, categories) |
| Sitemap revalidates hourly | ✅ | `revalidate = 3600` |
| robots.txt blocks /admin and /api | ✅ | |
| Structured data (Organization, Herb, FAQ, WebPage) | ✅ | JSON-LD on all relevant pages |
| OpenGraph + Twitter cards | ✅ | Localized per locale |
| `<html lang>` dynamic | ✅ | |
| `trailingSlash: false` | ✅ | Consistent URL structure |

---

## 10. Service Worker / PWA

| Check | Status | Notes |
|-------|--------|-------|
| Registered only in production | ✅ | `NODE_ENV === "production"` |
| Static page caching | ✅ | Core pages cached on install |
| API network-first with cache fallback | ✅ | |
| Herb detail cache-first with network update | ✅ | Stale-while-revalidate |
| Navigation network-first with offline fallback | ✅ | `/offline.html` |
| Chat excluded from caching | ✅ | `/api/chat` skipped |
| **References `/api/herbs/list` which doesn't exist** | ⚠️ MEDIUM | `DB_CACHE_URLS` includes `/api/herbs/list` but there's no such route. The `catch(() => {})` silently swallows the error, but offline herb browsing via this cache path will never work. Should reference `/api/herbs/search` instead. |
| **French pages not cached** | ⚠️ LOW | `STATIC_URLS` only includes English paths (`/`, `/herbs`, etc.). French users visiting `/fr/herbs` offline get the generic offline page, not the cached French page. Should include `/fr/*` equivalents. |
| Cache versioning | ✅ | `herbally-v5` allows cache busting on deploy |

---

## 11. Build / Deploy / CI

### 11.1 CI Pipeline

| Check | Status | Notes |
|-------|--------|-------|
| Secret scanning | ✅ | `detect-secrets.sh` runs on every push/PR |
| Lint | ✅ | ESLint |
| Typecheck | ✅ | `tsc --noEmit` |
| Unit tests | ✅ | Vitest |
| Coverage report | ✅ | Generated but no threshold enforced |
| Format check | ✅ | Prettier |
| E2E tests | ✅ | Playwright with placeholder env vars |
| DB integrity check | ✅ | `verify-herb-database.ts` |
| Branch protection on main | ✅ | PR required, status checks enforced |

### 11.2 Build

| Check | Status | Notes |
|-------|--------|-------|
| Standalone output | ✅ | `output: "standalone"` for Docker |
| Bundle analyzer | ✅ | `ANALYZE=true` env var |
| Sentry source maps | ✅ | `widenClientFileUpload: true` |
| Sentry tunnel route | ✅ | `/monitoring` bypasses ad-blockers |
| Bundle optimization | ✅ | `optimizePackageImports` for lucide-react, react-markdown |
| Image optimization | ✅ | AVIF + WebP, Supabase remote patterns |

### 11.3 Docker

| Check | Status | Notes |
|-------|--------|-------|
| Multi-stage build | ✅ | Build + runner stages |
| Non-root user | ✅ | `nextjs:nodejs` |
| Health check | ✅ | `/api/health` every 30s |
| Telemetry disabled | ✅ | `NEXT_TELEMETRY_DISABLED=1` |

### 11.4 Test Coverage

| Metric | Value | Assessment |
|--------|-------|------------|
| Statements | 26.47% | ⚠️ LOW |
| Branches | 19.37% | ⚠️ LOW |
| Functions | 22.99% | ⚠️ LOW |
| Lines | 26.63% | ⚠️ LOW |
| Well-tested areas | i18n routing (100%), dosage calculations (96.97%), safety guard, rate limiting | |
| Untested areas | Supabase clients (0%), metadata (0%), SEO (0%), server actions (0%) | |

---

## 12. Error Handling

| Check | Status | Notes |
|-------|--------|-------|
| Per-route error boundaries | ✅ | Every route group has error.tsx |
| Shared RouteErrorBoundary component | ✅ | All error.tsx use translations |
| Loading states with localized text | ✅ | Shared LoadingState component |
| Global error page (English-only) | ✅ | By design — next-intl unavailable |
| 404 page localized | ✅ | Uses `useTranslations()` |
| Sentry exception capture | ✅ | In all error boundaries |
| Dev error details | ✅ | `NODE_ENV === "development"` shows stack trace |
| API error responses don't leak internals | ✅ | Generic messages + server-side logging |

---

## 13. Analytics

| Check | Status | Notes |
|-------|--------|-------|
| Vercel Analytics custom events | ✅ | `trackEvent()` with type-safe event names |
| Events: chat, herb_viewed, dosage_calculated, etc. | ✅ | 7 tracked event types |
| Language change tracked (dropdown, hotkey, banner, drawer) | ✅ | All 4 sources tracked |
| Core Web Vitals collected | ✅ | `/api/analytics/vitals` POST |
| Vitals stored in Supabase | ✅ | Via anon client |

---

## Summary of Findings

### Medium Severity (2)

| # | Finding | File(s) | Impact |
|---|---------|---------|--------|
| M1 | Server action `getLocale()` reads cookie instead of `x-locale` header | `src/lib/actions/herbs.ts` | French-URL visitors may get English herb data from server actions if cookie drifts from URL |
| M2 | Service worker caches non-existent `/api/herbs/list` endpoint | `public/sw.js` | Offline herb browsing silently fails; cache entry never populated |

### Low Severity (9)

| # | Finding | File(s) | Impact |
|---|---------|---------|--------|
| L1 | Context-fetcher doesn't localize herb data for AI prompt | `src/lib/ai/context-fetcher.ts` | AI verified data section always English; AI translates on-the-fly |
| L2 | API search route doesn't localize results | `src/app/api/herbs/search/route.ts` | French users get English herb names from search API |
| L3 | Search term not sanitized for ILIKE wildcards | `src/app/api/herbs/search/route.ts` | `%` in search becomes wildcard (not security issue) |
| L4 | Service worker doesn't cache French pages | `public/sw.js` | French users get generic offline page instead of cached `/fr/*` |
| L5 | Supabase middleware non-null assertions on env vars | `src/lib/supabase/middleware.ts` | Cold start crash if env vars missing |
| L6 | `/api/chat` has no in-route rate limiting | `src/app/api/chat/route.ts` | Relies solely on proxy; no fallback if matcher misconfigured |
| L7 | Context-fetcher does sequential DB queries | `src/lib/ai/context-fetcher.ts` | Up to 7 DB round-trips per chat message (could batch) |
| L8 | Test coverage at 26.47% | Project-wide | Critical paths (server actions, auth, API routes) untested |
| L9 | No coverage threshold enforced in CI | `.github/workflows/ci.yml` | Coverage can regress without failing build |

### Informational (4)

| # | Finding | Notes |
|---|---------|-------|
| I1 | Memory rate limiter default in production | Code warns; requires explicit `RATE_LIMIT_BACKEND=upstash` config |
| I2 | Chat cache uses anon key for reads | Safe — RLS allows anon SELECT on cache table |
| I3 | `chat.ts` is types-only (dead server actions removed) | Documented in comments; correct cleanup |
| I4 | Service worker `API_CACHE` never cleaned on version bump | Only `CACHE_NAME` changes trigger cleanup; `API_CACHE` persists across deploys |

---

## Architecture Strengths

1. **URL-as-source-of-truth locale system** — Eliminates cookie/URL drift. Proxy sets `x-locale` header, all server components read from it.
2. **Defense-in-depth AI safety** — Bilingual regex patterns, adversarial normalization, server+client guards, cache re-guarding.
3. **Guest → authenticated data migration** — Idempotent, deduplicating, never blocks login, clears cookie after.
4. **Prompt injection defense** — User data framed as UNTRUSTED in system prompt, `role:"system"` rejected from client.
5. **Stripe webhook idempotency** — Event dedup table + 500-on-error for retry semantics.
6. **Admin auth from DB, not JWT** — Prevents privilege escalation via client-supplied metadata.
7. **Comprehensive rate limiting** — Two-tier chat limits, per-endpoint limits across all API routes.
8. **Proper error boundaries** — Per-route, localized, with Sentry capture and dev details.

---

*End of audit report.*