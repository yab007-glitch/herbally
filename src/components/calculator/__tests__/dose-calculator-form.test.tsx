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
  useTranslations: () => (key: string) => key,
}));

// The profile integration hook performs a dynamic server-action import in an
// effect. Stub it so the form test stays isolated from Supabase/auth.
vi.mock("../profile-integration", () => ({
  useDefaultPatientProfile: () => ({ profile: null, loaded: true }),
  AutoFillBadge: () => null,
  SaveCalcButton: () => null,
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
