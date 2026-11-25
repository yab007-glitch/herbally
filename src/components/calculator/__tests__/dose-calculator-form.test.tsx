import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DoseCalculatorForm } from "../dose-calculator-form";

// base-ui's Switch dispatches a synthetic PointerEvent on click; jsdom does not
// implement it. Polyfill before any render so the months toggle is exercisable.
if (typeof window !== "undefined" && !("PointerEvent" in window)) {
  // @ts-expect-error -- minimal jsdom shim, only needs to be constructible
  window.PointerEvent = class PointerEvent extends MouseEvent {};
}

// Passthrough translator: returns the key so assertions can target keys
// rather than English copy (the copy changes; the key is the contract).
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

// The profile integration hook performs a dynamic server-action import in an
// effect. Stub it so the form test stays isolated from Supabase/auth while
// allowing tests to simulate deferred profile arrival.
const profileHookState: {
  profile: {
    weight_kg: number | null;
    age_years: number | null;
    height_cm: number | null;
  } | null;
  loaded: boolean;
} = {
  profile: null,
  loaded: true,
};

vi.mock("../profile-integration", () => ({
  useDefaultPatientProfile: () => profileHookState,
  AutoFillBadge: () => null,
  SaveCalcButton: (props: {
    result: { dose: number; unit: string } | null;
    adultDose: string;
    doseUnit: string;
    weightValue: string;
    ageYears: string;
    selectedFormula: string;
  }) =>
    props.result ? (
      <div
        data-testid="save-calc-snapshot"
        data-dose={`${props.result.dose} ${props.result.unit}`}
        data-adult-dose={`${props.adultDose} ${props.doseUnit}`}
        data-weight-kg={props.weightValue}
        data-age={props.ageYears}
        data-formula={props.selectedFormula}
      />
    ) : null,
}));

function setValue(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function calculate() {
  fireEvent.click(
    screen.getByRole("button", { name: /calculatorForm.calculate/i })
  );
}

/** The large numeric dose lives only in the result card. */
function renderedDose(container: HTMLElement): string | null {
  return container.querySelector(".text-4xl")?.textContent ?? null;
}

beforeEach(() => {
  vi.clearAllMocks();
  profileHookState.profile = null;
  profileHookState.loaded = true;
});

describe("DoseCalculatorForm pediatric gate", () => {
  it("does not render a numeric dose for an 8-year-old (Clark's rule)", () => {
    // Exact production reproduction: 500 mg adult dose, 60 kg, age 8.
    // (60/68)*500 = 441.176... -> 441.2 mg, previously shown to an 8-year-old.
    const { container } = render(<DoseCalculatorForm />);
    setValue(/calculatorForm.adultDose/, "500");
    setValue(/calculatorForm.childWeight/, "60");
    setValue(/calculatorForm.childAge/, "8");
    calculate();

    expect(renderedDose(container)).toBeNull();
    expect(screen.queryByText(/441/)).not.toBeInTheDocument();
    expect(
      screen.getByText("calculatorForm.pediatricDoseBlocked")
    ).toBeInTheDocument();
  });

  it("blocks an adult-looking weight with NO age (cannot verify adult)", () => {
    const { container } = render(<DoseCalculatorForm />);
    setValue(/calculatorForm.adultDose/, "500");
    setValue(/calculatorForm.childWeight/, "70");
    calculate();

    // Absence of age must not silently fall through to a dose: without a
    // confirmed adult age the calculator cannot rule out a minor.
    expect(renderedDose(container)).toBeNull();
    expect(
      screen.getByText("calculatorForm.ageRequiredForAdultDose")
    ).toBeInTheDocument();
  });

  it("still renders the numeric dose for a confirmed adult (18)", () => {
    const { container } = render(<DoseCalculatorForm />);
    setValue(/calculatorForm.adultDose/, "500");
    setValue(/calculatorForm.childWeight/, "60");
    setValue(/calculatorForm.childAge/, "18");
    calculate();

    // Guard against over-blocking: (60/68)*500 = 441.2 for a confirmed adult.
    expect(renderedDose(container)).toContain("441.2");
    expect(
      screen.queryByText("calculatorForm.pediatricDoseBlocked")
    ).not.toBeInTheDocument();
  });

  it("blocks a 17-year-old even with adult weight/height (BSA path)", () => {
    const { container } = render(<DoseCalculatorForm />);
    setValue(/calculatorForm.adultDose/, "500");
    setValue(/calculatorForm.childWeight/, "60");
    setValue(/calculatorForm.childAge/, "17");
    setValue(/calculatorForm.heightCm/, "170");
    fireEvent.click(screen.getByRole("radio", { name: /salisburyRule/i }));
    calculate();

    expect(renderedDose(container)).toBeNull();
    expect(
      screen.getByText("calculatorForm.pediatricDoseBlocked")
    ).toBeInTheDocument();
  });

  it("blocks a 17-year-old before any formula error", () => {
    const { container } = render(<DoseCalculatorForm />);
    setValue(/calculatorForm.adultDose/, "500");
    setValue(/calculatorForm.childWeight/, "60");
    setValue(/calculatorForm.childAge/, "17");
    calculate();

    // Previously a 17-year-old hitting a formula limit showed validation
    // churn; the safety message must take priority.
    expect(renderedDose(container)).toBeNull();
    expect(
      screen.getByText("calculatorForm.pediatricDoseBlocked")
    ).toBeInTheDocument();
  });

  it("blocks a 6-month-old when the months toggle is on", () => {
    const { container } = render(<DoseCalculatorForm />);
    setValue(/calculatorForm.adultDose/, "500");
    setValue(/calculatorForm.childWeight/, "7");
    fireEvent.click(screen.getByRole("switch", { name: /toggleAgeUnit/i }));
    setValue(/calculatorForm.childAge/, "6");
    calculate();

    expect(renderedDose(container)).toBeNull();
    expect(
      screen.getByText("calculatorForm.pediatricDoseBlocked")
    ).toBeInTheDocument();
  });

  it("keeps the invalid adult-dose error ahead of the age gate", () => {
    render(<DoseCalculatorForm />);
    setValue(/calculatorForm.childAge/, "8");
    calculate();

    expect(
      screen.getByText("calculator.errors.invalidDose")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("calculatorForm.pediatricDoseBlocked")
    ).not.toBeInTheDocument();
  });
});

describe("DoseCalculatorForm adult-only wording and range picker", () => {
  it("shows the adult-only notice before any calculation", () => {
    render(<DoseCalculatorForm />);
    expect(
      screen.getByText("calculatorForm.adultOnlyNotice")
    ).toBeInTheDocument();
  });

  it("does not prefill a range midpoint and lets the user pick low explicitly", () => {
    render(
      <DoseCalculatorForm
        prefill={{
          herbName: "Turmeric",
          adultDose: "",
          doseUnit: "mg",
          dosageAdultRaw: "500-2000 mg",
          dosageRange: { low: 500, high: 2000, unit: "mg" },
          dosageForms: ["Capsule"],
          verified: true,
        }}
      />
    );
    const doseInput = screen.getByLabelText(
      /calculatorForm.adultDose/
    ) as HTMLInputElement;
    // No silent midpoint prefill: the field starts empty.
    expect(doseInput.value).toBe("");
    // The numeric dose field no longer uses the herb-select placeholder.
    expect(doseInput.placeholder).toBe("calculatorForm.adultDosePlaceholder");
    fireEvent.click(screen.getByRole("button", { name: /rangeLow/ }));
    expect(doseInput.value).toBe("500");
  });

  it("labels age and weight fields for adults, not children", () => {
    render(<DoseCalculatorForm />);
    const ageInput = screen.getByLabelText(
      /calculatorForm.childAge/
    ) as HTMLInputElement;
    const weightInput = screen.getByLabelText(
      /calculatorForm.childWeight/
    ) as HTMLInputElement;
    // Placeholders are examples, not values that read as prefilled data.
    expect(ageInput.placeholder).toBe("e.g. 30");
    expect(weightInput.placeholder).toBe("e.g. 70");
    expect(ageInput.value).toBe("");
    expect(weightInput.value).toBe("");
  });
});

describe("DoseCalculatorForm unverified stated range", () => {
  it("shows the herb page's stated range as information only, with a blank dose field and no range picker", () => {
    render(
      <DoseCalculatorForm
        prefill={{
          herbName: "Turmeric",
          adultDose: "",
          doseUnit: "mg",
          dosageAdultRaw: "500-2000 mg",
          dosageRange: null,
          dosageForms: [],
          verified: false,
        }}
      />
    );
    const doseInput = screen.getByLabelText(
      /calculatorForm.adultDose/
    ) as HTMLInputElement;
    expect(doseInput.value).toBe("");
    // Informational text only — not a picker button that fills the field.
    expect(
      screen.getByText("calculatorForm.unverifiedStatedRange")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /rangeLow/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /rangeHigh/ })).toBeNull();
  });
});

describe("DoseCalculatorForm stale result & save invalidation", () => {
  it("invalidates calculated result and SaveCalcButton after any input edit", () => {
    const { container } = render(<DoseCalculatorForm />);
    setValue(/calculatorForm.adultDose/, "500");
    setValue(/calculatorForm.childWeight/, "60");
    setValue(/calculatorForm.childAge/, "30");
    calculate();

    expect(renderedDose(container)).toContain("441.2");
    expect(screen.getByTestId("save-calc-snapshot")).toBeInTheDocument();

    // Edit adult dose -> result and Save button must immediately clear
    setValue(/calculatorForm.adultDose/, "1000");
    expect(renderedDose(container)).toBeNull();
    expect(screen.queryByTestId("save-calc-snapshot")).not.toBeInTheDocument();

    // Recalculate, then change unit -> clears
    calculate();
    expect(renderedDose(container)).toContain("882.4");
    fireEvent.click(screen.getByRole("radio", { name: "ml" }));
    expect(renderedDose(container)).toBeNull();

    // Recalculate, then change weight -> clears
    calculate();
    expect(renderedDose(container)).toContain("882.4");
    setValue(/calculatorForm.childWeight/, "70");
    expect(renderedDose(container)).toBeNull();

    // Recalculate, then toggle lbs -> clears
    calculate();
    expect(renderedDose(container)).not.toBeNull();
    fireEvent.click(screen.getByRole("switch", { name: /toggleWeightUnit/i }));
    expect(renderedDose(container)).toBeNull();

    // Calculate with lbs (154 lbs -> ~69.853 kg): SaveCalcButton receives kg
    setValue(/calculatorForm.childWeight/, "154");
    calculate();
    const snapshotEl = screen.getByTestId("save-calc-snapshot");
    expect(Number(snapshotEl.getAttribute("data-weight-kg"))).toBeCloseTo(
      69.9,
      1
    );

    // Change formula -> clears
    fireEvent.click(screen.getByRole("radio", { name: /youngsRule/i }));
    expect(renderedDose(container)).toBeNull();
    expect(screen.queryByTestId("save-calc-snapshot")).not.toBeInTheDocument();
  });

  it("does not overwrite user-edited fields when a profile loads late and invalidates stale results when autofill updates any field", () => {
    profileHookState.profile = null;
    profileHookState.loaded = false;

    const { container, rerender } = render(<DoseCalculatorForm />);
    setValue(/calculatorForm.adultDose/, "500");
    setValue(/calculatorForm.childWeight/, "60");
    setValue(/calculatorForm.childAge/, "30");
    calculate();

    expect(renderedDose(container)).toContain("441.2");
    expect(screen.getByTestId("save-calc-snapshot")).toBeInTheDocument();

    // Profile arrives late with different weight, age, and an unfilled height
    profileHookState.profile = {
      weight_kg: 90,
      age_years: 50,
      height_cm: 180,
    };
    profileHookState.loaded = true;
    rerender(<DoseCalculatorForm />);

    // User-edited weight and age must NOT be overwritten
    expect(
      (screen.getByLabelText(/calculatorForm.childWeight/) as HTMLInputElement)
        .value
    ).toBe("60");
    expect(
      (screen.getByLabelText(/calculatorForm.childAge/) as HTMLInputElement)
        .value
    ).toBe("30");
    // Unedited height gets filled, which changes form state and MUST invalidate the prior snapshot
    expect(
      (screen.getByLabelText(/calculatorForm.heightCm/) as HTMLInputElement)
        .value
    ).toBe("180");
    expect(renderedDose(container)).toBeNull();
    expect(screen.queryByTestId("save-calc-snapshot")).not.toBeInTheDocument();
  });

  it("preserves calculation when late profile arrives and all profile fields were already edited by the user", () => {
    profileHookState.profile = null;
    profileHookState.loaded = false;

    const { container, rerender } = render(<DoseCalculatorForm />);
    setValue(/calculatorForm.adultDose/, "500");
    setValue(/calculatorForm.childWeight/, "60");
    setValue(/calculatorForm.childAge/, "30");
    setValue(/calculatorForm.heightCm/, "170");
    calculate();

    expect(renderedDose(container)).toContain("441.2");

    profileHookState.profile = {
      weight_kg: 90,
      age_years: 50,
      height_cm: 185,
    };
    profileHookState.loaded = true;
    rerender(<DoseCalculatorForm />);

    expect(
      (screen.getByLabelText(/calculatorForm.childWeight/) as HTMLInputElement)
        .value
    ).toBe("60");
    expect(
      (screen.getByLabelText(/calculatorForm.childAge/) as HTMLInputElement)
        .value
    ).toBe("30");
    expect(
      (screen.getByLabelText(/calculatorForm.heightCm/) as HTMLInputElement)
        .value
    ).toBe("170");
    expect(renderedDose(container)).toContain("441.2");
  });

  it("clears stale age_required safety block when late profile supplies age", () => {
    profileHookState.profile = null;
    profileHookState.loaded = false;

    const { rerender } = render(<DoseCalculatorForm />);
    setValue(/calculatorForm.adultDose/, "500");
    setValue(/calculatorForm.childWeight/, "60");
    calculate();

    expect(
      screen.getByText("calculatorForm.ageRequiredForAdultDose")
    ).toBeInTheDocument();

    profileHookState.profile = {
      weight_kg: 85,
      age_years: 35,
      height_cm: null,
    };
    profileHookState.loaded = true;
    rerender(<DoseCalculatorForm />);

    // Weight stays user-edited 60; unedited age fills 35; stale safetyBlock clears
    expect(
      (screen.getByLabelText(/calculatorForm.childWeight/) as HTMLInputElement)
        .value
    ).toBe("60");
    expect(
      (screen.getByLabelText(/calculatorForm.childAge/) as HTMLInputElement)
        .value
    ).toBe("35");
    expect(
      screen.queryByText("calculatorForm.ageRequiredForAdultDose")
    ).not.toBeInTheDocument();
  });
});
