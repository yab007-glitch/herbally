# Clinical Review Standard Operating Procedure (SOP)

> **STATUS: DRAFT — REQUIRES OWNER AND QUALIFIED CLINICAL/LEGAL APPROVAL**
>
> This template defines software-enforced governance roles and review workflows. No clinical advisory board is constituted and no content should be represented as clinically reviewed unless signed off in `reviewer_registry` with recorded consent and verification timestamps.

## 1. Role Separation (`editorial` vs. `clinical`)

- **Editorial Reviewer (`editorial`)**: Verifies formatting, plain-language clarity, EN/FR structural parity, broken URLs, and absence of unattributed claims. Cannot authorize clinical dosing guidance, pregnancy/lactation overrides, or clinical interaction action instructions.
- **Licensed Clinical Reviewer (`clinical`)**: Holds an active, verified professional licence (e.g., physician, pharmacist) recorded in governance records with written attribution consent (`consent_recorded = true`, `public_attribution_allowed = true`). Required before any interaction `clinical_action_status = 'clinician_approved'` or pediatric exception can be unlocked.

## 2. Mandatory Citation & Applicability Rules

- Every factual claim requiring verification must link to an active row in `claim_citations` recording:
  - `source_type` (`regulatory_monograph`, `systematic_review`, `clinical_trial`, etc.)
  - `source_licence`, `source_url`, `published_at`, `retrieved_at`
  - `species_match` and `preparation_match` booleans
  - `retraction_status` (`retracted` blocks publication immediately)
- Clinical edits to `herbs` or `drug_interactions` automatically reset prior `verified_at` / `publication_status` via database trigger (`trg_reset_clinical_review_on_edit` / `trg_drug_interaction_revision`).

## 3. Fail-Closed Public Attribution

- Unconsented or unverified reviewer records (including historical placeholder entries) must never surface on public web pages or Schema.org `reviewedBy` markup.
