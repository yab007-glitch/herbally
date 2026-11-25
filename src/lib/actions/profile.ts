"use server";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/utils/logger";
import { matchDrugQueryUnified } from "@/lib/interactions/drug-matching-unified";
import {
  CONSENT_SCOPES,
  hasRecordedConsent,
  recordPrivacyConsent,
  requireExplicitHealthConsent,
  type ConsentScope,
} from "@/lib/privacy/consent";
import {
  assessDoseEligibility,
  isLegacyQuarantinedCalculation,
  MAX_ADULT_WEIGHT_KG,
  MIN_ADULT_WEIGHT_KG,
} from "@/lib/utils/dosage-safety";
import { buildAdultReferenceDose } from "@/lib/utils/dosage-calculations";
import { matchCalculatorBlockedInput } from "@/lib/data/dangerous-herbs";
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

const uuidSchema = z.string().uuid();

const herbSlugSchema = z.string().trim().min(1).max(200);

const patientProfileSchema = z.object({
  name: z.string().min(1).max(100),
  relationship: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .refine((v) => !/^child$/i.test(v), {
      message: "Adult-only profiles: child profiles are not permitted",
    }),
  weight_kg: boundedNumber(0, 1000),
  age_years: z.number().finite().min(18).max(120),
  age_months: z
    .null()
    .optional()
    .transform(() => null),
  height_cm: boundedNumber(0, 300),
  is_default: z
    .boolean()
    .nullish()
    .transform((v) => v ?? false),
  notes: nullableString(2000),
});

const patientProfileUpdateSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    relationship: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .refine((v) => !/^child$/i.test(v), {
        message: "Adult-only profiles: child profiles are not permitted",
      })
      .optional(),
    weight_kg: boundedNumber(0, 1000).optional(),
    age_years: z.number().finite().min(18).max(120).optional(),
    age_months: z.null().optional(),
    height_cm: boundedNumber(0, 300).optional(),
    is_default: z.boolean().optional(),
    notes: nullableString(2000).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "No fields to update",
  });

const gardenNoteSchema = z.object({
  herbSlug: herbSlugSchema,
  note: z.string().max(2000),
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
  adult_dose: z.string().trim().min(1).max(100),
  calculated_dose: z.string().trim().min(1).max(100),
  formula_used: z.enum(["adult_reference"]),
  patient_weight_kg: boundedNumber(MIN_ADULT_WEIGHT_KG, MAX_ADULT_WEIGHT_KG),
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

    if (error) {
      logger.error("getPatientProfiles_db_failed", { error: error.message });
      return { success: false, error: "Failed to fetch profiles" };
    }
    return { success: true, data: data ?? [] };
  } catch (error) {
    logger.error("getPatientProfiles_failed", { error: String(error) });
    return { success: false, error: "Failed to fetch profiles" };
  }
}

export async function getPrivacyConsents(): Promise<
  ActionResponse<Record<ConsentScope, boolean>>
> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const entries = await Promise.all(
      CONSENT_SCOPES.map(
        async (scope) =>
          [scope, await hasRecordedConsent(supabase, user.id, scope)] as const
      )
    );
    return {
      success: true,
      data: Object.fromEntries(entries) as Record<ConsentScope, boolean>,
    };
  } catch (error) {
    logger.error("getPrivacyConsents_failed", { error: String(error) });
    return { success: false, error: "Failed to load privacy consents" };
  }
}

const consentScopeSchema = z.enum(CONSENT_SCOPES);

export async function setPrivacyConsent(
  scope: ConsentScope,
  granted: boolean
): Promise<ActionResponse<{ recorded: boolean; migrationPending?: boolean }>> {
  try {
    const parsedScope = consentScopeSchema.safeParse(scope);
    if (!parsedScope.success) {
      return { success: false, error: "Invalid consent scope" };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const res = await recordPrivacyConsent(
      supabase,
      user.id,
      parsedScope.data,
      granted ? "granted" : "withdrawn"
    );
    if (!res.recorded) {
      return {
        success: false,
        error: res.migrationPending
          ? "Consent ledger unavailable pending migration 00103"
          : "Failed to record privacy consent",
      };
    }
    return { success: true, data: res };
  } catch (error) {
    logger.error("setPrivacyConsent_failed", { error: String(error) });
    return { success: false, error: "Failed to record privacy consent" };
  }
}

export async function savePatientProfile(
  profile: Omit<
    PatientProfile,
    "id" | "created_at" | "updated_at" | "user_id"
  > & { health_data_consent?: boolean }
): Promise<ActionResponse<PatientProfile>> {
  try {
    // M4 + Adult-only enforcement BEFORE auth/DB calls
    const parsed = patientProfileSchema.safeParse(profile);
    if (!parsed.success)
      return { success: false, error: "Invalid profile data" };

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const consentCheck = await requireExplicitHealthConsent(
      supabase,
      user.id,
      "patient_profile",
      profile.health_data_consent
    );
    if (!consentCheck.ok) {
      return { success: false, error: consentCheck.error };
    }

    const { data, error } = await supabase
      .from("patient_profiles")
      .insert({ ...parsed.data, user_id: user.id })
      .select()
      .single();

    if (error) {
      logger.error("savePatientProfile_db_failed", { error: error.message });
      return { success: false, error: "Failed to save profile" };
    }

    // Enforce a single default per user atomically.
    if (data.is_default) {
      const { error: unsetError } = await supabase
        .from("patient_profiles")
        .update({ is_default: false })
        .eq("user_id", user.id)
        .eq("is_default", true)
        .neq("id", data.id);
      if (unsetError) {
        logger.warn("savePatientProfile_unset_default_failed", {
          error: unsetError.message,
        });
      }
    }

    return { success: true, data };
  } catch (error) {
    logger.error("savePatientProfile_failed", { error: String(error) });
    return { success: false, error: "Failed to save profile" };
  }
}

export async function updatePatientProfile(
  id: string,
  updates: Partial<PatientProfile> & { health_data_consent?: boolean }
): Promise<ActionResponse<PatientProfile>> {
  try {
    if (!uuidSchema.safeParse(id).success) {
      return { success: false, error: "Invalid profile ID" };
    }

    // Validate updates with Zod so server-owned/immutable keys (id, user_id,
    // created_at, updated_at) and minor/child values are rejected cleanly.
    const parsed = patientProfileUpdateSchema.safeParse(updates);
    if (!parsed.success) {
      return { success: false, error: "Invalid profile data" };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const consentCheck = await requireExplicitHealthConsent(
      supabase,
      user.id,
      "patient_profile",
      updates.health_data_consent
    );
    if (!consentCheck.ok) {
      return { success: false, error: consentCheck.error };
    }

    // Update target row FIRST before clearing other defaults so a failed or
    // nonexistent target never leaves the user without a default profile.
    const { data, error } = await supabase
      .from("patient_profiles")
      .update(parsed.data)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error || !data) {
      if (error) {
        logger.error("updatePatientProfile_db_failed", {
          error: error.message,
        });
      }
      return { success: false, error: "Failed to update profile" };
    }

    if (data.is_default) {
      const { error: unsetError } = await supabase
        .from("patient_profiles")
        .update({ is_default: false })
        .eq("user_id", user.id)
        .eq("is_default", true)
        .neq("id", data.id);
      if (unsetError) {
        logger.warn("updatePatientProfile_unset_default_failed", {
          error: unsetError.message,
        });
      }
    }

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

    if (!uuidSchema.safeParse(id).success) {
      return { success: false, error: "Invalid profile ID" };
    }

    const { error } = await supabase
      .from("patient_profiles")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      logger.error("deletePatientProfile_db_failed", { error: error.message });
      return { success: false, error: "Failed to delete profile" };
    }
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

    if (error) {
      logger.error("getHealthProfile_db_failed", { error: error.message });
      return { success: false, error: "Failed to fetch health profile" };
    }
    return { success: true, data: data ?? null };
  } catch (error) {
    logger.error("getHealthProfile_failed", { error: String(error) });
    return { success: false, error: "Failed to fetch health profile" };
  }
}

export async function saveHealthProfile(
  profile: Pick<HealthProfile, "conditions" | "allergies"> & {
    health_data_consent?: boolean;
    is_pregnant?: boolean;
    is_nursing?: boolean;
    notes?: string | null;
  }
): Promise<ActionResponse<HealthProfile>> {
  try {
    const parsed = healthProfileSchema.safeParse(profile);
    if (!parsed.success)
      return { success: false, error: "Invalid health profile data" };

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const consentCheck = await requireExplicitHealthConsent(
      supabase,
      user.id,
      "health_profile",
      profile.health_data_consent
    );
    if (!consentCheck.ok) {
      return { success: false, error: consentCheck.error };
    }

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

    if (error) {
      logger.error("saveHealthProfile_db_failed", { error: error.message });
      return { success: false, error: "Failed to save health profile" };
    }
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

    if (error) {
      logger.error("getUserMedications_db_failed", { error: error.message });
      return { success: false, error: "Failed to fetch medications" };
    }
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
  > & { health_data_consent?: boolean }
): Promise<ActionResponse<UserMedication>> {
  try {
    // M4: validate + strip server-owned keys (id/user_id/timestamps/is_active).
    const parsed = medicationSchema.safeParse(med);
    if (!parsed.success)
      return { success: false, error: "Invalid medication data" };

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const consentCheck = await requireExplicitHealthConsent(
      supabase,
      user.id,
      "medications_list",
      med.health_data_consent
    );
    if (!consentCheck.ok) {
      return { success: false, error: consentCheck.error };
    }

    const { data, error } = await supabase
      .from("user_medications")
      .insert({ ...parsed.data, user_id: user.id, is_active: true })
      .select()
      .single();

    if (error) {
      logger.error("addMedication_db_failed", { error: error.message });
      return { success: false, error: "Failed to add medication" };
    }
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

    if (!uuidSchema.safeParse(id).success) {
      return { success: false, error: "Invalid medication ID" };
    }

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

    if (error) {
      logger.error("removeMedication_db_failed", { error: error.message });
      return { success: false, error: "Failed to remove medication" };
    }
    return { success: true };
  } catch (error) {
    logger.error("removeMedication_failed", { error: String(error) });
    return { success: false, error: "Failed to remove medication" };
  }
}

// ─── Dosage Calculation History ───────────────────────────────────

export type DosageHistoryEntry =
  Database["public"]["Tables"]["dosage_calculations"]["Row"] & {
    quarantined?: boolean;
  };

function parseDoseAmountAndUnit(
  doseText: string
): { amount: number; unit: string } | null {
  const match = doseText.trim().match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = match[2].trim() || "mg";
  return { amount, unit };
}

export async function saveDosageCalculation(
  calc: Omit<
    Database["public"]["Tables"]["dosage_calculations"]["Row"],
    "id" | "created_at" | "user_id"
  > & { health_data_consent?: boolean }
): Promise<ActionResponse<{ skipped?: boolean }>> {
  try {
    // M4 + Pediatric containment: validate structure, age, adult weight,
    // blocked herbs, and server-verified reference value BEFORE auth/guest no-op
    // so direct invocation fails closed for unauthenticated minor payloads too.
    const parsed = dosageCalculationSchema.safeParse(calc);
    if (!parsed.success) {
      return { success: false, error: "Invalid calculation data" };
    }

    const eligibility = assessDoseEligibility(parsed.data.patient_age);
    if (eligibility.status !== "eligible") {
      logger.warn("saveDosageCalculation_age_gate_rejected", {
        status: eligibility.status,
      });
      return {
        success: false,
        error:
          "Adult reference calculations require a verified adult age (18-120). Pediatric dosing is not available.",
      };
    }

    if (parsed.data.notes) {
      const blocked = matchCalculatorBlockedInput(parsed.data.notes);
      if (blocked) {
        logger.warn("saveDosageCalculation_blocked_herb_rejected", {
          slug: blocked.slug,
          kind: blocked.kind,
        });
        return {
          success: false,
          error:
            blocked.kind === "dangerous"
              ? "Blocked: this plant carries severe toxicity hazards and has no safe home dose."
              : "This herb does not support oral calculator dosing.",
        };
      }
    }

    const parsedAdultDose = parseDoseAmountAndUnit(parsed.data.adult_dose);
    if (!parsedAdultDose) {
      return { success: false, error: "Invalid adult reference dose" };
    }

    const expected = buildAdultReferenceDose({
      adultDose: parsedAdultDose.amount,
      unit: parsedAdultDose.unit,
      ageYears: eligibility.ageYears,
      weightKg: parsed.data.patient_weight_kg,
      heightCm: parsed.data.patient_height_cm,
    });
    const parsedClientDose = parseDoseAmountAndUnit(
      parsed.data.calculated_dose
    );
    if (
      !parsedClientDose ||
      Math.abs(parsedClientDose.amount - expected.dose) > 0.05 ||
      parsedClientDose.unit.toLowerCase() !== expected.unit.toLowerCase()
    ) {
      logger.warn("saveDosageCalculation_tampered_dose_rejected");
      return {
        success: false,
        error: "Submitted dose does not match server-verified adult reference.",
      };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // Distinct skipped state for guests AFTER safety validation passes.
    if (!user) return { success: true, data: { skipped: true } };

    // Resolve herb_id server-side against public.herbs so client cannot bypass
    // calculator blocks by clearing notes and sending a blocked herb UUID.
    if (parsed.data.herb_id) {
      const { data: herbRecord, error: herbLookupError } = await supabase
        .from("herbs_public" as never)
        .select("slug, name")
        .eq("id", parsed.data.herb_id)
        .maybeSingle();
      if (herbLookupError) {
        logger.error("saveDosageCalculation_herb_lookup_failed", {
          error: herbLookupError.message,
        });
        return { success: false, error: "Could not verify herb eligibility." };
      }
      if (!herbRecord) {
        return { success: false, error: "Referenced herb could not be found." };
      }
      const resolvedHerb = herbRecord as {
        slug?: string | null;
        name?: string | null;
      };
      const blockedById =
        matchCalculatorBlockedInput(resolvedHerb.slug) ??
        matchCalculatorBlockedInput(resolvedHerb.name);
      if (blockedById) {
        return {
          success: false,
          error:
            blockedById.kind === "dangerous"
              ? "Blocked: this plant carries severe toxicity hazards and has no safe home dose."
              : "This herb does not support oral calculator dosing.",
        };
      }
    }

    const consentCheck = await requireExplicitHealthConsent(
      supabase,
      user.id,
      "dosage_history",
      calc.health_data_consent
    );
    if (!consentCheck.ok) {
      return { success: false, error: consentCheck.error };
    }

    const verifiedCalculatedDose = `${expected.dose} ${expected.unit}`;
    const { error } = await supabase.from("dosage_calculations").insert({
      ...parsed.data,
      calculated_dose: verifiedCalculatedDose,
      user_id: user.id,
    });

    if (error) {
      logger.error("saveDosageCalculation_failed", { error: error.message });
      if (
        (error as { code?: string }).code === "22P02" &&
        /adult_reference/i.test(error.message ?? "")
      ) {
        return {
          success: false,
          error:
            "Saving adult reference calculations is temporarily unavailable pending schema migration 00100.",
        };
      }
      return { success: false, error: "Failed to save calculation" };
    }
    return { success: true };
  } catch (error) {
    logger.error("saveDosageCalculation_exception", { error: String(error) });
    return { success: false, error: "Failed to save calculation" };
  }
}

export async function getDosageHistory(): Promise<
  ActionResponse<DosageHistoryEntry[]>
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

    if (error) {
      logger.error("getDosageHistory_db_failed", { error: error.message });
      return { success: false, error: "Failed to fetch history" };
    }

    const rows: DosageHistoryEntry[] = (data ?? []).map((row) => {
      const quarantined = isLegacyQuarantinedCalculation(row);
      if (!quarantined) {
        return { ...row, quarantined: false };
      }
      return {
        ...row,
        adult_dose: "[Quarantined legacy record]",
        calculated_dose: "[Quarantined pediatric/unverified dose removed]",
        patient_age: null,
        patient_weight_kg: null,
        patient_height_cm: null,
        patient_bsa: null,
        notes: null,
        quarantined: true,
      };
    });

    return { success: true, data: rows };
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

    const parsed = gardenNoteSchema.safeParse({ herbSlug, note });
    if (!parsed.success) {
      return { success: false, error: "Invalid note data" };
    }

    const { error } = await supabase
      .from("garden_herbs")
      .update({ note: parsed.data.note })
      .eq("user_id", user.id)
      .eq("herb_slug", parsed.data.herbSlug);

    if (error) {
      logger.error("updateGardenNote_db_failed", { error: error.message });
      return { success: false, error: "Failed to update note" };
    }
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
    const parsedSlug = herbSlugSchema.safeParse(herbSlug);
    if (!parsedSlug.success) {
      return { success: false, error: "Invalid herb slug" };
    }
    const cleanSlug = parsedSlug.data;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return { success: true, data: { interactions: [], userMedications: [] } };

    // Get user's active medications
    const { data: meds, error: medsError } = await supabase
      .from("user_medications")
      .select("drug_name")
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (medsError) {
      logger.error("checkUserMedicationInteractions_meds_failed", {
        error: medsError.message,
      });
      return { success: false, error: "Failed to check interactions" };
    }

    if (!meds || meds.length === 0)
      return { success: true, data: { interactions: [], userMedications: [] } };

    // Get the herb
    const { data: herb, error: herbError } = await supabase
      .from("herbs_public" as never)
      .select("id")
      .eq("slug", cleanSlug)
      .eq("is_published", true)
      .single();

    if (herbError) {
      if ((herbError as { code?: string }).code !== "PGRST116") {
        logger.error("checkUserMedicationInteractions_herb_failed", {
          error: herbError.message,
        });
        return { success: false, error: "Failed to check interactions" };
      }
      return { success: false, error: "Herb not found" };
    }

    if (!herb) return { success: false, error: "Herb not found" };
    const resolvedHerbId = (herb as { id: string }).id;

    // Get all drug interactions for this herb
    const { data: interactions, error: interactionsError } = await supabase
      .from("drug_interactions")
      .select("drug_name, severity, description, mechanism")
      .eq("herb_id", resolvedHerbId);

    if (interactionsError) {
      logger.error("checkUserMedicationInteractions_interactions_failed", {
        error: interactionsError.message,
      });
      return { success: false, error: "Failed to check interactions" };
    }

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
      meds.some((m) => matchDrugQueryUnified(m.drug_name, ix.drug_name))
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
