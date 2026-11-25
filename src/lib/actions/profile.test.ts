import { describe, it, expect, vi, beforeEach } from "vitest";

const { insertMock, getUserMock, fromMock } = vi.hoisted(() => ({
  insertMock: vi.fn(),
  getUserMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  saveDosageCalculation,
  updatePatientProfile,
  updateGardenNote,
  checkUserMedicationInteractions,
} from "./profile";

function calculation(over: Record<string, unknown> = {}) {
  return {
    adult_dose: "500 mg",
    calculated_dose: "441.2 mg",
    formula_used: "clarks_rule" as const,
    patient_weight_kg: 30,
    patient_age: 8,
    patient_height_cm: null,
    patient_bsa: null,
    herb_id: null,
    notes: "Turmeric",
    ...over,
  };
}

describe("saveDosageCalculation pediatric gate (server-side)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    insertMock.mockResolvedValue({ error: null });
    fromMock.mockImplementation(() => ({ insert: insertMock }));
  });

  it("rejects persisting a calculation for a patient under 18", async () => {
    const result = await saveDosageCalculation(
      calculation({ patient_age: 8, calculated_dose: "441.2 mg" })
    );

    // A server action can be invoked directly with arbitrary JSON; the UI gate
    // alone is bypassable. Nothing may be written for a minor.
    expect(result.success).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects a fabricated all-ages-omitted payload", async () => {
    const result = await saveDosageCalculation(
      calculation({
        patient_age: null,
        patient_weight_kg: null,
        calculated_dose: "441.2 mg",
      })
    );

    expect(result.success).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects an out-of-range age that is not a plausible adult", async () => {
    const result = await saveDosageCalculation(
      calculation({ patient_age: 130, calculated_dose: "500 mg" })
    );

    expect(result.success).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("still saves a confirmed adult calculation", async () => {
    const result = await saveDosageCalculation(
      calculation({
        patient_age: 30,
        patient_weight_kg: 60,
        calculated_dose: "441.2 mg",
      })
    );

    expect(result.success).toBe(true);
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it("does not write for guests (skipped) even with a pediatric payload", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const result = await saveDosageCalculation(calculation({ patient_age: 8 }));

    // Guest path short-circuits before insert; it must not claim a save.
    expect(result.success).toBe(true);
    expect(result).toMatchObject({ success: true, data: { skipped: true } });
    expect(insertMock).not.toHaveBeenCalled();
  });
});

describe("profile actions hardening", () => {
  const VALID_UUID = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
  });

  it("rejects invalid UUID and out-of-bounds updates in updatePatientProfile", async () => {
    const badId = await updatePatientProfile("not-a-uuid", { name: "Jane" });
    expect(badId).toEqual({ success: false, error: "Invalid profile ID" });
    expect(fromMock).not.toHaveBeenCalled();

    const badFields = await updatePatientProfile(VALID_UUID, {
      weight_kg: 5000,
    });
    expect(badFields).toEqual({
      success: false,
      error: "Invalid profile data",
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("strips immutable columns and does not unset other defaults if target update fails", async () => {
    const updateCalls: Array<Record<string, unknown>> = [];
    fromMock.mockImplementation(() => ({
      update: (payload: Record<string, unknown>) => {
        updateCalls.push(payload);
        return {
          eq: () => ({
            eq: () => ({
              select: () => ({
                single: async () => ({
                  data: null,
                  error: { message: 'violates row-level security policy "p"' },
                }),
              }),
            }),
          }),
        };
      },
    }));

    const res = await updatePatientProfile(VALID_UUID, {
      id: "other-id",
      user_id: "other-user",
      is_default: true,
      name: "Alice",
    } as Record<string, unknown>);

    expect(res).toEqual({ success: false, error: "Failed to update profile" });
    expect(updateCalls).toEqual([{ is_default: true, name: "Alice" }]);
  });

  it("validates herbSlug and note length in updateGardenNote", async () => {
    const emptySlug = await updateGardenNote("   ", "hello");
    expect(emptySlug).toEqual({ success: false, error: "Invalid note data" });

    const tooLongNote = await updateGardenNote("turmeric", "a".repeat(2001));
    expect(tooLongNote).toEqual({
      success: false,
      error: "Invalid note data",
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("fails closed instead of returning empty interactions when DB queries error", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "user_medications") {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({
                data: null,
                error: { message: "db connection reset" },
              }),
            }),
          }),
        };
      }
      return {};
    });

    const medsErrRes = await checkUserMedicationInteractions("turmeric");
    expect(medsErrRes).toEqual({
      success: false,
      error: "Failed to check interactions",
    });

    fromMock.mockImplementation((table: string) => {
      if (table === "user_medications") {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({
                data: [{ drug_name: "Warfarin" }],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "herbs") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({
                  data: { id: "h-1" },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "drug_interactions") {
        return {
          select: () => ({
            eq: async () => ({
              data: null,
              error: { message: "statement timeout" },
            }),
          }),
        };
      }
      return {};
    });

    const ixErrRes = await checkUserMedicationInteractions("turmeric");
    expect(ixErrRes).toEqual({
      success: false,
      error: "Failed to check interactions",
    });
  });
});
