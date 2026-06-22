"use client";

import { useState, useEffect } from "react";
import { Calculator, Info, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  DOSAGE_FORMULAS,
  type FormulaKey,
} from "@/lib/constants/dosage-formulas";
import {
  clarksRule,
  youngsRule,
  bsaMethod,
  friedsRule,
  lbsToKg,
  type DoseResult,
} from "@/lib/utils/dosage-calculations";
import { useTranslations } from "next-intl";
import {
  useDefaultPatientProfile,
  AutoFillBadge,
  SaveCalcButton,
} from "./profile-integration";

const unitOptions = ["mg", "ml", "g", "drops"] as const;

type PrefillData = {
  herbName: string;
  adultDose: string;
  doseUnit: "mg" | "ml" | "g" | "drops";
  dosageAdultRaw: string | null;
  dosageChildRaw: string | null;
  dosageForms: string[];
} | null;

const FORMULA_KEY_MAP: Record<FormulaKey, string> = {
  clarks_rule: "clarkRule",
  youngs_rule: "youngsRule",
  bsa: "salisburyRule",
  fried_rule: "cowlingRule",
};

const FORMULA_DESC_MAP: Record<FormulaKey, string> = {
  clarks_rule: "clarkDesc",
  youngs_rule: "youngDesc",
  bsa: "salisburyDesc",
  fried_rule: "cowlingDesc",
};

export function DoseCalculatorForm({ prefill }: { prefill?: PrefillData }) {
  const t = useTranslations();
  const [herbName, setHerbName] = useState(prefill?.herbName ?? "");
  const [adultDose, setAdultDose] = useState(prefill?.adultDose ?? "");
  const [doseUnit, setDoseUnit] = useState<(typeof unitOptions)[number]>(
    prefill?.doseUnit ?? "mg"
  );
  const [ageYears, setAgeYears] = useState("");
  const [useMonths, setUseMonths] = useState(false);
  const [ageMonths, setAgeMonths] = useState("");
  const [weightValue, setWeightValue] = useState("");
  const [useLbs, setUseLbs] = useState(false);
  const [heightCm, setHeightCm] = useState("");
  const [selectedFormula, setSelectedFormula] =
    useState<FormulaKey>("clarks_rule");
  const [result, setResult] = useState<DoseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoFilled, setAutoFilled] = useState(false);
  const { profile, loaded: profileLoaded } = useDefaultPatientProfile();

  /* eslint-disable */
  // Auto-fill from default patient profile when it loads
  useEffect(() => {
    if (profileLoaded && profile) {
      if (profile.weight_kg) {
        setWeightValue(String(profile.weight_kg));
        setAutoFilled(true);
      }
      if (profile.age_years) {
        setAgeYears(String(profile.age_years));
        setAutoFilled(true);
      }
      if (profile.height_cm) {
        setHeightCm(String(profile.height_cm));
        setAutoFilled(true);
      }
    }
  }, [profileLoaded, profile]);
  /* eslint-enable */

  function handleCalculate() {
    setError(null);
    setResult(null);

    const dose = parseFloat(adultDose);
    if (!dose || dose <= 0) {
      setError(t("calculator.errors.invalidDose"));
      return;
    }

    // `age` is in MONTHS when the months toggle is on, YEARS otherwise.
    const age = useMonths ? parseFloat(ageMonths) : parseFloat(ageYears);
    // Young's rule expects YEARS — convert months so an 18-month-old isn't
    // treated as an 18-year-old (≈5.5x overdose). Named ageInYears to avoid
    // shadowing the ageYears state variable.
    const ageInYears = useMonths && Number.isFinite(age) ? age / 12 : age;
    const rawWeight = parseFloat(weightValue);
    const weight = useLbs && rawWeight ? lbsToKg(rawWeight) : rawWeight;
    const height = parseFloat(heightCm);

    try {
      let calcResult: DoseResult;

      switch (selectedFormula) {
        case "clarks_rule":
          if (!weight || weight <= 0) {
            setError(t("calculator.errors.weightRequired"));
            return;
          }
          calcResult = clarksRule(weight, dose);
          break;
        case "youngs_rule":
          if (!ageInYears || ageInYears <= 0 || !Number.isFinite(ageInYears)) {
            setError(t("calculator.errors.ageRequired"));
            return;
          }
          calcResult = youngsRule(ageInYears, dose);
          break;
        case "bsa":
          if (!weight || weight <= 0 || !height || height <= 0) {
            setError(t("calculator.errors.bsaRequired"));
            return;
          }
          calcResult = bsaMethod(height, weight, dose);
          break;
        case "fried_rule":
          if (useMonths) {
            if (!age || age <= 0) {
              setError(t("calculator.errors.infantAge"));
              return;
            }
            calcResult = friedsRule(age, dose);
          } else {
            const months = parseFloat(ageYears) * 12;
            if (!months || months <= 0) {
              setError(t("calculator.errors.infantAge"));
              return;
            }
            calcResult = friedsRule(months, dose);
          }
          break;
        default:
          setError(t("calculator.errors.calculationError"));
          return;
      }

      calcResult.unit = doseUnit;
      setResult(calcResult);
    } catch {
      setError(t("calculator.errors.calculationError"));
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="size-5 text-primary" />
            {t("calculatorForm.calculatedDose")}
          </CardTitle>
          <CardDescription>{t("calculator.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Prefill Context Banner */}
          {prefill && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
              <div className="flex items-start gap-3">
                <Leaf className="mt-0.5 size-5 shrink-0 text-green-600" />
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-green-900 dark:text-green-100">
                    {t("calculatorForm.prefillContext", {
                      name: prefill.herbName,
                    })}
                  </p>
                  {prefill.dosageAdultRaw && (
                    <p className="text-green-700 dark:text-green-300">
                      {t("calculatorForm.standardAdultDose")}:{" "}
                      {prefill.dosageAdultRaw}
                    </p>
                  )}
                  {prefill.dosageChildRaw && (
                    <p className="text-green-700 dark:text-green-300">
                      {t("calculatorForm.referenceChildDose")}:{" "}
                      {prefill.dosageChildRaw}
                    </p>
                  )}
                  {prefill.dosageForms.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {prefill.dosageForms.map((form) => (
                        <Badge
                          key={form}
                          variant="secondary"
                          className="text-xs"
                        >
                          {form.replace("_", " ")}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Herb Name */}
          <div className="space-y-2">
            <Label htmlFor="herb-name">{t("calculatorForm.herbName")}</Label>
            <Input
              id="herb-name"
              placeholder={t("calculatorForm.herbNamePlaceholder")}
              value={herbName}
              onChange={(e) => setHerbName(e.target.value)}
            />
          </div>

          {/* Adult Dose + Unit */}
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="adult-dose">
                {t("calculatorForm.adultDose")}
              </Label>
              <Input
                id="adult-dose"
                type="number"
                min="0"
                step="any"
                placeholder={t("calculatorForm.selectHerb")}
                value={adultDose}
                onChange={(e) => setAdultDose(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label id="dose-unit-label">{t("calculatorForm.unit")}</Label>
              <div
                className="flex gap-1"
                role="radiogroup"
                aria-labelledby="dose-unit-label"
              >
                {unitOptions.map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    role="radio"
                    aria-checked={doseUnit === unit}
                    onClick={() => setDoseUnit(unit)}
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                      doseUnit === unit
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {unit}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <AutoFillBadge show={autoFilled} />

          {/* Age */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="patient-age">
                {t("calculatorForm.childAge")} (
                {useMonths
                  ? t("calculatorForm.months").toLowerCase()
                  : t("calculatorForm.years").toLowerCase()}
                )
              </Label>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  {t("calculatorForm.years")}
                </span>
                <Switch
                  checked={useMonths}
                  onCheckedChange={setUseMonths}
                  aria-label={t("calculatorForm.toggleAgeUnit")}
                />
                <span className="text-muted-foreground">
                  {t("calculatorForm.months")}
                </span>
              </div>
            </div>
            <Input
              id="patient-age"
              type="number"
              min="0"
              step="any"
              placeholder={useMonths ? "18" : "8"}
              value={useMonths ? ageMonths : ageYears}
              onChange={(e) =>
                useMonths
                  ? setAgeMonths(e.target.value)
                  : setAgeYears(e.target.value)
              }
            />
          </div>

          {/* Weight */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="patient-weight">
                {t("calculatorForm.childWeight")} ({useLbs ? "lbs" : "kg"})
              </Label>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">kg</span>
                <Switch
                  checked={useLbs}
                  onCheckedChange={setUseLbs}
                  aria-label={t("calculatorForm.toggleWeightUnit")}
                />
                <span className="text-muted-foreground">lbs</span>
              </div>
            </div>
            <Input
              id="patient-weight"
              type="number"
              min="0"
              step="any"
              placeholder="30"
              value={weightValue}
              onChange={(e) => setWeightValue(e.target.value)}
            />
          </div>

          {/* Height (optional, for BSA) */}
          <div className="space-y-2">
            <Label htmlFor="patient-height">
              {t("calculatorForm.heightCm")}
              <span className="text-muted-foreground">
                {" "}
                — {t("calculatorForm.optionalForBsa")}
              </span>
            </Label>
            <Input
              id="patient-height"
              type="number"
              min="0"
              step="any"
              placeholder="130"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
            />
          </div>

          {/* Formula Selection */}
          <div className="space-y-3">
            <Label id="formula-label">
              {t("calculatorForm.calculationFormula")}
            </Label>
            <div
              className="grid gap-3 sm:grid-cols-2"
              role="radiogroup"
              aria-labelledby="formula-label"
            >
              {(
                Object.entries(DOSAGE_FORMULAS) as [
                  FormulaKey,
                  (typeof DOSAGE_FORMULAS)[FormulaKey],
                ][]
              ).map(([key]) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={selectedFormula === key}
                  onClick={() => setSelectedFormula(key)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-all",
                    selectedFormula === key
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  )}
                >
                  <div className="text-sm font-medium text-foreground">
                    {t(`calculatorForm.${FORMULA_KEY_MAP[key]}`)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {t(`calculatorForm.${FORMULA_DESC_MAP[key]}`)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400"
            >
              {error}
            </div>
          )}

          {/* Calculate Button */}
          <Button onClick={handleCalculate} className="w-full" size="lg">
            <Calculator className="size-4" />
            {t("calculatorForm.calculate")}
          </Button>
        </CardContent>
      </Card>

      {/* Results Panel */}
      <div className="space-y-6">
        {result ? (
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-green-50 dark:to-green-950/20 animate-message-in">
            <CardHeader>
              <CardTitle className="text-primary">
                {t("calculatorForm.calculatedDose")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-4xl font-bold text-primary animate-count-up">
                  {result.dose}
                  <span className="ml-1 text-lg font-normal text-muted-foreground">
                    {result.unit}
                  </span>
                </div>
                {herbName && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("calculatorForm.forHerb", { name: herbName })}
                  </p>
                )}
              </div>

              {result.clamped && (
                <div
                  role="alert"
                  className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
                >
                  <Info className="mb-0.5 mr-1 inline-block size-3" />
                  {t("calculatorForm.clampedWarning")}
                </div>
              )}

              {/* Visual comparison bar */}
              {adultDose && (
                <div className="space-y-2 rounded-lg bg-background/80 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("calculatorForm.doseComparison")}
                  </p>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">
                          {t("calculatorForm.adultDose")}
                        </span>
                        <span className="font-medium">
                          {adultDose} {doseUnit}
                        </span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary/30 animate-grow-bar"
                          style={{ width: "100%" }}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">
                          {t("calculatorForm.calculatedDose")}
                        </span>
                        <span className="font-medium text-primary">
                          {result.dose} {result.unit}
                        </span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary animate-grow-bar"
                          style={{
                            width: `${Math.min((parseFloat(String(result.dose)) / parseFloat(adultDose)) * 100, 100)}%`,
                            animationDelay: "0.2s",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3 rounded-lg bg-background/80 p-4">
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("calculatorForm.formulaUsed")}
                  </span>
                  <p className="mt-0.5 font-mono text-sm text-foreground">
                    {result.formula}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("calculatorForm.explanation")}
                  </span>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {result.explanation}
                  </p>
                </div>
              </div>

              <SaveCalcButton
                result={result}
                herbName={herbName}
                adultDose={adultDose}
                doseUnit={doseUnit}
                weightValue={weightValue}
                ageYears={ageYears}
                heightCm={heightCm}
                selectedFormula={selectedFormula}
              />

              <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                <Info className="mb-0.5 mr-1 inline-block size-3" />
                {t("calculatorForm.disclaimer")}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Calculator className="mb-3 size-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                {t("calculatorForm.enterDetailsPrompt")}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Formula Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t(`calculatorForm.${FORMULA_KEY_MAP[selectedFormula]}`)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>{t(`calculatorForm.${FORMULA_DESC_MAP[selectedFormula]}`)}</p>
            <p className="font-mono text-xs">
              {DOSAGE_FORMULAS[selectedFormula].formula}
            </p>
            <Badge variant="secondary">
              {t(`calculatorForm.${FORMULA_DESC_MAP[selectedFormula]}`)}
            </Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
