import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DoseCalculatorForm } from "../dose-calculator-form";

if (typeof window !== "undefined" && !("PointerEvent" in window)) {
  // @ts-expect-error -- minimal jsdom shim for base-ui Switch
  window.PointerEvent = class PointerEvent extends MouseEvent {};
}

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

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

function renderedDose(container: HTMLElement): string | null {
  return container.querySelector(".text-4xl")?.textContent ?? null;
}

beforeEach(() => {
  vi.clearAllMocks();
  profileHookState.profile = null;
  profileHookState.loaded = true;
});

describe("DoseCalculatorForm pediatric & formula containment", () => {
  it("removes months toggle and all pediatric/adult-derived scaling formula radios", () => {
    render(<DoseCalculatorForm />);
    expect(
      screen.queryByRole("switch", { name: /toggleAgeUnit/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("radio", {
        name: /clarkRule|youngsRule|salisburyRule|friedRule/i,
      })
    ).not.toBeInTheDocument();
  });

  it("treats age 0 (infant) and age < 18 as pediatric_unavailable BEFORE adult-dose check", () => {
    for (const minorAge of ["0", "8", "17"]) {
      const { container, unmount } = render(<DoseCalculatorForm />);
      setValue(/calculatorForm.childAge/, minorAge);
      calculate();

      expect(renderedDose(container)).toBeNull();
      expect(
        screen.getByText("calculatorForm.pediatricDoseBlocked")
      ).toBeInTheDocument();
      expect(
        screen.queryByText("calculator.errors.invalidDose")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("save-calc-snapshot")
      ).not.toBeInTheDocument();
      unmount();
    }
  });

  it("treats missing, negative, or >120 age distinctly as age_unverified BEFORE adult-dose check", () => {
    for (const badAge of ["", "200"]) {
      const { container, unmount } = render(<DoseCalculatorForm />);
      if (badAge) setValue(/calculatorForm.childAge/, badAge);
      calculate();

      expect(renderedDose(container)).toBeNull();
      expect(
        screen.getByText("calculatorForm.ageRequiredForAdultDose")
      ).toBeInTheDocument();
      expect(
        screen.queryByText("calculatorForm.pediatricDoseBlocked")
      ).not.toBeInTheDocument();
      unmount();
    }
  });

  it("blocks dangerous free-text herbs (e.g. Aconite) with hazard precedence over pediatric/dose checks and hides range picker & Save", () => {
    const { container } = render(
      <DoseCalculatorForm
        prefill={{
          herbName: "Turmeric",
          adultDose: "",
          doseUnit: "mg",
          dosageAdultRaw: "500-2000 mg",
          dosageRange: { low: 500, high: 2000, unit: "mg" },
          dosageForms: [],
          verified: true,
        }}
      />
    );
    setValue(/calculatorForm.herbName/, "Aconite");
    setValue(/calculatorForm.adultDose/, "500");
    setValue(/calculatorForm.childAge/, "8");
    calculate();

    expect(renderedDose(container)).toBeNull();
    expect(screen.queryByTestId("save-calc-snapshot")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /rangeLow/ })).toBeNull();
    expect(
      screen.getByText("calculatorForm.dangerousHerbBlockedTitle")
    ).toBeInTheDocument();
  });

  it("blocks non-dosable free-text herbs (e.g. Comfrey) without computing a number or showing Save", () => {
    const { container } = render(<DoseCalculatorForm />);
    setValue(/calculatorForm.herbName/, "Comfrey");
    setValue(/calculatorForm.adultDose/, "500");
    setValue(/calculatorForm.childAge/, "30");
    calculate();

    expect(renderedDose(container)).toBeNull();
    expect(screen.queryByTestId("save-calc-snapshot")).not.toBeInTheDocument();
    expect(
      screen.getByText("calculatorForm.nonDosableHerbBlockedTitle")
    ).toBeInTheDocument();
  });

  it("confirms unscaled adult reference (no Clark's scaling) for verified 18+ adults and rejects implausible adult weights", () => {
    const { container } = render(<DoseCalculatorForm />);
    setValue(/calculatorForm.adultDose/, "500");
    setValue(/calculatorForm.childWeight/, "5");
    setValue(/calculatorForm.childAge/, "30");
    calculate();

    expect(renderedDose(container)).toBeNull();
    expect(
      screen.getByText("calculator.errors.invalidAdultWeight")
    ).toBeInTheDocument();

    setValue(/calculatorForm.childWeight/, "60");
    calculate();

    expect(renderedDose(container)).toContain("500");
    expect(renderedDose(container)).not.toContain("441");
    expect(
      screen.getByTestId("save-calc-snapshot").getAttribute("data-formula")
    ).toBe("adult_reference");
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
    expect(doseInput.value).toBe("");
    expect(doseInput.placeholder).toBe("calculatorForm.adultDosePlaceholder");
    fireEvent.click(screen.getByRole("button", { name: /rangeLow/ }));
    expect(doseInput.value).toBe("500");
  });

  it("hides the adult range picker when a pediatric or age block is active", () => {
    const { container } = render(
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
    setValue(/calculatorForm.childAge/, "12");
    calculate();

    expect(renderedDose(container)).toBeNull();
    expect(screen.queryByRole("button", { name: /rangeLow/ })).toBeNull();
    expect(screen.queryByTestId("save-calc-snapshot")).not.toBeInTheDocument();
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

    expect(renderedDose(container)).toContain("500");
    expect(screen.getByTestId("save-calc-snapshot")).toBeInTheDocument();

    setValue(/calculatorForm.adultDose/, "1000");
    expect(renderedDose(container)).toBeNull();
    expect(screen.queryByTestId("save-calc-snapshot")).not.toBeInTheDocument();

    calculate();
    expect(renderedDose(container)).toContain("1000");
    fireEvent.click(screen.getByRole("radio", { name: "ml" }));
    expect(renderedDose(container)).toBeNull();

    calculate();
    expect(renderedDose(container)).not.toBeNull();
    setValue(/calculatorForm.childWeight/, "70");
    expect(renderedDose(container)).toBeNull();

    calculate();
    expect(renderedDose(container)).not.toBeNull();
    fireEvent.click(screen.getByRole("switch", { name: /toggleWeightUnit/i }));
    expect(renderedDose(container)).toBeNull();

    setValue(/calculatorForm.childWeight/, "154");
    calculate();
    const snapshotEl = screen.getByTestId("save-calc-snapshot");
    expect(Number(snapshotEl.getAttribute("data-weight-kg"))).toBeCloseTo(
      69.9,
      1
    );
  });

  it("does not overwrite user-edited fields when a profile loads late and invalidates stale results when autofill updates any field", () => {
    profileHookState.profile = null;
    profileHookState.loaded = false;

    const { container, rerender } = render(<DoseCalculatorForm />);
    setValue(/calculatorForm.adultDose/, "500");
    setValue(/calculatorForm.childWeight/, "60");
    setValue(/calculatorForm.childAge/, "30");
    calculate();

    expect(renderedDose(container)).toContain("500");
    expect(screen.getByTestId("save-calc-snapshot")).toBeInTheDocument();

    profileHookState.profile = {
      weight_kg: 90,
      age_years: 50,
      height_cm: 180,
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

    expect(renderedDose(container)).toContain("500");

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
    expect(renderedDose(container)).toContain("500");
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
