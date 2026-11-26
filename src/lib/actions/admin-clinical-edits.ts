"use server";

import { revalidatePath } from "next/cache";
import { getAdminAccess } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/utils/logger";
import { adminTriageEditSchema } from "@/lib/governance/clinical-edits";
import type { ActionResponse } from "@/lib/types";

function formatAffectedSurface(row: {
  target_type: string;
  herb_slug: string | null;
  drug_name: string | null;
  surface_url: string | null;
}): string {
  if (row.surface_url?.trim()) return row.surface_url.trim();
  if (row.herb_slug && row.drug_name) {
    return `/interactions/${row.herb_slug}/${encodeURIComponent(row.drug_name.toLowerCase())}`;
  }
  if (row.herb_slug) return `/herbs/${row.herb_slug}`;
  if (row.drug_name)
    return `/medications/${encodeURIComponent(row.drug_name.toLowerCase())}`;
  return `/${row.target_type}`;
}

export async function updateClinicalEditRequestStatus(
  formData: FormData
): Promise<ActionResponse<{ id: string; status: string }>> {
  const access = await getAdminAccess();
  if (access.status !== "authorized") {
    return {
      success: false,
      error: "Admin access with verified 2FA required.",
    };
  }

  const parsed = adminTriageEditSchema.safeParse({
    requestId: String(formData.get("requestId") ?? "").trim(),
    status: String(formData.get("status") ?? "").trim(),
    adminNotes: String(formData.get("adminNotes") ?? "").trim(),
    publishCorrection: formData.get("publishCorrection") !== null,
    correctionSummary: String(formData.get("correctionSummary") ?? "").trim(),
  });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid triage input.",
    };
  }

  const input = parsed.data;
  const admin = createAdminClient();

  const { data: existing, error: readErr } = await admin
    .from("clinical_edit_requests")
    .select(
      "id, status, target_type, herb_slug, drug_name, surface_url, linkedin_name, credentials, attribution_consent"
    )
    .eq("id", input.requestId)
    .maybeSingle();

  if (readErr || !existing) {
    return { success: false, error: "Clinical edit request not found." };
  }

  const nowIso = new Date().toISOString();
  const { error: updateErr } = await admin
    .from("clinical_edit_requests")
    .update({
      status: input.status,
      admin_notes: input.adminNotes || null,
      reviewed_by_admin_id: access.user.id,
      reviewed_at: nowIso,
    })
    .eq("id", input.requestId);

  if (updateErr) {
    logger.error("clinical_edit_triage_update_failed", {
      requestId: input.requestId,
      error: updateErr.message,
    });
    return { success: false, error: "Could not update edit request." };
  }

  const { error: eventErr } = await admin
    .from("clinical_edit_request_events")
    .insert({
      request_id: input.requestId,
      actor_type: "admin",
      actor_id: access.user.id,
      action: "status_updated",
      from_status: existing.status,
      to_status: input.status,
      note: input.adminNotes || null,
    });

  if (eventErr) {
    logger.warn("clinical_edit_triage_event_failed", {
      requestId: input.requestId,
      error: eventErr.message,
    });
  }

  if (
    input.status === "applied" &&
    input.publishCorrection &&
    input.correctionSummary.length > 0
  ) {
    // Honor attribution consent fail-closed: never expose reviewer identity
    // publicly unless they explicitly checked attributionConsent.
    const creds = existing.credentials?.trim();
    const verifiedBy = existing.attribution_consent
      ? creds
        ? `${existing.linkedin_name} (${creds})`
        : existing.linkedin_name
      : "Yasser Bheekun (editorial)";
    const { error: logErr } = await admin
      .from("public_corrections_log" as never)
      .insert({
        affected_surface: formatAffectedSurface(existing),
        correction_summary: input.correctionSummary,
        verified_by: verifiedBy,
      } as never);
    if (logErr) {
      logger.warn("clinical_edit_public_correction_insert_failed", {
        requestId: input.requestId,
        error: logErr.message,
      });
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/edit-requests");
  revalidatePath("/clinical-review");
  revalidatePath("/fr/clinical-review");
  if (existing.herb_slug) {
    revalidatePath(`/herbs/${existing.herb_slug}`);
    revalidatePath(`/fr/herbs/${existing.herb_slug}`);
  }
  return { success: true, data: { id: input.requestId, status: input.status } };
}

export async function updateClinicalEditRequestStatusAction(
  formData: FormData
): Promise<void> {
  await updateClinicalEditRequestStatus(formData);
}
