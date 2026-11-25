import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const {
  getPatientProfilesMock,
  savePatientProfileMock,
  updatePatientProfileMock,
  deletePatientProfileMock,
  getHealthProfileMock,
  saveHealthProfileMock,
  getUserMedicationsMock,
  addMedicationMock,
  removeMedicationMock,
  getDosageHistoryMock,
  getPrivacyConsentsMock,
  setPrivacyConsentMock,
  toastErrorMock,
  toastSuccessMock,
} = vi.hoisted(() => ({
  getPatientProfilesMock: vi.fn(),
  savePatientProfileMock: vi.fn(),
  updatePatientProfileMock: vi.fn(),
  deletePatientProfileMock: vi.fn(),
  getHealthProfileMock: vi.fn(),
  saveHealthProfileMock: vi.fn(),
  getUserMedicationsMock: vi.fn(),
  addMedicationMock: vi.fn(),
  removeMedicationMock: vi.fn(),
  getDosageHistoryMock: vi.fn(),
  getPrivacyConsentsMock: vi.fn(),
  setPrivacyConsentMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
    success: toastSuccessMock,
  },
}));

vi.mock("@/lib/actions/profile", () => ({
  getPatientProfiles: getPatientProfilesMock,
  savePatientProfile: savePatientProfileMock,
  updatePatientProfile: updatePatientProfileMock,
  deletePatientProfile: deletePatientProfileMock,
  getHealthProfile: getHealthProfileMock,
  saveHealthProfile: saveHealthProfileMock,
  getUserMedications: getUserMedicationsMock,
  addMedication: addMedicationMock,
  removeMedication: removeMedicationMock,
  getDosageHistory: getDosageHistoryMock,
  getPrivacyConsents: getPrivacyConsentsMock,
  setPrivacyConsent: setPrivacyConsentMock,
}));

import { ProfileClient } from "../profile-client";

describe("ProfileClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPatientProfilesMock.mockResolvedValue({
      success: true,
      data: [
        {
          id: "p-1",
          name: "Alice",
          relationship: "self",
          weight_kg: 65,
          age_years: 32,
          age_months: null,
          height_cm: 168,
          is_default: true,
          notes: null,
        },
      ],
    });
    getHealthProfileMock.mockResolvedValue({
      success: true,
      data: {
        conditions: ["Hypertension"],
        allergies: ["Ragweed"],
      },
    });
    getUserMedicationsMock.mockResolvedValue({
      success: true,
      data: [
        {
          id: "m-1",
          drug_name: "Warfarin",
          dosage: "5mg",
          frequency: "Once daily",
          is_active: true,
        },
      ],
    });
    getDosageHistoryMock.mockResolvedValue({ success: true, data: [] });
    getPrivacyConsentsMock.mockResolvedValue({
      success: true,
      data: {
        health_profile: true,
        patient_profile: true,
        medications_list: true,
        dosage_history: true,
        ai_personalization: true,
      },
    });
    setPrivacyConsentMock.mockResolvedValue({
      success: true,
      data: { recorded: true },
    });
  });

  it("rolls back optimistic condition changes and shows toast.error when saveHealthProfile fails", async () => {
    saveHealthProfileMock.mockResolvedValueOnce({
      success: false,
      error: "Failed to save health profile",
    });

    render(<ProfileClient />);

    const conditionBtn = await screen.findByRole("button", {
      name: /common\.delete Hypertension/i,
    });
    fireEvent.click(conditionBtn);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Failed to save health profile"
      );
    });
    expect(
      screen.getByRole("button", { name: /common\.delete Hypertension/i })
    ).toBeInTheDocument();
  });

  it("shows toast.error when deletePatientProfile fails and exposes accessible labels", async () => {
    deletePatientProfileMock.mockResolvedValueOnce({
      success: false,
      error: "Failed to delete profile",
    });

    render(<ProfileClient />);

    const deletePatientBtn = await screen.findByRole("button", {
      name: /profile\.deletePatient: Alice/i,
    });
    expect(
      screen.getByRole("button", {
        name: /profile\.removeMedication: Warfarin/i,
      })
    ).toBeInTheDocument();

    fireEvent.click(deletePatientBtn);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Failed to delete profile");
    });
  });

  it("redacts quarantined legacy pediatric/unverified history rows without rendering age, weight, or pediatric formula numbers", async () => {
    getDosageHistoryMock.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: "calc-quarantined",
          adult_dose: "[Quarantined legacy record]",
          calculated_dose: "[Quarantined pediatric/unverified dose removed]",
          formula_used: "fried_rule",
          patient_weight_kg: null,
          patient_age: null,
          created_at: "2026-10-01T00:00:00Z",
          quarantined: true,
        },
        {
          id: "calc-adult",
          adult_dose: "500 mg",
          calculated_dose: "500 mg",
          formula_used: "adult_reference",
          patient_weight_kg: 70,
          patient_age: 35,
          created_at: "2026-11-25T00:00:00Z",
          quarantined: false,
        },
      ],
    });

    render(<ProfileClient />);

    expect(
      await screen.findByText("profile.quarantinedHistoryBadge")
    ).toBeInTheDocument();
    expect(screen.queryByText("fried_rule")).not.toBeInTheDocument();
    expect(screen.getByText("500 mg")).toBeInTheDocument();
  });

  it("omits child relationship option and enforces unchecked-by-default health-data consent toggle", async () => {
    getPrivacyConsentsMock.mockResolvedValueOnce({
      success: true,
      data: {
        health_profile: false,
        patient_profile: false,
        medications_list: false,
        dosage_history: false,
        ai_personalization: false,
      },
    });

    const { container } = render(<ProfileClient />);
    const consentBox = (await screen.findByTestId(
      "health-data-consent"
    )) as HTMLInputElement;
    expect(consentBox.checked).toBe(false);

    fireEvent.click(
      screen.getByRole("button", { name: /profile\.addPatient/i })
    );
    expect(container.querySelector('option[value="child"]')).toBeNull();
  });
});
