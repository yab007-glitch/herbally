import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import {
  CONSENT_SCOPES,
  hasRecordedConsent,
  recordPrivacyConsent,
  requireExplicitHealthConsent,
} from "../consent";

function makeClient(handlers: {
  maybeSingle?: () => Promise<{ data: unknown; error: unknown }>;
  upsert?: (
    row: Record<string, unknown>,
    opts?: unknown
  ) => Promise<{ error: unknown }>;
}) {
  const selectSpy = vi.fn();
  const upsertSpy = vi.fn(handlers.upsert ?? (async () => ({ error: null })));

  const client = {
    from: vi.fn((table: string) => {
      expect(table).toBe("user_privacy_consents");
      return {
        select: (cols: string) => {
          selectSpy(cols);
          return {
            eq: () => ({
              eq: () => ({
                maybeSingle:
                  handlers.maybeSingle ??
                  (async () => ({ data: null, error: null })),
              }),
            }),
          };
        },
        upsert: upsertSpy,
      };
    }),
  };

  return {
    supabase: client as unknown as SupabaseClient<Database>,
    selectSpy,
    upsertSpy,
  };
}

describe("user_privacy_consents aligned schema & fail-closed ledger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("matches the exact 5 scopes in migration 00103 without research_analytics", () => {
    expect(CONSENT_SCOPES).toEqual([
      "health_profile",
      "patient_profile",
      "medications_list",
      "dosage_history",
      "ai_personalization",
    ]);
    expect(CONSENT_SCOPES as readonly string[]).not.toContain(
      "research_analytics"
    );
  });

  it("handles absent, false, true, and revoked ledger states via granted + revoked_at columns", async () => {
    const absent = makeClient({
      maybeSingle: async () => ({ data: null, error: null }),
    });
    expect(
      await hasRecordedConsent(absent.supabase, "u1", "health_profile")
    ).toBe(false);
    expect(absent.selectSpy).toHaveBeenCalledWith("granted, revoked_at");

    const grantedFalse = makeClient({
      maybeSingle: async () => ({
        data: { granted: false, revoked_at: null },
        error: null,
      }),
    });
    expect(
      await hasRecordedConsent(grantedFalse.supabase, "u1", "health_profile")
    ).toBe(false);

    const revoked = makeClient({
      maybeSingle: async () => ({
        data: { granted: true, revoked_at: "2026-11-25T10:00:00Z" },
        error: null,
      }),
    });
    expect(
      await hasRecordedConsent(revoked.supabase, "u1", "health_profile")
    ).toBe(false);

    const active = makeClient({
      maybeSingle: async () => ({
        data: { granted: true, revoked_at: null },
        error: null,
      }),
    });
    expect(
      await hasRecordedConsent(active.supabase, "u1", "patient_profile")
    ).toBe(true);
  });

  it("upserts aligned schema columns (granted, consent_version, granted_at, revoked_at)", async () => {
    const { supabase, upsertSpy } = makeClient({});
    const res = await recordPrivacyConsent(
      supabase,
      "u1",
      "medications_list",
      "granted"
    );
    expect(res).toEqual({ recorded: true });
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "u1",
        consent_scope: "medications_list",
        granted: true,
        consent_version: "2026-11-25-v1",
        revoked_at: null,
      }),
      { onConflict: "user_id,consent_scope" }
    );
  });

  it("fails closed in requireExplicitHealthConsent when explicit consent cannot be persisted", async () => {
    const dbFailure = makeClient({
      upsert: async () => ({
        error: { code: "23503", message: "foreign key violation" },
      }),
    });
    const resDbFail = await requireExplicitHealthConsent(
      dbFailure.supabase,
      "u1",
      "patient_profile",
      true
    );
    expect(resDbFail.ok).toBe(false);

    const missingTable = makeClient({
      upsert: async () => ({
        error: {
          code: "42P01",
          message: 'relation "public.user_privacy_consents" does not exist',
        },
      }),
    });
    const resPending = await requireExplicitHealthConsent(
      missingTable.supabase,
      "u1",
      "patient_profile",
      true
    );
    expect(resPending.ok).toBe(false);
  });
});
