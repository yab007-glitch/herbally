"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminAccess } from "@/lib/auth/admin-guard";
import { revalidatePath } from "next/cache";
import type { ActionResponse } from "@/lib/types";

/**
 * Server action to mark a PubMed-compiled sheet as reviewed by a named
 * reviewer (e.g. Dr. Dawn Wong). Admin-only — requires DB admin role and
 * AAL2 2FA verification before stamping herb_pubmed_monographs.status.
 */
export async function markSheetReviewed(
  slug: string,
  reviewer: string
): Promise<ActionResponse<{ slug: string; status: string }>> {
  if (!slug || !reviewer)
    return { success: false, error: "Missing slug or reviewer." };

  const access = await getAdminAccess();
  if (access.status !== "authorized") {
    return {
      success: false,
      error: "Admin access with verified 2FA required.",
    };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("herb_pubmed_monographs")
    .update({
      status: "reviewed",
      last_reviewed: new Date().toISOString(),
      reviewed_by: reviewer,
    })
    .eq("slug", slug);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/herbs/${slug}`);
  return { success: true, data: { slug, status: "reviewed" } };
}

/**
 * Form-action wrapper: reads `slug` and `reviewer` from FormData and stamps
 * the sheet reviewed. Used by the admin review page's <form action=...>.
 */
export async function markSheetReviewedAction(
  formData: FormData
): Promise<void> {
  const slug = String(formData.get("slug") ?? "").trim();
  const reviewer = String(formData.get("reviewer") ?? "").trim();
  // Form actions must return void; the page re-renders after revalidation so
  // the reviewed row disappears. Errors are swallowed here intentionally to
  // satisfy the form-action signature; the core action logs via its result.
  await markSheetReviewed(slug, reviewer);
}

/** Count of sheets still awaiting review (for the admin overview/dashboard). */
export async function unreviewedSheetCount(): Promise<number> {
  const access = await getAdminAccess();
  if (access.status !== "authorized") return 0;

  const admin = createAdminClient();
  const { count } = await admin
    .from("herb_pubmed_monographs")
    .select("id", { count: "exact", head: true })
    .eq("status", "compiled");
  return count ?? 0;
}
