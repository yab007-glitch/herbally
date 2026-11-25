import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn();
const insertMock = vi.fn();
const selectHistoryMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: getUserMock,
    },
    from: (table: string) => {
      if (table === "dosage_calculations") {
        return {
          insert: insertMock,
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: selectHistoryMock,
              }),
            }),
          }),
        };
      }
      if (table === "user_privacy_consents") {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    },
  }),
}));

import { getDosageHistory, saveDosageCalculation } from "../profile";

beforeEach(() => {
  vi.clearAllMocks();
  getUserMock.mockResolvedValue({ data: { user: { id: "user-123" } } });
  insertMock.mockResolvedValue({ error: null });
  selectHistoryMock.mockResolvedValue({ data: [], error: null });
});

describe("saveDosageCalculation pediatric & tampering containment", () => {
  it("rejects minor, zero, null, and >120 ages BEFORE guest no-op (even unauthenticated)", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    for (const age of [0, 8, 17.99, null, 121]) {
      const res = await saveDosageCalculation({
        adult_dose: "500 mg",
        calculated_dose: "500 mg",
        formula_used: "adult_reference" as never,
        patient_weight_kg: 70,
        patient_age: age,
        patient_height_cm: null,
        patient_bsa: null,
        herb_id: null,
        notes: "Turmeric",
      });
      expect(res.success).toBe(false);
      expect(insertMock).not.toHaveBeenCalled();
    }
  });

  it("rejects fried_rule and legacy pediatric scaling formulas", async () => {
    for (const formula of [
      "fried_rule",
      "clarks_rule",
      "youngs_rule",
      "bsa",
    ] as const) {
      const res = await saveDosageCalculation({
        adult_dose: "500 mg",
        calculated_dose: "500 mg",
        formula_used: formula,
        patient_weight_kg: 70,
        patient_age: 30,
        patient_height_cm: 170,
        patient_bsa: null,
        herb_id: null,
        notes: "Turmeric",
      });
      expect(res.success).toBe(false);
      expect(insertMock).not.toHaveBeenCalled();
    }
  });

  it("rejects zero or implausible patient weight", async () => {
    for (const weight of [0, 5, 400]) {
      const res = await saveDosageCalculation({
        adult_dose: "500 mg",
        calculated_dose: "500 mg",
        formula_used: "adult_reference" as never,
        patient_weight_kg: weight,
        patient_age: 30,
        patient_height_cm: null,
        patient_bsa: null,
        herb_id: null,
        notes: "Turmeric",
      });
      expect(res.success).toBe(false);
      expect(insertMock).not.toHaveBeenCalled();
    }
  });

  it("rejects client-tampered calculated_dose that mismatches server adult reference", async () => {
    const res = await saveDosageCalculation({
      adult_dose: "500 mg",
      calculated_dose: "9999 mg",
      formula_used: "adult_reference" as never,
      patient_weight_kg: 70,
      patient_age: 30,
      patient_height_cm: null,
      patient_bsa: null,
      herb_id: null,
      notes: "Turmeric",
    });
    expect(res.success).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects dangerous herbs in notes", async () => {
    const res = await saveDosageCalculation({
      adult_dose: "500 mg",
      calculated_dose: "500 mg",
      formula_used: "adult_reference" as never,
      patient_weight_kg: 70,
      patient_age: 30,
      patient_height_cm: null,
      patient_bsa: null,
      herb_id: null,
      notes: "Aconite",
    });
    expect(res.success).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("persists a valid verified adult reference calculation with explicit consent and fails without it", async () => {
    const denied = await saveDosageCalculation({
      adult_dose: "500 mg",
      calculated_dose: "500 mg",
      formula_used: "adult_reference" as never,
      patient_weight_kg: 70,
      patient_age: 30,
      patient_height_cm: null,
      patient_bsa: null,
      herb_id: null,
      notes: "Turmeric",
    });
    expect(denied.success).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();

    const res = await saveDosageCalculation({
      adult_dose: "500 mg",
      calculated_dose: "500 mg",
      formula_used: "adult_reference" as never,
      patient_weight_kg: 70,
      patient_age: 30,
      patient_height_cm: null,
      patient_bsa: null,
      herb_id: null,
      notes: "Turmeric",
      health_data_consent: true,
    });
    expect(res.success).toBe(true);
    expect(insertMock).toHaveBeenCalledTimes(1);
  });
});

describe("getDosageHistory legacy pediatric redaction", () => {
  it("redacts numeric doses on legacy <18, null-age, and fried_rule rows without hiding valid adult rows", async () => {
    selectHistoryMock.mockResolvedValue({
      data: [
        {
          id: "row-minor",
          user_id: "user-123",
          herb_id: null,
          patient_age: 8,
          patient_weight_kg: 30,
          patient_height_cm: null,
          patient_bsa: null,
          adult_dose: "500 mg",
          calculated_dose: "220.6 mg",
          formula_used: "clarks_rule",
          notes: "Turmeric",
          created_at: "2026-10-01T00:00:00Z",
        },
        {
          id: "row-null",
          user_id: "user-123",
          herb_id: null,
          patient_age: null,
          patient_weight_kg: 12,
          patient_height_cm: null,
          patient_bsa: null,
          adult_dose: "500 mg",
          calculated_dose: "40 mg",
          formula_used: "fried_rule",
          notes: "Chamomile",
          created_at: "2026-10-02T00:00:00Z",
        },
        {
          id: "row-adult",
          user_id: "user-123",
          herb_id: null,
          patient_age: 35,
          patient_weight_kg: 72,
          patient_height_cm: null,
          patient_bsa: null,
          adult_dose: "500 mg",
          calculated_dose: "500 mg",
          formula_used: "adult_reference",
          notes: "Ginger",
          created_at: "2026-11-25T00:00:00Z",
        },
      ],
      error: null,
    });

    const res = await getDosageHistory();
    expect(res.success).toBe(true);
    if (!res.success || !res.data) throw new Error("Expected data");
    expect(res.data).toHaveLength(3);

    const minor = res.data.find((r) => r.id === "row-minor")!;
    expect(minor.calculated_dose).not.toMatch(/220\.6/);
    expect(minor.adult_dose).not.toMatch(/500/);
    expect((minor as { quarantined?: boolean }).quarantined).toBe(true);

    const nullRow = res.data.find((r) => r.id === "row-null")!;
    expect(nullRow.calculated_dose).not.toMatch(/40/);
    expect((nullRow as { quarantined?: boolean }).quarantined).toBe(true);

    const adult = res.data.find((r) => r.id === "row-adult")!;
    expect(adult.calculated_dose).toBe("500 mg");
    expect((adult as { quarantined?: boolean }).quarantined).toBe(false);
  });
});
