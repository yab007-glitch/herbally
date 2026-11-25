import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { logger } from "@/lib/utils/logger";

export const CONSENT_SCOPES = [
  "health_profile",
  "patient_profile",
  "medications_list",
  "dosage_history",
  "ai_personalization",
] as const;

export type ConsentScope = (typeof CONSENT_SCOPES)[number];

const CONSENT_VERSION = "2026-11-25-v1";

function isMissingPrivacyTableError(
  error: {
    code?: string;
    message?: string;
  } | null
): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /user_privacy_consents|does not exist|schema cache/i.test(
      error.message ?? ""
    )
  );
}

/**
 * Check whether the user has an active, unrevoked `granted = true` consent
 * record for the given scope in `user_privacy_consents`. Fails closed
 * (`false`) when absent, revoked, errored, or unmigrated.
 */
export async function hasRecordedConsent(
  supabase: SupabaseClient<Database>,
  userId: string,
  scope: ConsentScope
): Promise<boolean> {
  try {
    const client = supabase as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          eq: (
            col: string,
            val: string
          ) => {
            eq: (
              col: string,
              val: string
            ) => {
              maybeSingle: () => Promise<{
                data: {
                  granted?: boolean | null;
                  revoked_at?: string | null;
                } | null;
                error: { code?: string; message?: string } | null;
              }>;
            };
          };
        };
      };
    };

    const { data, error } = await client
      .from("user_privacy_consents")
      .select("granted, revoked_at")
      .eq("user_id", userId)
      .eq("consent_scope", scope)
      .maybeSingle();

    if (error) {
      if (!isMissingPrivacyTableError(error)) {
        logger.warn("privacy_consent_lookup_failed", {
          scope,
          error: error.message,
        });
      }
      return false;
    }

    return data?.granted === true && !data.revoked_at;
  } catch {
    return false;
  }
}

/**
 * Record or withdraw consent in `user_privacy_consents` aligned with migration
 * `00103` (`granted`, `consent_version`, `granted_at`, `revoked_at`).
 */
export async function recordPrivacyConsent(
  supabase: SupabaseClient<Database>,
  userId: string,
  scope: ConsentScope,
  status: "granted" | "withdrawn"
): Promise<{ recorded: boolean; migrationPending?: boolean }> {
  try {
    const now = new Date().toISOString();
    const granted = status === "granted";
    const client = supabase as unknown as {
      from: (table: string) => {
        upsert: (
          row: Record<string, unknown>,
          opts?: { onConflict?: string }
        ) => Promise<{
          error: { code?: string; message?: string } | null;
        }>;
      };
    };

    const { error } = await client.from("user_privacy_consents").upsert(
      {
        user_id: userId,
        consent_scope: scope,
        granted,
        consent_version: CONSENT_VERSION,
        granted_at: granted ? now : null,
        revoked_at: granted ? null : now,
      },
      { onConflict: "user_id,consent_scope" }
    );

    if (error) {
      if (isMissingPrivacyTableError(error)) {
        return { recorded: false, migrationPending: true };
      }
      logger.warn("privacy_consent_upsert_failed", {
        scope,
        error: error.message,
      });
      return { recorded: false };
    }

    return { recorded: true };
  } catch {
    return { recorded: false };
  }
}

/**
 * Require explicit opt-in consent before storing personal health data.
 * Fails closed whenever consent is declined, absent, revoked, or cannot be
 * recorded in `user_privacy_consents`.
 */
export async function requireExplicitHealthConsent(
  supabase: SupabaseClient<Database>,
  userId: string,
  scope: ConsentScope,
  explicitConsent?: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (explicitConsent === false) {
    return {
      ok: false,
      error:
        "Explicit opt-in consent is required before saving personal health information.",
    };
  }

  if (explicitConsent === true) {
    const res = await recordPrivacyConsent(supabase, userId, scope, "granted");
    if (!res.recorded) {
      return {
        ok: false,
        error: res.migrationPending
          ? "Health-data storage is unavailable until consent ledger migration 00103 is applied."
          : "Could not record your explicit privacy consent. Personal health data was not saved.",
      };
    }
    return { ok: true };
  }

  const alreadyGranted = await hasRecordedConsent(supabase, userId, scope);
  if (!alreadyGranted) {
    return {
      ok: false,
      error:
        "Explicit opt-in consent is required before saving personal health information.",
    };
  }

  return { ok: true };
}
