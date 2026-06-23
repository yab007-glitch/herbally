"use server";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/utils/logger";
import { matchesDrugInteraction } from "@/lib/utils/drug-match";
import { z } from "zod";
import type { ActionResponse } from "@/lib/types";
import type { Database } from "@/lib/types/database";

type PatientProfile = Database["public"]["Tables"]["patient_profiles"]["Row"];
type HealthProfile = Database["public"]["Tables"]["health_profiles"]["Row"];
type UserMedication = Database["public"]["Tables"]["user_medications"]["Row"];

// ─── Input validation (M4) ────────────────────────────────────────
// Server actions accept arbitrary JSON from the client; the TypeScript
// signature is erased at runtime, so a malicious/stale payload could include
// id/user_id/created_at/updated_at (row-transfer or privilege escalation) or
// unbounded strings/numbers. Zod parses and STRIPS unknown keys (default
// behavior), and bounds every field. The validated object is the ONLY thing
// spread into the insert — server-owned columns (user_id) are added by the
// action itself, never trusted from the client.

const boundedNumber = (min: number, max: number) =>
  z
    .number()
    .finite()
    .min(min)
    .max(max)
    .nullish()
    .transform((v) => (v === undefined ? null : v));

const nullableString = (max: number) =>
  z
    .string()
    .max(max)
    .nullish()
    .transform((v) => (v === undefined ? null : v));

const patientProfileSchema = z.object({
  name: z.string().min(1).max(100),
  relationship: z.string().min(1).max(50),
  weight_kg: boundedNumber(0, 1000),
  age_years: boundedNumber(0, 130),
  age_months: boundedNumber(0, 1200),
  height_cm: boundedNumber(0, 300),
  is_default: z
    .boolean()
    .nullish()
    .transform((v) => v ?? false),
  notes: nullableString(2000),
});

const healthProfileSchema = z.object({
  conditions: z.array(z.string().min(1).max(100)).max(50).default([]),
  allergies: z.array(z.string().min(1).max(100)).max(50).default([]),
});

const medicationSchema = z.object({
  drug_name: z.string().min(1).max(200),
  dosage: nullableString(100),
  frequency: nullableString(100),
  rxcui: nullableString(50),
  notes: nullableString(2000),
});

const dosageCalculationSchema = z.object({
  adult_dose: z.string().min(1).max(100),
  calculated_dose: z.string().min(1).max(100),
  formula_used: z.enum(["clarks_rule", "youngs_rule", "bsa", "fried_rule"]),
  patient_weight_kg: boundedNumber(0, 1000),
  patient_age: boundedNumber(0, 130),
  patient_height_cm: boundedNumber(0, 300),
  patient_bsa: boundedNumber(0, 10),
  herb_id: z
    .string()
    .uuid()
    .nullish()
    .transform((v) => v ?? null),
  notes: nullableString(500),
});

// ─── Patient Profiles ─────────────────────────────────────────────

export async function getPatientProfiles(): Promise<
  ActionResponse<PatientProfile[]>
> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { data, error } = await supabase
      .from("patient_profiles")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data ?? [] };
  } catch (error) {
    logger.error("getPatientProfiles_failed", { error: String(error) });
    return { success: false, error: "Failed to fetch profiles" };
  }
}

export async function savePatientProfile(
  profile: Omit<PatientProfile, "id" | "created_at" | "updated_at" | "user_id">
): Promise<ActionResponse<PatientProfile>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    // M4: validate + strip server-owned/garbage keys before insert.
    const parsed = patientProfileSchema.safeParse(profile);
    if (!parsed.success)
      return { success: false, error: "Invalid profile data" };

    const { data, error } = await supabase
      .from("patient_profiles")
      .insert({ ...parsed.data, user_id: user.id })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    // Enforce a single default per user atomically. Two rapid "add patient"
    // calls can both pass is_default=true before either render reflects the
    // first insert; unsetting every *other* profile after the insert
    // guarantees exactly one default regardless of the race.
    if (data.is_default) {
      await supabase
        .from("patient_profiles")
        .update({ is_default: false })
        .eq("user_id", user.id)
        .eq("is_default", true)
        .neq("id", data.id);
    }

    return { success: true, data };
  } catch (error) {
    logger.error("savePatientProfile_failed", { error: String(error) });
    return { success: false, error: "Failed to save profile" };
  }
}

export async function updatePatientProfile(
  id: string,
  updates: Partial<PatientProfile>
): Promise<ActionResponse<PatientProfile>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    // If setting as default, unset other defaults first
    if (updates.is_default) {
      await supabase
        .from("patient_profiles")
        .update({ is_default: false })
        .eq("user_id", user.id)
        .eq("is_default", true)
        .neq("id", id);
    }

    // Strip immutable/identity columns a caller must never overwrite — a
    // row-transfer or stale payload could otherwise reassign the profile to
    // another user. Only allow genuine profile fields through.
    const {
      id: _id,
      user_id: _userId,
      created_at: _createdAt,
      updated_at: _updatedAt,
      ...safeUpdates
    } = updates;

    const { data, error } = await supabase
      .from("patient_profiles")
      .update(safeUpdates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (error) {
    logger.error("updatePatientProfile_failed", { error: String(error) });
    return { success: false, error: "Failed to update profile" };
  }
}

export async function deletePatientProfile(
  id: string
): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { error } = await supabase
      .from("patient_profiles")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    logger.error("deletePatientProfile_failed", { error: String(error) });
    return { success: false, error: "Failed to delete profile" };
  }
}

// ─── Health Profile ───────────────────────────────────────────────

export async function getHealthProfile(): Promise<
  ActionResponse<HealthProfile | null>
> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { data, error } = await supabase
      .from("health_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data ?? null };
  } catch (error) {
    logger.error("getHealthProfile_failed", { error: String(error) });
    return { success: false, error: "Failed to fetch health profile" };
  }
}

export async function saveHealthProfile(
  profile: Pick<HealthProfile, "conditions" | "allergies">
): Promise<ActionResponse<HealthProfile>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    // NOTE: `medications` is intentionally omitted from the upsert payload.
    // The profile form manages conditions/allergies only; including
    // `medications: []` here would wipe the user's medication list (managed
    // separately via addMedication/removeMedication). PostgREST upsert only
    // UPDATEs the columns supplied, so the existing medications value is
    // preserved on conflict and the column default applies on first insert.
    //
    // M4: validate + strip server-owned keys (user_id/guest_id/id/timestamps)
    // before upsert. Only conditions/allergies are carried through.
    const parsed = healthProfileSchema.safeParse(profile);
    if (!parsed.success)
      return { success: false, error: "Invalid health profile data" };

    const { data, error } = await supabase
      .from("health_profiles")
      .upsert(
        {
          conditions: parsed.data.conditions,
          allergies: parsed.data.allergies,
          user_id: user.id,
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (error) {
    logger.error("saveHealthProfile_failed", { error: String(error) });
    return { success: false, error: "Failed to save health profile" };
  }
}

// ─── User Medications ─────────────────────────────────────────────

export async function getUserMedications(): Promise<
  ActionResponse<UserMedication[]>
> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { data, error } = await supabase
      .from("user_medications")
      .select("*")
      .eq("user_id", user.id)
      // L21 (audit 2026-06-22): only active meds are shown to the user;
      // removeMedication now soft-deletes (is_active=false) so the row is
      // preserved as an audit trail rather than hard-removed.
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data ?? [] };
  } catch (error) {
    logger.error("getUserMedications_failed", { error: String(error) });
    return { success: false, error: "Failed to fetch medications" };
  }
}

export async function addMedication(
  med: Pick<
    UserMedication,
    "drug_name" | "dosage" | "frequency" | "rxcui" | "notes"
  >
): Promise<ActionResponse<UserMedication>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    // M4: validate + strip server-owned keys (id/user_id/timestamps/is_active).
    const parsed = medicationSchema.safeParse(med);
    if (!parsed.success)
      return { success: false, error: "Invalid medication data" };

    const { data, error } = await supabase
      .from("user_medications")
      .insert({ ...parsed.data, user_id: user.id, is_active: true })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (error) {
    logger.error("addMedication_failed", { error: String(error) });
    return { success: false, error: "Failed to add medication" };
  }
}

export async function removeMedication(id: string): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    // L21 (audit 2026-06-22): soft-delete by toggling is_active=false instead
    // of hard-deleting the row, so the medication history is preserved as an
    // audit trail and the user can no longer trigger interactions on it
    // (checkUserMedicationInteractions filters is_active=true). Scoped to
    // the authenticated user via RLS + the explicit user_id eq.
    const { error } = await supabase
      .from("user_medications")
      .update({ is_active: false })
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    logger.error("removeMedication_failed", { error: String(error) });
    return { success: false, error: "Failed to remove medication" };
  }
}

// ─── Dosage Calculation History ───────────────────────────────────

export async function saveDosageCalculation(
  calc: Omit<
    Database["public"]["Tables"]["dosage_calculations"]["Row"],
    "id" | "created_at" | "user_id"
  >
): Promise<ActionResponse<{ skipped?: boolean }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // Distinct skipped state for guests so the UI can tell "saved" apart from
    // "not signed in" instead of both looking like success.
    if (!user) return { success: true, data: { skipped: true } };

    // M4: validate + strip server-owned keys (id/created_at/user_id) before
    // insert.
    const parsed = dosageCalculationSchema.safeParse(calc);
    if (!parsed.success)
      return { success: false, error: "Invalid calculation data" };

    const { error } = await supabase
      .from("dosage_calculations")
      .insert({ ...parsed.data, user_id: user.id });

    if (error) {
      logger.error("saveDosageCalculation_failed", { error: error.message });
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error) {
    logger.error("saveDosageCalculation_exception", { error: String(error) });
    return { success: false, error: "Failed to save calculation" };
  }
}

export async function getDosageHistory(): Promise<
  ActionResponse<Database["public"]["Tables"]["dosage_calculations"]["Row"][]>
> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { data, error } = await supabase
      .from("dosage_calculations")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) return { success: false, error: error.message };
    return { success: true, data: data ?? [] };
  } catch (error) {
    logger.error("getDosageHistory_failed", { error: String(error) });
    return { success: false, error: "Failed to fetch history" };
  }
}

// ─── Garden Notes ─────────────────────────────────────────────────

export async function updateGardenNote(
  herbSlug: string,
  note: string
): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { error } = await supabase
      .from("garden_herbs")
      .update({ note })
      .eq("user_id", user.id)
      .eq("herb_slug", herbSlug);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    logger.error("updateGardenNote_failed", { error: String(error) });
    return { success: false, error: "Failed to update note" };
  }
}

// ─── Interaction Check for User's Medications ─────────────────────

export async function checkUserMedicationInteractions(
  herbSlug: string
): Promise<
  ActionResponse<{
    interactions: Array<{
      drug_name: string;
      severity: string;
      description: string;
      mechanism: string | null;
    }>;
    userMedications: string[];
  }>
> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return { success: true, data: { interactions: [], userMedications: [] } };

    // Get user's active medications
    const { data: meds } = await supabase
      .from("user_medications")
      .select("drug_name")
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (!meds || meds.length === 0)
      return { success: true, data: { interactions: [], userMedications: [] } };

    // Get the herb
    const { data: herb } = await supabase
      .from("herbs")
      .select("id")
      .eq("slug", herbSlug)
      .eq("is_published", true)
      .single();

    if (!herb) return { success: false, error: "Herb not found" };

    // Get all drug interactions for this herb
    const { data: interactions } = await supabase
      .from("drug_interactions")
      .select("drug_name, severity, description, mechanism")
      .eq("herb_id", herb.id);

    if (!interactions || interactions.length === 0)
      return {
        success: true,
        data: {
          interactions: [],
          userMedications: meds.map((m) => m.drug_name),
        },
      };

    // Filter interactions to those matching the user's medications. The seed
    // drug_interactions rows carry rxcui = NULL (migration 00016), so RxCUI
    // matching is impossible; this uses token-based matching + a curated
    // brand↔generic↔class synonym map (see src/lib/utils/drug-match.ts). The old
    // bidirectional String.includes() produced false negatives ("birth control"
    // vs "Oral Contraceptives") and false positives ("na" matching anything
    // containing "na"). Over-warning is the safe direction for a checker.
    const matched = interactions.filter((ix) =>
      meds.some((m) => matchesDrugInteraction(m.drug_name, ix.drug_name))
    );

    return {
      success: true,
      data: {
        interactions: matched,
        userMedications: meds.map((m) => m.drug_name),
      },
    };
  } catch (error) {
    logger.error("checkUserMedicationInteractions_failed", {
      error: String(error),
    });
    return { success: false, error: "Failed to check interactions" };
  }
}
