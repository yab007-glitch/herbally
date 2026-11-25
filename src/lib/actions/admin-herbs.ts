"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminAccess } from "@/lib/auth/admin-guard";
import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { slugify } from "@/lib/utils";
import { logger } from "@/lib/utils/logger";
import { PUBLIC_HERB_COLUMNS } from "@/lib/herbs/public-columns";
import type { ActionResponse } from "@/lib/types";
import type { Database } from "@/lib/types/database";

type HerbInsert = Database["public"]["Tables"]["herbs"]["Insert"];
type Herb = Database["public"]["Tables"]["herbs"]["Row"];

/**
 * Authorize the caller as an AAL2 admin against `profiles.role` via
 * `getAdminAccess()`, and only after authorization succeeds return the
 * service-role admin client so post-00104 INSERT/UPDATE `.select(...)`
 * RETURNING metadata succeeds even after raw base-table prose/dose SELECT is
 * revoked from `authenticated`.
 */
async function requireAdmin(): Promise<{
  supabase: ReturnType<typeof createAdminClient> | null;
  ok: boolean;
}> {
  const access = await getAdminAccess();
  if (access.status !== "authorized") {
    return { supabase: null, ok: false };
  }
  try {
    return { supabase: createAdminClient(), ok: true };
  } catch (error) {
    logger.error("requireAdmin_service_client_unavailable", {
      error: String(error),
    });
    return { supabase: null, ok: false };
  }
}

function parseStringArray(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function bool(formData: FormData, key: string): boolean {
  // Native checkbox submits the field name (`on`) only when checked, so
  // presence === true. Radix Switch renders a <button> which does NOT submit,
  // so the admin form uses native checkboxes for these booleans.
  return formData.get(key) !== null;
}

/**
 * Find a unique slug derived from `base`. Appends `-2`, `-3`, … until an unused
 * slug is found. Bounded to avoid an unbounded loop on pathological input.
 */
async function uniqueSlug(
  supabase: ReturnType<typeof createAdminClient>,
  base: string
): Promise<string> {
  const root = base || "herb";
  let slug = root;
  for (let n = 2; n < 100; n++) {
    const { data } = await supabase
      .from("herbs")
      .select("slug")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return slug;
    slug = `${root}-${n}`;
  }
  // Extremely unlikely fallback — guarantees termination.
  return `${root}-${Date.now()}`;
}

function buildRow(formData: FormData): Omit<HerbInsert, "slug"> {
  return {
    name: str(formData, "name"),
    scientific_name: str(formData, "scientific_name"),
    description: str(formData, "description"),
    common_names: parseStringArray(str(formData, "common_names")),
    dosage_adult: str(formData, "dosage_adult") || null,
    // Legacy pediatric dosage field is quarantined — do not accept free-text edits.
    pregnancy_safe: bool(formData, "pregnancy_safe"),
    nursing_safe: bool(formData, "nursing_safe"),
    is_published: bool(formData, "is_published"),
  };
}

function validateRow(row: Omit<HerbInsert, "slug">): string | null {
  if (!row.name) return "Common name is required.";
  if (!row.scientific_name) return "Scientific name is required.";
  if (!row.description) return "Description is required.";
  return null;
}

/**
 * Invalidate every unstable_cache tag the herb detail page attaches to a slug
 * (M8, audit 2026-06-22). Previously admin edits only called revalidatePath for
 * the edited slug, never revalidateTag — so the herb's own cached fetches
 * (meta/herb/monograph/faqs) and, more importantly, OTHER herbs' cached
 * `related-herbs-<slug>` entries (which render this herb's name) stayed stale up
 * to the 24h TTL after a rename/republish.
 */
function invalidateHerbTags(slug: string): void {
  for (const tag of [
    `herb-meta-${slug}`,
    `herb-${slug}`,
    `herb-page-bundle-${slug}`,
    `monograph-${slug}`,
    `herb-faqs-${slug}`,
    `herb-regulatory-evidence-${slug}`,
    `sources-${slug}`,
    `pubmed-sheet-${slug}`,
    `related-herbs-${slug}`,
  ]) {
    // Next 16: `{ expire: 0 }` forces immediate invalidation so the next
    // request refills from Postgres instead of serving stale SWR data.
    revalidateTag(tag, { expire: 0 });
  }
}

function invalidateHerbPaths(slug: string): void {
  revalidatePath(`/herbs/${slug}`);
  revalidatePath(`/en/herbs/${slug}`);
  revalidatePath(`/fr/herbs/${slug}`);
}

/**
 * A name or publish-state change ripples into other herbs' "related herbs"
 * lists and the compare/symptoms indexes. We can't wildcard revalidateTag, so
 * bust the whole /herbs layout subtree (forces every herb page to regenerate
 * and re-read fresh DB data) plus the compare and symptoms paths. Called only
 * when `name` or `is_published` actually changed vs. the prior row.
 */
function invalidateCrossHerbCaches(): void {
  // Next 16: revalidatePath's second arg is the literal 'layout' | 'page', not
  // an options object. Revalidate unprefixed, /en, and /fr paths.
  for (const prefix of ["", "/en", "/fr"]) {
    revalidatePath(`${prefix}/herbs`, "layout");
    revalidatePath(`${prefix}/compare`, "layout");
    revalidatePath(`${prefix}/symptoms`, "layout");
  }
  revalidatePath("/sitemap.xml");
}

export async function createHerb(
  formData: FormData
): Promise<ActionResponse<Herb>> {
  const { supabase, ok } = await requireAdmin();
  if (!ok || !supabase) return { success: false, error: "Not authorized" };

  const row = buildRow(formData);
  const validationError = validateRow(row);
  if (validationError) return { success: false, error: validationError };

  try {
    const slug = await uniqueSlug(supabase, slugify(row.name));
    const { error } = await supabase
      .from("herbs")
      .insert({ ...row, slug })
      .select(PUBLIC_HERB_COLUMNS)
      .single();
    if (error) {
      // L14 (audit 2026-06-22): don't leak the raw PostgREST error to the client
      // (it can expose schema/column/constraint names). Log the detail
      // server-side, surface a generic message.
      logger.error("createHerb_failed", { error: error.message });
      return { success: false, error: "Failed to create herb" };
    }
    // M8: bust this herb's tagged caches + the cross-herb indexes (a new herb
    // may appear in other herbs' related lists / compare / symptoms).
    invalidateHerbTags(slug);
    invalidateCrossHerbCaches();
    revalidatePath("/herbs");
    revalidatePath("/en/herbs");
    revalidatePath("/fr/herbs");
    invalidateHerbPaths(slug);
    revalidatePath("/admin/herbs");
  } catch (error) {
    logger.error("createHerb_exception", { error: String(error) });
    return { success: false, error: "Failed to create herb" };
  }
  redirect("/admin/herbs");
}

export async function updateHerb(
  formData: FormData
): Promise<ActionResponse<Herb>> {
  const { supabase, ok } = await requireAdmin();
  if (!ok || !supabase) return { success: false, error: "Not authorized" };

  const id = str(formData, "id");
  if (!id) return { success: false, error: "Missing herb id" };

  const row = buildRow(formData);
  const validationError = validateRow(row);
  if (validationError) return { success: false, error: validationError };

  try {
    // Fetch the prior row so we can (a) invalidate this herb's tagged caches by
    // its slug and (b) detect name/publish changes that ripple into other
    // herbs' related-herbs lists and the compare/symptoms indexes (M8).
    const { data: prior } = await supabase
      .from("herbs")
      .select("slug, name, is_published")
      .eq("id", id)
      .maybeSingle();

    // Slug is intentionally NOT updated on edit — changing the URL would break
    // inbound links and the sitemap. Only the editable fields are sent.
    const { data, error } = await supabase
      .from("herbs")
      .update(row)
      .eq("id", id)
      .select(PUBLIC_HERB_COLUMNS)
      .single();
    if (error) {
      // L14 (audit 2026-06-22): don't leak the raw PostgREST error to the client.
      logger.error("updateHerb_failed", { error: error.message });
      return { success: false, error: "Failed to update herb" };
    }
    // M8: bust this herb's own tagged caches by slug.
    const slug = data.slug ?? prior?.slug;
    if (slug) invalidateHerbTags(slug);
    // A name or publish-state change affects other herbs' related-herbs caches
    // and the compare/symptoms indexes — bust the whole layout subtrees.
    const nameChanged = !!prior && prior.name !== row.name;
    const publishChanged = !!prior && prior.is_published !== row.is_published;
    if (nameChanged || publishChanged) {
      invalidateCrossHerbCaches();
    }
    revalidatePath("/herbs");
    revalidatePath("/en/herbs");
    revalidatePath("/fr/herbs");
    if (slug) invalidateHerbPaths(slug);
    revalidatePath(`/admin/herbs/${id}/edit`);
    revalidatePath("/admin/herbs");
  } catch (error) {
    logger.error("updateHerb_exception", { error: String(error) });
    return { success: false, error: "Failed to update herb" };
  }
  redirect("/admin/herbs");
}

/**
 * The registry id of the site's editor and reviewer of record. Kept as an id,
 * not a free-text name, so the public page resolves the same person, and their
 * credentials, everywhere.
 */
const REVIEWER_REGISTRY_ID = "yasser-bheekun";

/**
 * Record (or clear) a human review of one herb page.
 *
 * This is the only way `herbs.reviewed_by` becomes a named person. The site's
 * public tooltip promises that "Reviewed by" appears only on pages a named
 * person has actually read, so this action is deliberately per-page and
 * admin-only at aal2 — there is no bulk version.
 */
async function setHerbReview(
  formData: FormData,
  reviewed: boolean
): Promise<ActionResponse<{ reviewedOn: string | null }>> {
  const { supabase, ok } = await requireAdmin();
  if (!ok || !supabase) return { success: false, error: "Not authorized" };

  const id = str(formData, "herb_id");
  const slug = str(formData, "slug");
  if (!id || !slug) return { success: false, error: "Missing herb id or slug" };

  const { data: prior, error: readError } = await supabase
    .from("herbs")
    .select("provenance")
    .eq("id", id)
    .maybeSingle();
  if (readError || !prior)
    return { success: false, error: "Could not load the herb" };

  const reviewedOn = reviewed ? new Date().toISOString().slice(0, 10) : null;
  const provenance = {
    ...((prior.provenance as Record<string, unknown> | null) ?? {}),
    review_status: reviewed ? "human_reviewed" : null,
    reviewed_by_name: reviewed ? "Yasser Bheekun" : null,
    reviewed_on: reviewedOn,
    review_role: reviewed ? "editorial" : null,
    bulk_editorial_import: false,
  };

  const { error } = await supabase
    .from("herbs")
    .update({
      reviewed_by: reviewed ? REVIEWER_REGISTRY_ID : null,
      last_reviewed: reviewed ? new Date().toISOString() : null,
      provenance,
    })
    .eq("id", id);
  if (error) {
    logger.error("setHerbReview_failed", { error: error.message });
    return { success: false, error: "Failed to save the review" };
  }

  invalidateHerbTags(slug);
  invalidateHerbPaths(slug);
  revalidatePath(`/admin/herbs/${id}/edit`);
  return { success: true, data: { reviewedOn } };
}

/**
 * One entry point for the admin panel: `intent` is "mark" or "clear".
 * Kept as a single action so the client can drive it with useActionState and
 * surface a failure instead of a silent no-op.
 */
export async function reviewHerbAction(
  formData: FormData
): Promise<ActionResponse<{ reviewedOn: string | null }>> {
  return setHerbReview(formData, str(formData, "intent") === "mark");
}
