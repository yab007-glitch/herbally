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
  addMedication,
  saveDosageCalculation,
  saveHealthProfile,
  savePatientProfile,
  updatePatientProfile,
  updateGardenNote,
  checkUserMedicationInteractions,
} from "./profile";

function calculation(over: Record<string, unknown> = {}) {
  return {
    adult_dose: "500 mg",
    calculated_dose: "500 mg",
    formula_used: "adult_reference" as const,
    patient_weight_kg: 70,
    patient_age: 30,
    patient_height_cm: null,
    patient_bsa: null,
    herb_id: null,
    notes: "Turmeric",
    health_data_consent: true,
    ...over,
  };
}

describe("saveDosageCalculation pediatric gate (server-side)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    insertMock.mockResolvedValue({ error: null });
    fromMock.mockImplementation((table: string) => {
      if (table === "user_privacy_consents") {
        return { upsert: async () => ({ error: null }) };
      }
      return { insert: insertMock };
    });
  });

  it("rejects persisting a calculation for a patient under 18", async () => {
    const result = await saveDosageCalculation(
      calculation({ patient_age: 8, calculated_dose: "500 mg" })
    );

    expect(result.success).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects a fabricated all-ages-omitted payload", async () => {
    const result = await saveDosageCalculation(
      calculation({
        patient_age: null,
        patient_weight_kg: null,
        calculated_dose: "500 mg",
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
        calculated_dose: "500 mg",
      })
    );

    expect(result.success).toBe(true);
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it("runs age gate BEFORE guest no-op so pediatric payloads always reject while adult guest payloads return skipped", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const minorResult = await saveDosageCalculation(
      calculation({ patient_age: 8 })
    );
    expect(minorResult.success).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();

    const adultResult = await saveDosageCalculation(
      calculation({ patient_age: 30 })
    );
    expect(adultResult.success).toBe(true);
    expect(adultResult).toMatchObject({
      success: true,
      data: { skipped: true },
    });
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
    fromMock.mockImplementation((table: string) => {
      if (table === "user_privacy_consents") {
        return { upsert: async () => ({ error: null }) };
      }
      return {
        update: (payload: Record<string, unknown>) => {
          updateCalls.push(payload);
          return {
            eq: () => ({
              eq: () => ({
                select: () => ({
                  single: async () => ({
                    data: null,
                    error: {
                      message: 'violates row-level security policy "p"',
                    },
                  }),
                }),
              }),
            }),
          };
        },
      };
    });

    const res = await updatePatientProfile(VALID_UUID, {
      id: "other-id",
      user_id: "other-user",
      is_default: true,
      name: "Alice",
      health_data_consent: true,
    } as Record<string, unknown>);

    expect(res).toEqual({ success: false, error: "Failed to update profile" });
    expect(updateCalls).toEqual([{ is_default: true, name: "Alice" }]);
  });

  it("rejects child relationships, age_months, and minor ages on savePatientProfile and updatePatientProfile", async () => {
    const childSave = await savePatientProfile({
      name: "Minor",
      relationship: "child",
      weight_kg: 25,
      age_years: 10,
      age_months: null,
      height_cm: null,
      is_default: false,
      notes: null,
      health_data_consent: true,
    });
    expect(childSave.success).toBe(false);

    const minorUpdate = await updatePatientProfile(VALID_UUID, {
      age_years: 12,
      health_data_consent: true,
    } as Record<string, unknown>);
    expect(minorUpdate.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("enforces explicit opt-in consent or recorded ledger across all health writes", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "user_privacy_consents") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        };
      }
      return { insert: insertMock, upsert: vi.fn(), update: vi.fn() };
    });

    const pRes = await savePatientProfile({
      name: "Adult",
      relationship: "self",
      weight_kg: 70,
      age_years: 30,
      age_months: null,
      height_cm: null,
      is_default: false,
      notes: null,
    });
    expect(pRes.success).toBe(false);

    const hRes = await saveHealthProfile({
      conditions: ["Asthma"],
      allergies: [],
    });
    expect(hRes.success).toBe(false);

    const mRes = await addMedication({
      drug_name: "Warfarin",
      dosage: null,
      frequency: null,
      rxcui: null,
      notes: null,
    });
    expect(mRes.success).toBe(false);

    const dRes = await saveDosageCalculation(
      calculation({ health_data_consent: undefined })
    );
    expect(dRes.success).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("resolves herb_id server-side in saveDosageCalculation and surfaces pre-00100 22P02 cleanly", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "herbs" || table === "herbs_public") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { slug: "aconite-processed", name: "Aconite" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "user_privacy_consents") {
        return { upsert: async () => ({ error: null }) };
      }
      return { insert: insertMock };
    });

    const blockedRes = await saveDosageCalculation(
      calculation({ herb_id: VALID_UUID, notes: null })
    );
    expect(blockedRes.success).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();

    fromMock.mockImplementation((table: string) => {
      if (table === "user_privacy_consents") {
        return { upsert: async () => ({ error: null }) };
      }
      if (table === "dosage_calculations") {
        return {
          insert: async () => ({
            error: {
              code: "22P02",
              message:
                'invalid input value for enum formula_type: "adult_reference"',
            },
          }),
        };
      }
      return { insert: insertMock };
    });
    const enumErrRes = await saveDosageCalculation(calculation());
    expect(enumErrRes.success).toBe(false);
    if (!enumErrRes.success) {
      expect(enumErrRes.error).toMatch(/00100|unavailable/i);
    }
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
      if (table === "herbs" || table === "herbs_public") {
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

  it("matches user medications via unified matcher across brand/generic aliases", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "user_medications") {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({
                data: [{ drug_name: "Coumadin 5mg" }],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "herbs" || table === "herbs_public") {
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
              data: [
                {
                  drug_name: "Warfarin (Anticoagulant)",
                  severity: "severe",
                  description: "Bleeding risk.",
                  mechanism: "Antiplatelet effect",
                },
              ],
              error: null,
            }),
          }),
        };
      }
      return {};
    });

    const res = await checkUserMedicationInteractions("ginger");
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data?.interactions).toHaveLength(1);
    }
  });
});
