import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  renderHook,
  waitFor,
} from "@testing-library/react";

const {
  getPatientProfilesMock,
  saveDosageCalculationMock,
  toastSuccessMock,
  toastErrorMock,
  toastInfoMock,
} = vi.hoisted(() => ({
  getPatientProfilesMock: vi.fn(),
  saveDosageCalculationMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastInfoMock: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
    info: toastInfoMock,
  },
}));

vi.mock("@/lib/actions/profile", () => ({
  getPatientProfiles: getPatientProfilesMock,
  saveDosageCalculation: saveDosageCalculationMock,
}));

import {
  SaveCalcButton,
  useDefaultPatientProfile,
} from "../profile-integration";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useDefaultPatientProfile eligibility gating", () => {
  it("never exposes under-18, child relationship, age_months, or unknown-age profiles for autofill", async () => {
    for (const profile of [
      {
        id: "p-minor",
        relationship: "child",
        age_years: 8,
        age_months: null,
        weight_kg: 26,
        height_cm: 128,
        is_default: true,
      },
      {
        id: "p-months",
        relationship: "self",
        age_years: null,
        age_months: 18,
        weight_kg: 11,
        height_cm: 82,
        is_default: true,
      },
      {
        id: "p-unknown",
        relationship: "self",
        age_years: null,
        age_months: null,
        weight_kg: 70,
        height_cm: 175,
        is_default: true,
      },
    ]) {
      getPatientProfilesMock.mockResolvedValueOnce({
        success: true,
        data: [profile],
      });
      const { result } = renderHook(() => useDefaultPatientProfile());
      await waitFor(() => expect(result.current.loaded).toBe(true));
      expect(result.current.profile).toBeNull();
    }
  });

  it("exposes a confirmed 18+ adult non-child profile for autofill", async () => {
    getPatientProfilesMock.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: "p-child",
          relationship: "child",
          age_years: 7,
          age_months: null,
          weight_kg: 22,
          height_cm: 120,
          is_default: true,
        },
        {
          id: "p-adult",
          relationship: "self",
          age_years: 34,
          age_months: null,
          weight_kg: 70,
          height_cm: 175,
          is_default: false,
        },
      ],
    });
    const { result } = renderHook(() => useDefaultPatientProfile());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.profile).toEqual({
      weight_kg: 70,
      age_years: 34,
      height_cm: 175,
    });
  });
});

describe("SaveCalcButton concurrency & stale snapshot guard", () => {
  it("disables while in-flight, prevents double submit, and uses adult_reference", async () => {
    let resolveSave!: (val: { success: boolean }) => void;
    saveDosageCalculationMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        })
    );

    render(
      <SaveCalcButton
        result={{
          dose: 500,
          unit: "mg",
          formula: "Unscaled adult reference (18+): 500 mg",
          explanation: "Confirmed adult reference",
          clamped: false,
        }}
        herbName="Turmeric"
        adultDose="500"
        doseUnit="mg"
        weightValue="70"
        ageYears="30"
        heightCm="175"
        selectedFormula="adult_reference"
      />
    );

    const consentBox = screen.getByTestId(
      "save-history-consent"
    ) as HTMLInputElement;
    expect(consentBox.checked).toBe(false);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();

    fireEvent.click(consentBox);
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    await waitFor(() =>
      expect(saveDosageCalculationMock).toHaveBeenCalledTimes(1)
    );
    expect(saveDosageCalculationMock.mock.calls[0][0].formula_used).toBe(
      "adult_reference"
    );
    expect(saveDosageCalculationMock.mock.calls[0][0].health_data_consent).toBe(
      true
    );

    await act(async () => {
      resolveSave({ success: true });
    });

    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledTimes(1));
  });

  it("ignores stale save completion if inputs/result changed before resolution", async () => {
    let resolveSave!: (val: { success: boolean }) => void;
    saveDosageCalculationMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        })
    );

    const { rerender } = render(
      <SaveCalcButton
        result={{
          dose: 500,
          unit: "mg",
          formula: "Unscaled adult reference (18+): 500 mg",
          explanation: "Confirmed adult reference",
          clamped: false,
        }}
        herbName="Turmeric"
        adultDose="500"
        doseUnit="mg"
        weightValue="70"
        ageYears="30"
        heightCm=""
        selectedFormula="adult_reference"
      />
    );

    fireEvent.click(screen.getByTestId("save-history-consent"));
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() =>
      expect(saveDosageCalculationMock).toHaveBeenCalledTimes(1)
    );

    rerender(
      <SaveCalcButton
        result={{
          dose: 750,
          unit: "mg",
          formula: "Unscaled adult reference (18+): 750 mg",
          explanation: "Confirmed adult reference",
          clamped: false,
        }}
        herbName="Ginger"
        adultDose="750"
        doseUnit="mg"
        weightValue="70"
        ageYears="30"
        heightCm=""
        selectedFormula="adult_reference"
      />
    );

    await act(async () => {
      resolveSave({ success: true });
    });

    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it("converts lbs to kg before sending patient_weight_kg when weightUnit is lbs", async () => {
    saveDosageCalculationMock.mockResolvedValueOnce({ success: true });
    render(
      <SaveCalcButton
        result={{
          dose: 500,
          unit: "mg",
          formula: "Unscaled adult reference (18+): 500 mg",
          explanation: "Confirmed adult reference",
          clamped: false,
        }}
        herbName="Turmeric"
        adultDose="500"
        doseUnit="mg"
        weightValue="154"
        weightUnit="lbs"
        ageYears="30"
        heightCm=""
        selectedFormula="adult_reference"
      />
    );

    fireEvent.click(screen.getByTestId("save-history-consent"));
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() =>
      expect(saveDosageCalculationMock).toHaveBeenCalledTimes(1)
    );
    expect(
      saveDosageCalculationMock.mock.calls[0][0].patient_weight_kg
    ).toBeCloseTo(69.9, 1);
  });
});
