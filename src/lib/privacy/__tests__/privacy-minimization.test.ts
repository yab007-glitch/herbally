import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

const { getUserMock, fromMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));

import { saveHealthProfile, savePatientProfile } from "@/lib/actions/profile";
import { getDataFlowInventory } from "../data-flows";

beforeEach(() => {
  vi.clearAllMocks();
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
});

describe("Phase D privacy & security minimization controls", () => {
  it("blocks storing sensitive health/patient profile data when explicit opt-in consent is declined", async () => {
    const resHealth = await saveHealthProfile({
      conditions: ["Diabetes"],
      allergies: [],
      is_pregnant: false,
      is_nursing: false,
      notes: null,
      health_data_consent: false,
    });
    expect(resHealth.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();

    const resPatient = await savePatientProfile({
      name: "Self",
      relationship: "self",
      weight_kg: 70,
      age_years: 35,
      age_months: null,
      height_cm: 175,
      is_default: true,
      notes: null,
      health_data_consent: false,
    });
    expect(resPatient.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("documents client/server data flows honestly without unverified compliance claims", () => {
    const flows = getDataFlowInventory();
    expect(flows.length).toBeGreaterThanOrEqual(4);
    const serialized = JSON.stringify(flows);
    expect(serialized).not.toMatch(
      /HIPAA[- ]compliant|EFVP complete|DPA signed/i
    );
  });

  it("ensures service worker strictly excludes private/auth/api/profile routes from public caches", () => {
    const swSource = fs.readFileSync(
      path.join(process.cwd(), "public/sw.js"),
      "utf8"
    );
    expect(swSource).toMatch(/PRIVATE_PATH_RE/);
    expect(swSource).toMatch(/\/api\//);
    expect(swSource).toMatch(/\/auth\//);
    expect(swSource).toMatch(/profile/);
    expect(swSource).toMatch(/herbalist/);
  });
});
