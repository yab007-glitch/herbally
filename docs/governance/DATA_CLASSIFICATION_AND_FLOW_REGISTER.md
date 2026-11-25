# Data Classification & Flow Register

> **STATUS: DRAFT TECHNICAL REGISTER — REQUIRES QUALIFIED PRIVACY / LEGAL COUNSEL APPROVAL**
>
> This document records implemented software data flows and technical minimization controls as of 2026-11-25. It does **not** certify legal compliance under Quebec Law 25, PIPEDA, HIPAA, or GDPR.

## 1. Classification Tiers

1. **Public Catalog (`public_catalog`)**: Herbal profiles, LNHPD extracts, interaction pairs, FAQs, sitemap URLs.
2. **Pseudonymous / Browser-Only (`pseudonymous_session_or_browser`)**: Client-side stack checker (`herbally-my-stack-v1`), recent searches, theme preferences, UI dismissal flags (`storage-inventory.ts`).
3. **Optional User-Submitted Health Data (`user_submitted_health_optional`)**: Authenticated `patient_profiles`, `health_profiles`, `user_medications`, adult-only `dosage_calculations`, `chat_sessions`, and stateless chat prompts sent to Ollama Cloud inference.

## 2. Key Technical Controls Implemented

- **Shared AI Cache Minimization (`src/app/api/chat/route.ts`)**: Personalized requests (`medications.length > 0` or `herbContext`) and multi-turn conversations (`messages.length > 1`) bypass `ai_response_cache` read and write completely (`CACHE_KEY_VERSION` v5).
- **Opt-In Consent & Retention Plumbing (`00103_privacy_minimization_controls.sql`)**: Defines `user_privacy_consents` (`health_profile`, `patient_profile`, `medications_list`, `dosage_history`, `ai_personalization` with `granted` + `revoked_at` + `consent_version`) and `retention_expires_at` metadata; server actions fail closed whenever explicit opt-in consent is declined, absent, revoked, or cannot be recorded.
- **Pediatric History Quarantine (`00100_pediatric_containment_dosage_calculations.sql`)**: New pediatric dosage calculations are blocked at DB, server-action, and UI layers; legacy `<18` / scaling-formula rows in `dosage_calculations` remain quarantined (`is_legacy_pediatric_quarantined = true`) and redacted from user history without deleting historical records.
- **Service Worker Boundaries (`public/sw.js`)**: Public cache excludes `/api/`, `/auth/`, `/profile`, `/account`, `/admin`, and `/herbalist`.

## 3. Open Owner / Counsel Dependencies

- Signed Data Processing Agreements (DPAs) / zero-retention contractual verification with third-party inference and hosting vendors remain pending owner execution.
