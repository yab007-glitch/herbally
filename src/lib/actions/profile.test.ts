import { describe, it, expect, vi, beforeEach } from "vitest";

const insertMock = vi.fn();
const getUserMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: () => ({ insert: insertMock }),
  }),
}));

import { saveDosageCalculation } from "./profile";

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
