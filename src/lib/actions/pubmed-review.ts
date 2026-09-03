"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { ActionResponse } from "@/lib/types";

/**
 * Server action to mark a PubMed-compiled sheet as reviewed by a named
 * reviewer (e.g. Dr. Dawn Wong). Admin-only — verifies the caller's role
 * against the profiles table (never JWT metadata), then stamps
 * herb_pubmed_monographs.status = 'reviewed'.
 */
export async function markSheetReviewed(
  slug: string,
  reviewer: string
): Promise<ActionResponse<{ slug: string; status: string }>> {
  if (!slug || !reviewer)
    return { success: false, error: "Missing slug or reviewer." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin")
    return { success: false, error: "Admin access required." };

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return 0;

  const admin = createAdminClient();
  const { count } = await admin
    .from("herb_pubmed_monographs")
    .select("id", { count: "exact", head: true })
    .eq("status", "compiled");
  return count ?? 0;
}
