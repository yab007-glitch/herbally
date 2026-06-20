# Language i18n Audit Report — HerbAlly

**Date:** 2025-06-19  
**Scope:** Language option configuration, language toggle mechanism, language content/dictionaries  
**Architecture:** Next.js 16 + `next-intl` v4 + custom proxy/middleware locale routing  

---

## Executive Summary

The i18n system is architecturally sound — the "URL as single source of truth" design (no next-intl middleware, custom proxy rewrites with `x-locale` header) avoids the classic cookie/URL drift bug. Dictionary key parity is perfect (949/949 keys in both EN and FR), ICU placeholder interpolation matches 100%, and French content quality is high with zero machine-detected untranslated strings.

However, there are **22 empty `symptomMeta.desc` values in EN** (FR has them filled), **dead/unused locale-reading code** in two pages, **several hardcoded English-only strings** in client components, and a **configurational ambiguity** between the top-level `i18n/routing.ts` and the custom routing layer.

**Severity breakdown:** 3 medium, 9 low, 4 informational.

---

## 1. Language Option Configuration

### 1.1 `src/lib/i18n/config.ts` — Language Definitions

```ts
export const LANGUAGES = [
  { code: "en", name: "English", nativeName: "English", flag: "🇺🇸" },
  { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷" },
] as const;
```

| Check | Status | Notes |
|-------|--------|-------|
| Supported locales defined | ✅ | `["en", "fr"]` with `as const` for type safety |
| Default locale defined | ✅ | `DEFAULT_LOCALE = "en"` |
| Locale type exported | ✅ | `type Locale = "en" \| "fr"` |
| Display metadata (flag, nativeName) | ✅ | Used in selector and drawer |
| Flag choice | ⚠️ LOW | English uses 🇺🇸 (US flag) — may confuse Canadian/UK users. Consider 🇬🇧 or a generic icon. Cosmetic only. |

### 1.2 `i18n/routing.ts` (top-level, used by `next-intl/plugin`)

```ts
export const routing = defineRouting({
  locales: ["en", "fr"],
  defaultLocale: "en",
  localePrefix: "never",
  localeCookie: { name: "herbally-locale", maxAge: 60*60*24*365, sameSite: "lax" },
});
```

| Check | Status | Notes |
|-------|--------|-------|
| Locales match config.ts | ✅ | `["en", "fr"]` in both files |
| Cookie name matches proxy | ✅ | `herbally-locale` in both `i18n/routing.ts` and `src/proxy.ts` |
| `localePrefix: "never"` | ⚠️ MEDIUM | See §1.4 below |

### 1.3 `src/lib/i18n/routing.ts` — Custom Routing Helpers

Functions: `isLocalePrefixed`, `getLocaleFromPathname`, `stripLocalePrefix`, `addLocalePrefix`, `buildAlternateUrls`.

| Check | Status | Notes |
|-------|--------|-------|
| Only `/fr` is prefixed (en is unprefixed) | ✅ | Correct — English is default, no prefix needed |
| Edge cases handled (`/fr` bare, `/fr/`, `/fr/herbs`) | ✅ | 19 unit tests, all passing |
| `buildAlternateUrls` generates hreflang correctly | ✅ | Includes `en`, `fr`, `x-default` |
| Hardcoded `LOCALE_PREFIX = "/fr"` | ⚠️ LOW | Not derived from `LOCALES` or `DEFAULT_LOCALE`. If a third locale is added, this must be manually updated. Consider deriving from config. |

### 1.4 Configurational Ambiguity (MEDIUM)

There are **two separate routing configurations** that could drift:

1. **`i18n/routing.ts`** — `next-intl`'s `defineRouting` with `localePrefix: "never"`. This tells the `next-intl` plugin not to add locale prefixes to URLs. It's consumed by `createNextIntlPlugin("./i18n/request.ts")` in `next.config.ts`.

2. **`src/lib/i18n/routing.ts`** — Custom helpers that manually manage `/fr` prefix. Used by `src/proxy.ts` and `use-set-locale.ts`.

The `localePrefix: "never"` in the `next-intl` config is **correct** for this architecture — the proxy manually handles prefixing, so `next-intl` should not interfere. However, the two configs define locales and cookie settings independently, creating a maintenance risk if one is updated without the other.

**Recommendation:** Have `i18n/routing.ts` import `LOCALES` and `DEFAULT_LOCALE` from `src/lib/i18n/config.ts` so there's one source of truth for the locale list.

### 1.5 `i18n/request.ts` — Server-side Request Config

| Check | Status | Notes |
|-------|--------|-------|
| Reads `x-locale` header (set by proxy) | ✅ | Primary mechanism |
| Falls back to pathLocale, then DEFAULT_LOCALE | ✅ | Defense in depth |
| Loads dictionaries statically (not dynamic import) | ✅ | Both EN and FR JSON bundled — no async file I/O |
| Time zone set | ✅ | `"America/Toronto"` (could be configurable, but fine for now) |

### 1.6 `src/proxy.ts` (middleware) — Locale Detection & Routing

| Check | Status | Notes |
|-------|--------|-------|
| Accept-Language parsing with q-weights | ✅ | Correctly sorted by quality value |
| Cookie as first-visit hint only | ✅ | Only seeds cookie if not already set |
| `/fr/*` rewrite with `x-locale` header | ✅ | Clean rewrite pattern |
| Redirect to `/fr/*` for French-preferring first visitors | ✅ | Uses `cookieLocale ?? acceptLangLocale` |
| Excluded paths list | ✅ | `/api`, `/auth`, `/_next`, etc. |
| No next-intl middleware used | ✅ | Correct — custom proxy replaces it |
| `detectLocaleFromAcceptLanguage` returns `DEFAULT_LOCALE` | ✅ | Falls back to "en" for unsupported languages |

---

## 2. Language Toggle Mechanism

### 2.1 `use-set-locale.ts` — Core Toggle Hook

```ts
export function useSetLocale() {
  return useCallback((locale: Locale) => {
    document.cookie = `herbally-locale=${locale};path=/;max-age=31536000;SameSite=Lax${secureFlag}`;
    localStorage.setItem("herbally-locale", locale);
    // ... build target URL via routing helpers ...
    window.location.assign(target);  // hard navigation
  }, []);
}
```

| Check | Status | Notes |
|-------|--------|-------|
| Hard navigation (full page reload) | ✅ | Eliminates partial-translation state drift |
| Cookie + localStorage persisted | ✅ | Both set as first-visit hints |
| Secure flag conditional on HTTPS | ✅ | `;Secure` appended when on HTTPS |
| Uses routing helpers (not hand-rolled) | ✅ | `isLocalePrefixed`, `addLocalePrefix`, `stripLocalePrefix` |
| Already-prefixed path handled | ✅ | If already on `/fr/herbs` and switching to FR, stays put |
| Bare `/fr` homepage handled | ✅ | `addLocalePrefix("/", "fr")` → `/fr` |
| No double-prefix risk | ✅ | E2E test explicitly checks `url should not match /\/fr\/fr/` |

### 2.2 `use-detected-locale.ts` — Browser Language Detection

```ts
export function useDetectedLocale(): Locale | null {
  return useMemo(() => {
    if (typeof window === "undefined") return null;
    const saved = localStorage.getItem("herbally-locale");
    if (saved) return null;  // user already chose
    const browserLang = navigator.language.split("-")[0];
    if (browserLang === "fr" || browserLang === "en") return browserLang as Locale;
    return null;
  }, []);
}
```

| Check | Status | Notes |
|-------|--------|-------|
| SSR-safe (returns null on server) | ✅ | `typeof window === "undefined"` check |
| Returns null if user has saved preference | ✅ | Respects explicit choice |
| Only detects `fr` or `en` | ✅ | Other languages → null (no suggestion shown) |
| `useMemo` with empty deps | ✅ | Runs once, doesn't re-detect on re-render |

### 2.3 `use-language-hotkey.ts` — Keyboard Shortcut

| Check | Status | Notes |
|-------|--------|-------|
| Ctrl/Cmd + Shift + L toggles language | ✅ | |
| `preventDefault` stops browser conflict | ✅ | Avoids address-bar focus |
| Cleanup on unmount | ✅ | `removeEventListener` in effect cleanup |
| `onToggle` in dependency array | ✅ | Re-binds if callback changes |

### 2.4 `LanguageSelector` (Desktop Dropdown)

| Check | Status | Notes |
|-------|--------|-------|
| Globe icon + locale code visible | ✅ | `"EN"` or `"FR"` shown on sm+ screens |
| `sr-only` label for accessibility | ✅ | `t("common.changeLanguage")` |
| Current locale highlighted with checkmark | ✅ | `aria-current="true"` + `Check` icon |
| Detected language suggestion shown | ✅ | Only when `detectedLocale !== locale` |
| Analytics tracked on change | ✅ | `trackEvent("language_changed", { source: "dropdown" })` |
| Keyboard hint displayed | ✅ | ⌘ + ⇧ + L visual hint at bottom |
| Hotkey registered | ✅ | `useLanguageHotkey` with analytics |

### 2.5 `LanguageDrawer` (Mobile Bottom Sheet)

| Check | Status | Notes |
|-------|--------|-------|
| Full-width buttons, large tap targets | ✅ | `py-2.5`, `text-xl` flags |
| Controlled via `open`/`onOpenChange` props | ✅ | Parent controls visibility |
| `hideTrigger` prop for external trigger | ✅ | Used from navbar mobile menu |
| Current locale highlighted | ✅ | `aria-current`, bg highlight, checkmark |
| Detected locale suggestion | ✅ | Same pattern as dropdown |
| **Missing: analytics tracking** | ⚠️ LOW | The drawer's `setLocale` calls do NOT call `trackEvent("language_changed", ...)`. The dropdown and hotkey both track, but the drawer does not. Language changes via the mobile drawer are invisible to analytics. |
| **Missing: hotkey support** | ℹ️ INFO | The hotkey is registered in `LanguageSelector` (desktop only). On mobile this is expected. |

### 2.6 `FirstVisitBanner` — Auto-suggestion Banner

| Check | Status | Notes |
|-------|--------|-------|
| Only shows when `detected !== locale` | ✅ | |
| `sessionStorage` dismiss persistence | ✅ | `"herbally-lang-banner-dismissed"` |
| SSR renders `dismissed=true` (no flash) | ✅ | `typeof window === "undefined" → true` |
| Labels hardcoded (not from dictionary) | ⚠️ LOW | The `labels` object uses hardcoded English/French strings instead of translation keys. This works because the banner always shows in the *detected* language (not the current locale), but it bypasses the dictionary system. If a third language is added, this won't scale. |
| Analytics tracked | ✅ | `source: "first_visit_banner"` |
| `role="status"` for screen readers | ✅ | |
| `z-40` positioning below sticky header | ✅ | `top-12` accounts for 48px header |

### 2.7 `LanguageAnnouncement` — Screen Reader Live Region

| Check | Status | Notes |
|-------|--------|-------|
| `aria-live="polite"` | ✅ | Non-interruptive announcement |
| `aria-atomic="true"` | ✅ | Full text announced on change |
| `sr-only` (visually hidden) | ✅ | |
| Hardcoded messages | ⚠️ LOW | Same pattern as FirstVisitBanner — hardcoded strings. Not a dictionary lookup. Functional but not scalable. |

### 2.8 `LocaleProvider` — Client-side Provider

| Check | Status | Notes |
|-------|--------|-------|
| Receives `locale` from server layout | ✅ | `getLocaleFromRequest()` → `x-locale` header |
| Both dictionaries imported statically | ✅ | `enMessages`, `frMessages` |
| `NextIntlClientProvider` wraps children | ✅ | Standard next-intl pattern |
| `timeZone="America/Toronto"` | ✅ | Consistent with `i18n/request.ts` |
| Both dicts bundled (no code-splitting) | ℹ️ INFO | ~145KB of JSON loaded on every page. For a 2-language app this is acceptable. If more locales are added, consider dynamic imports. |

### 2.9 `server-locale.ts` — Server-side Locale Reader

| Check | Status | Notes |
|-------|--------|-------|
| Reads `x-locale` header from proxy | ✅ | |
| Validates against `"fr"` or `"en"` | ✅ | Rejects arbitrary header values |
| Falls back to `DEFAULT_LOCALE` | ✅ | |
| Try-catch for static generation | ✅ | `headers()` unavailable during SSG |
| Used consistently across all pages | ✅ | All page components use this (see §3.2 exception) |

---

## 3. Language Content & Dictionaries

### 3.1 Dictionary Key Parity

| Metric | EN | FR |
|--------|----|----|
| Total leaf keys | 949 | 949 |
| Top-level namespaces | 50 | 50 |
| Missing in FR | 0 | — |
| Missing in EN | — | 0 |
| ICU placeholder mismatches | 0 | 0 |

**Verdict:** ✅ Perfect structural parity. Every key in EN exists in FR and vice versa. All `{placeholder}` interpolations match between locales.

### 3.2 Identical Values (Intentionally Same)

23 keys have identical values in both languages. All are legitimate cases where the English term is also used in French:

- Brand names: `"HerbAlly"`, `"NCCIH"`, `"PubMed"`, `"Commission E"`
- Universal terms: `"Email"`, `"Description"`, `"Pages"`, `"Standard"`
- Short labels: `"Menu"`, `"Chat"`, `"Calc"`, `"Page"`
- ICU templates: `"{name1} vs {name2}"` (format string, not translatable)
- Unit strings: `"kg / lbs"`

**Verdict:** ✅ All identical values are correct — these are proper nouns, universal terms, or format strings.

### 3.3 Untranslated Content Detection

Heuristic scan for English stop-words in FR values (≥3 matches in strings >40 chars): **0 hits**.

**Verdict:** ✅ No machine-detectable untranslated content in the French dictionary.

### 3.4 Empty Values in EN Dictionary

**22 `symptomMeta.*.desc` keys are empty strings `""` in EN**, but have content in FR:

| Key | EN | FR |
|-----|----|----|
| `symptomMeta.anxiety.desc` | `""` | `"Plantes fondées sur les preuves..."` |
| `symptomMeta.depression.desc` | `""` | `"Plantes fondées sur les preuves..."` |
| `symptomMeta.sleep.desc` | `""` | `"Plantes fondées sur les preuves..."` |
| `symptomMeta.inflammation.desc` | `""` | (has content) |
| `symptomMeta.digestion.desc` | `""` | (has content) |
| `symptomMeta.nausea.desc` | `""` | (has content) |
| `symptomMeta.constipation.desc` | `""` | (has content) |
| `symptomMeta.liver.desc` | `""` | (has content) |
| `symptomMeta.bloodPressure.desc` | `""` | (has content) |
| `symptomMeta.cholesterol.desc` | `""` | (has content) |
| `symptomMeta.circulation.desc` | `""` | (has content) |
| `symptomMeta.immune.desc` | `""` | (has content) |
| `symptomMeta.allergy.desc` | `""` | (has content) |
| `symptomMeta.menstrual.desc` | `""` | (has content) |
| `symptomMeta.menopause.desc` | `""` | (has content) |
| `symptomMeta.hormonal.desc` | `""` | (has content) |
| `symptomMeta.skin.desc` | `""` | (has content) |
| `symptomMeta.wound.desc` | `""` | (has content) |
| `symptomMeta.acne.desc` | `""` | (has content) |
| `symptomMeta.nerve.desc` | `""` | (has content) |
| `symptomMeta.prostate.desc` | `""` | (has content) |
| `symptomMeta.diabetes.desc` | `""` | (has content) |

**Impact:** The symptom detail page (`src/app/(main)/symptoms/[symptom]/page.tsx`) uses:
```ts
const description = t(`symptomMeta.${symptom}.desc`) || meta.description;
```

Since `t("")` returns `""` (falsy), the hardcoded `meta.description` fallback in the page component takes over for English. **This works** but means the English description comes from the hardcoded `symptomMeta` constant in the page file, not the dictionary — creating a hidden dual source of truth.

**Severity:** ⚠️ MEDIUM — The EN descriptions work via fallback, but:
1. The dictionary appears incomplete when inspected directly
2. The hardcoded fallback in the page file is a second, unmaintained copy
3. The `generateMetadata` function also calls `t(`symptomMeta.${symptom}.desc`)` — if it returns `""`, the metadata description falls back to the hardcoded `meta.description`, but this coupling is fragile

**Recommendation:** Populate the 22 empty `desc` values in `en.json` with the English descriptions (which already exist in the page's hardcoded `symptomMeta` constant).

### 3.5 Hardcoded English Strings (Not in Dictionary)

#### 3.5.1 Chat Follow-up Suggestions — `chat-interface.tsx`

```ts
const base = [
  "What are the side effects?",
  "What's the recommended dosage?",
  "Is it safe during pregnancy?",
];
```

These hardcoded English strings are displayed as follow-up question buttons. They are **not localized** — French users see English follow-up suggestions.

**Severity:** ⚠️ MEDIUM — Visible UX degradation for French users. These should use `useTranslations()` keys.

#### 3.5.2 Chat Empty State Suggestions — `chat-empty-state-v2.tsx`

```ts
const SUGGESTIONS = [
  { text: "Is turmeric safe with blood thinners?", label: "Turmeric + blood thinners" },
  { text: "What herbs help with anxiety?", label: "Herbs for anxiety" },
  { text: "Can I take echinacea while pregnant?", label: "Echinacea during pregnancy" },
  { text: "Tell me about ginger for nausea", label: "Ginger for nausea" },
];
```

Both the `text` (sent to AI) and `label` (displayed to user) are hardcoded English. The `label` is shown to the user and should be localized.

**Severity:** ⚠️ LOW — The `text` sent to the AI can stay in English (the AI handles multilingual input), but the `label` shown to the user should be translated.

#### 3.5.3 Markdown Renderer Severity Labels — `markdown-renderer.tsx`

```ts
contraindicated: { label: "Contraindicated", ... },
severe:          { label: "Severe", ... },
moderate:        { label: "Moderate", ... },
mild:            { label: "Mild", ... },
```

These labels are rendered in chat message severity badges. The component already has `useTranslations()` available but doesn't use it for these labels.

**Severity:** ⚠️ LOW — Four short labels that French users see in English.

#### 3.5.4 `global-error.tsx` — English-only Catastrophic Error Page

```tsx
<h1>Something went wrong</h1>
<p>We encountered an unexpected error. Please reload the page...</p>
<button>Reload page</button>
```

This is **by design** — the global error boundary replaces the entire app shell (including the `LocaleProvider`), so `next-intl` is unavailable. The `lang="en"` attribute is correctly set on `<html>`. This is an acceptable limitation.

**Severity:** ℹ️ INFO — Documented in code comments. No fix needed unless a French fallback is desired (would require embedding a minimal message map inline).

#### 3.5.5 `manifest.ts` — English-only PWA Manifest

```ts
name: "HerbAlly - Your Trusted Guide to Medicinal Herbs",
short_name: "HerbAlly",
description: "Explore 2,700+ medicinal herbs, calculate dosages, and check drug interactions.",
```

PWA manifests don't support per-locale content in the current spec. This is a known limitation.

**Severity:** ℹ️ INFO — No fix available without spec changes.

#### 3.5.6 Admin Pages — English-only (Intentional)

All `/admin/*` pages use hardcoded English labels. This is intentional — admin pages are internal tools, not user-facing.

**Severity:** ℹ️ INFO — No fix needed.

### 3.6 Database Content Localization — `localize-herb.ts`

| Check | Status | Notes |
|-------|--------|-------|
| `localizeHerb()` overlays FR fields from `herb.translations.fr` | ✅ | |
| Falls back to English when FR field is missing/empty | ✅ | Per-field fallback, not all-or-nothing |
| `localizeInteraction()` overlays FR description + mechanism | ✅ | |
| `localizeCategoryName()` uses `name_fr` column | ✅ | |
| Translation script exists (`scripts/translate-herbs-fr.ts`) | ✅ | Resumable, batched, uses OpenRouter |

### 3.7 AI Chat Localization — `system-prompt.ts`

| Check | Status | Notes |
|-------|--------|-------|
| Locale passed to `getSystemPrompt()` | ✅ | From chat API route |
| French instruction injected when `locale === "fr"` | ✅ | `"Respond in French (Français)"` |
| Locale sent from client to API | ✅ | `chat-interface.tsx` sends `locale` from `useLocale()` |
| Safety guard has French regex patterns | ✅ | `safety-guard.ts` includes `\barrêt(?:ez|er|é|ée)...` |
| Locale validated in API schema | ✅ | `z.enum(["en", "fr"]).optional()` |
| Cache keyed by locale | ✅ | `persistToCache(promptHash, fullContent, locale ?? "en")` |

---

## 4. SEO & Metadata Localization

### 4.1 `buildPageMetadata()` — `src/lib/i18n/metadata.ts`

| Check | Status | Notes |
|-------|--------|-------|
| Title/description from dictionary in active locale | ✅ | |
| Canonical URL matches active locale | ✅ | `alternates[locale]` |
| hreflang alternates generated | ✅ | `en`, `fr`, `x-default` |
| OpenGraph localized | ✅ | title, description, URL |
| Twitter card localized | ✅ | |

### 4.2 Root Layout Metadata — `src/app/layout.tsx`

| Check | Status | Notes |
|-------|--------|-------|
| `<html lang={locale}>` | ✅ | Dynamically set from `getLocaleFromRequest()` |
| `generateMetadata()` uses locale | ✅ | Title, description, OG locale (`fr_FR` or `en_US`) |
| `metadataBase` set | ✅ | From `NEXT_PUBLIC_APP_URL` |

### 4.3 Sitemap — `src/app/sitemap.ts`

| Check | Status | Notes |
|-------|--------|-------|
| Both EN and FR URLs generated | ✅ | Every page has a `/{path}` and `/fr/{path}` entry |
| Herb pages: both locales | ✅ | Batched query, both URLs per herb |
| Symptom pages: both locales | ✅ | Uses `SYMPTOM_SLUGS` from page (single source of truth) |
| Compare pages: both locales | ✅ | Uses `POPULAR_COMPARISONS` from page |
| Category pages: both locales | ✅ | |
| `revalidate = 3600` (1hr) | ✅ | |

### 4.4 Robots — `src/app/robots.ts`

| Check | Status | Notes |
|-------|--------|-------|
| Allows crawling all non-admin, non-api paths | ✅ | `disallow: ["/admin/", "/api/"]` |
| Both /fr and / paths are crawlable | ✅ | `/fr/*` not in disallow list |

---

## 5. Dead Code & Redundancy

### 5.1 Dead Locale Reading in `herbs/page.tsx` (LOW)

```ts
// Line 25-28: Dead function
async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const savedLocale = cookieStore.get("herbally-locale")?.value;
  return (savedLocale === "fr" ? "fr" : "en") as Locale;
}

// Line 40-41: Dead variable
const _locale = await getLocale();  // never used
const locale = await getLocaleFromRequest();  // actually used
```

This reads locale from the **cookie** (which can drift from the URL) and then immediately discards it in favor of `getLocaleFromRequest()` (which reads the `x-locale` header from the URL). The dead code is a leftover from before the "URL as source of truth" migration.

### 5.2 Dead Locale Reading in `calculator/page.tsx` (LOW)

```ts
// Line 40-42: Dead variables
const localeCookie = cookieStore.get("herbally-locale");
const _locale: Locale = localeCookie?.value === "fr" ? "fr" : "en";
const locale = await getLocaleFromRequest();  // actually used
```

Same pattern — reads cookie, discards it, uses header-based locale.

**Recommendation:** Remove the dead `getLocale()` function and `_locale`/`localeCookie` variables from both files. They import `cookies` from `next/headers` unnecessarily.

### 5.3 Duplicate `detectLocaleFromAcceptLanguage` Logic

The `detectLocaleFromAcceptLanguage` function in `src/proxy.ts` is **re-implemented inline** in the middleware test file (`src/__tests__/middleware.test.ts`) rather than imported. This means:
- The test doesn't test the actual production function
- If the production function changes, the test won't catch it

**Recommendation:** Export `detectLocaleFromAcceptLanguage` from a shared module and import it in both `proxy.ts` and the test.

### 5.4 Duplicate Locale Config

As noted in §1.4, locale lists are defined in both `i18n/routing.ts` (`["en", "fr"]`) and `src/lib/i18n/config.ts` (`LOCALES = ["en", "fr"]`). These are not linked.

---

## 6. Accessibility Audit

| Check | Status | Notes |
|-------|--------|-------|
| `<html lang>` attribute set dynamically | ✅ | Reflects active locale |
| Language selector has `aria-label` | ✅ | `t("common.changeLanguage")` |
| `aria-current` on active language option | ✅ | `"true"` for selected |
| Screen reader announcement on locale change | ✅ | `LanguageAnnouncement` live region |
| Skip-to-content link | ✅ | In root layout |
| Keyboard shortcut for language toggle | ✅ | Ctrl/Cmd + Shift + L |
| Banner has `role="status"` | ✅ | FirstVisitBanner |
| Dismiss button has `aria-label` | ✅ | `t.dismiss` (hardcoded but present) |
| Focus styles on selector trigger | ✅ | `focus-visible:ring-3` |

---

## 7. Test Coverage

### 7.1 Unit Tests

| File | Tests | Status |
|------|-------|--------|
| `src/lib/i18n/__tests__/routing.test.ts` | 19 | ✅ All pass |
| `src/lib/i18n/__tests__/server-locale.test.ts` | 3 | ✅ All pass |
| `src/__tests__/middleware.test.ts` | 11 | ⚠️ Tests inline reimplementation, not actual function |

### 7.2 E2E Tests

| File | Coverage | Status |
|------|----------|--------|
| `e2e/language-toggle.spec.ts` | en→fr→en round-trip on `/` and `/herbs` | ✅ Comprehensive |
| Checks URL matches locale | ✅ | No `/fr/fr` double-prefix |
| Checks `<html lang>` attribute | ✅ | |
| Checks rendered text language | ✅ | Verifies French words appear, English words gone |
| Auto-skips on local standalone server | ✅ | `x-locale` forwarding not available locally |

### 7.3 Missing Test Coverage

- No test for `useSetLocale` hook (URL construction logic)
- No test for `useDetectedLocale` hook
- No test for `useLanguageHotkey` hook
- No test for `FirstVisitBanner` visibility logic
- No test for dictionary key parity (should be a CI check)
- No test for empty `symptomMeta.desc` values in EN

---

## 8. Summary of Findings

### Medium Severity (3)

| # | Finding | File(s) | Recommendation |
|---|---------|---------|----------------|
| M1 | 22 empty `symptomMeta.*.desc` in EN dictionary | `en.json` | Fill with English descriptions (copy from page's hardcoded `symptomMeta`) |
| M2 | Chat follow-up suggestions hardcoded in English | `chat-interface.tsx` | Move to dictionary with `useTranslations()` |
| M3 | Dual locale config not linked | `i18n/routing.ts` + `src/lib/i18n/config.ts` | Import `LOCALES`/`DEFAULT_LOCALE` from config in `i18n/routing.ts` |

### Low Severity (9)

| # | Finding | File(s) | Recommendation |
|---|---------|---------|----------------|
| L1 | `LanguageDrawer` doesn't track analytics | `language-drawer.tsx` | Add `trackEvent("language_changed", { source: "drawer" })` |
| L2 | `FirstVisitBanner` labels hardcoded (not from dictionary) | `first-visit-banner.tsx` | Acceptable for 2 langs; add dict keys if scaling |
| L3 | `LanguageAnnouncement` messages hardcoded | `language-announcement.tsx` | Same as L2 |
| L4 | Chat empty state labels in English | `chat-empty-state-v2.tsx` | Localize the `label` field |
| L5 | Markdown renderer severity labels in English | `markdown-renderer.tsx` | Use `t()` with existing `useTranslations()` |
| L6 | Dead `getLocale()` function + `_locale` variable | `herbs/page.tsx` | Remove dead code |
| L7 | Dead `localeCookie` + `_locale` variable | `calculator/page.tsx` | Remove dead code |
| L8 | `LOCALE_PREFIX = "/fr"` hardcoded, not derived from config | `src/lib/i18n/routing.ts` | Derive from `LOCALES`/`DEFAULT_LOCALE` |
| L9 | Middleware test re-implements function inline | `middleware.test.ts` | Export and import actual function |

### Informational (4)

| # | Finding | Notes |
|---|---------|-------|
| I1 | `global-error.tsx` is English-only | By design — next-intl unavailable in global error boundary |
| I2 | `manifest.ts` is English-only | PWA spec limitation |
| I3 | Admin pages are English-only | Intentional — internal tool |
| I4 | Both dictionaries bundled (no code-splitting) | Acceptable for 2 locales; revisit if scaling |

---

## 9. Architecture Assessment

### Strengths

1. **URL as single source of truth** — Eliminates cookie/URL drift. Hard navigation on toggle guarantees full re-render.
2. **Proxy-based locale routing** — Custom proxy (middleware) replaces next-intl middleware, giving full control over rewrite/redirect behavior.
3. **`x-locale` header propagation** — Server components read locale from the request header, not cookies, ensuring SSR and client always agree.
4. **Comprehensive dictionary coverage** — 949 keys, 50 namespaces, zero missing translations, zero ICU mismatches.
5. **SEO-complete** — hreflang, sitemap (both locales), localized metadata, `<html lang>` all correct.
6. **Safety-guard bilingual** — AI safety regex patterns cover both English and French medication cessation language.
7. **E2E regression test** — Dedicated suite verifies the toggle bug fix and checks rendered text language.

### Weaknesses

1. **Scattered hardcoded English strings** in chat-related components (follow-ups, empty state, severity labels).
2. **Dictionary appears incomplete** (empty EN `desc` values) even though a fallback masks the gap.
3. **Dead code** in two page files from a pre-refactor era.
4. **No automated dictionary parity check** — key parity is currently perfect but could regress without CI enforcement.
5. **Analytics gap** in mobile language drawer.

---

*End of audit report.*