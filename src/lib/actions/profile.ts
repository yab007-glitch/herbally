"use server";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/utils/logger";
import type { ActionResponse } from "@/lib/types";
import type { Database } from "@/lib/types/database";

type PatientProfile = Database["public"]["Tables"]["patient_profiles"]["Row"];
type HealthProfile = Database["public"]["Tables"]["health_profiles"]["Row"];
type UserMedication = Database["public"]["Tables"]["user_medications"]["Row"];

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

    // If setting as default, unset other defaults first
    if (profile.is_default) {
      await supabase
        .from("patient_profiles")
        .update({ is_default: false })
        .eq("user_id", user.id)
        .eq("is_default", true);
    }

    const { data, error } = await supabase
      .from("patient_profiles")
      .insert({ ...profile, user_id: user.id })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
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
        .eq("is_default", true);
    }

    const { data, error } = await supabase
      .from("patient_profiles")
      .update(updates)
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
  profile: Pick<HealthProfile, "conditions" | "allergies" | "medications">
): Promise<ActionResponse<HealthProfile>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { data, error } = await supabase
      .from("health_profiles")
      .upsert({ ...profile, user_id: user.id }, { onConflict: "user_id" })
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
      .order("is_active", { ascending: false })
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

    const { data, error } = await supabase
      .from("user_medications")
      .insert({ ...med, user_id: user.id, is_active: true })
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

    const { error } = await supabase
      .from("user_medications")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

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
): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: true }; // Silently skip for guests

    const { error } = await supabase
      .from("dosage_calculations")
      .insert({ ...calc, user_id: user.id });

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

    // Filter interactions to only those matching user's medications
    const userMedNames = meds.map((m) => m.drug_name.toLowerCase());
    const matched = interactions.filter((ix) => {
      const ixName = ix.drug_name.toLowerCase();
      return userMedNames.some(
        (mn) => ixName.includes(mn) || mn.includes(ixName)
      );
    });

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
