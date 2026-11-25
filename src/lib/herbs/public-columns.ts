/**
 * Public-safe column projection for `public.herbs`.
 *
 * Expand migration `00100_pediatric_containment_dosage_calculations.sql` creates
 * the sanitized `public.herbs_public` view, and post-switch contract migration
 * `00104_pediatric_boundary_contract.sql` revokes table-wide `SELECT` on
 * `public.herbs` from `anon` and `authenticated`, granting column-level `SELECT`
 * ONLY on non-prose metadata columns (excluding `dosage_child`, `dosage_adult`,
 * `translations`, `preparation_notes`, `description`, `traditional_uses`,
 * `modern_uses`, `contraindications`, and `side_effects`).
 *
 * Public `anon`/`authenticated` queries must read `public.herbs_public` or
 * `herb_page_bundle`; `PUBLIC_HERB_COLUMNS` is safe against `herbs_public` and
 * for authorized `service_role` admin queries after `getAdminAccess()`.
 */
export const PUBLIC_HERB_COLUMNS =
  "id,name,slug,scientific_name,common_names,description,active_compounds,traditional_uses,modern_uses,dosage_adult,dosage_forms,preparation_notes,contraindications,side_effects,pregnancy_safe,nursing_safe,pregnancy_safe_oral,pregnancy_safe_topical,nursing_safe_oral,nursing_safe_topical,category_id,image_url,pubchem_cid,is_published,evidence_level,citations,reviewed_by,reviewer_credentials,last_reviewed,symptom_keywords,provenance,view_count,translations,created_at,updated_at" as const;

export const PUBLIC_HERB_COLUMN_LIST = [
  "id",
  "name",
  "slug",
  "scientific_name",
  "common_names",
  "description",
  "active_compounds",
  "traditional_uses",
  "modern_uses",
  "dosage_adult",
  "dosage_forms",
  "preparation_notes",
  "contraindications",
  "side_effects",
  "pregnancy_safe",
  "nursing_safe",
  "pregnancy_safe_oral",
  "pregnancy_safe_topical",
  "nursing_safe_oral",
  "nursing_safe_topical",
  "category_id",
  "image_url",
  "pubchem_cid",
  "is_published",
  "evidence_level",
  "citations",
  "reviewed_by",
  "reviewer_credentials",
  "last_reviewed",
  "symptom_keywords",
  "provenance",
  "view_count",
  "translations",
  "created_at",
  "updated_at",
] as const;
