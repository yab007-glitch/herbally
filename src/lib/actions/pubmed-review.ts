"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminAccess } from "@/lib/auth/admin-guard";
import { revalidatePath, revalidateTag } from "next/cache";
import { resolveVerifiedClinicalReviewer } from "@/lib/data/reviewers";
import { logger } from "@/lib/utils/logger";
import type { ActionResponse } from "@/lib/types";

const reviewParamSchema = z.string().trim().min(1).max(200);

/**
 * Server action to mark a PubMed-compiled sheet as reviewed by a named
 * reviewer (e.g. a verified clinician in `reviewer_registry`). Admin-only —
 * requires DB admin role and AAL2 2FA verification before stamping
 * herb_pubmed_monographs.status.
 */
export async function markSheetReviewed(
  slug: string,
  reviewer: string
): Promise<ActionResponse<{ slug: string; status: string }>> {
  const parsedSlug = reviewParamSchema.safeParse(slug);
  const parsedReviewer = reviewParamSchema.safeParse(reviewer);
  if (!parsedSlug.success || !parsedReviewer.success)
    return { success: false, error: "Missing or invalid slug or reviewer." };

  const cleanSlug = parsedSlug.data;
  const cleanReviewer = parsedReviewer.data;

  const access = await getAdminAccess();
  if (access.status !== "authorized") {
    return {
      success: false,
      error: "Admin access with verified 2FA required.",
    };
  }

  const admin = createAdminClient();
  const verifiedReviewer = await resolveVerifiedClinicalReviewer(
    cleanReviewer,
    admin
  );
  if (!verifiedReviewer) {
    return {
      success: false,
      error:
        "Reviewer must be a verified, consented clinical reviewer with an active licence in reviewer_registry.",
    };
  }

  const { error } = await admin
    .from("herb_pubmed_monographs")
    .update({
      status: "reviewed",
      last_reviewed: new Date().toISOString(),
      reviewed_by: verifiedReviewer.id,
    })
    .eq("slug", cleanSlug);
  if (error) {
    logger.error("markSheetReviewed_failed", { error: error.message });
    return { success: false, error: "Failed to mark sheet as reviewed." };
  }

  revalidateTag(`pubmed-sheet-${cleanSlug}`, { expire: 0 });
  revalidateTag(`herb-page-bundle-${cleanSlug}`, { expire: 0 });
  revalidatePath(`/herbs/${cleanSlug}`);
  revalidatePath(`/en/herbs/${cleanSlug}`);
  revalidatePath(`/fr/herbs/${cleanSlug}`);
  return { success: true, data: { slug: cleanSlug, status: "reviewed" } };
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
