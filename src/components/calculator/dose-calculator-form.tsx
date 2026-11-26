"use client";

import { useState, useEffect, useRef } from "react";
import { Calculator, Info, Leaf } from "lucide-react";
import { AlertTriangle } from "lucide-react";
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
  buildAdultReferenceDose,
  lbsToKg,
  type DoseResult,
} from "@/lib/utils/dosage-calculations";
import {
  assessDoseEligibility,
  MAX_ADULT_WEIGHT_KG,
  MIN_ADULT_WEIGHT_KG,
  MINIMUM_DOSE_AGE_YEARS,
} from "@/lib/utils/dosage-safety";
import {
  matchCalculatorBlockedInput,
  type DangerousHerb,
} from "@/lib/data/dangerous-herbs";
import { useLocale, useTranslations } from "next-intl";
import {
  useDefaultPatientProfile,
  AutoFillBadge,
  SaveCalcButton,
} from "./profile-integration";
import { PrintSafetyFooter } from "@/components/shared/print-safety-footer";

const unitOptions = ["mg", "ml", "g", "drops"] as const;

type PrefillData = {
  herbName: string;
  adultDose: string;
  doseUnit: "mg" | "ml" | "g" | "drops";
  dosageAdultRaw: string | null;
  dosageRange: {
    low: number;
    high: number;
    unit: "mg" | "ml" | "g" | "drops";
  } | null;
  dosageForms: string[];
  verified: boolean;
} | null;

type SafetyBlockState =
  | { type: "dangerous_herb"; slug: string; entry: DangerousHerb }
  | { type: "non_dosable"; slug: string }
  | { type: "pediatric_unavailable"; ageYears: number }
  | { type: "age_unverified" }
  | null;

interface CalculationSnapshot {
  id: number;
  result: DoseResult;
  herbName: string;
  adultDose: string;
  doseUnit: (typeof unitOptions)[number];
  weightKg: number | null;
  ageYears: number | null;
  heightCm: number | null;
  formula: FormulaKey;
}

export function DoseCalculatorForm({ prefill }: { prefill?: PrefillData }) {
  const t = useTranslations();
  const locale = useLocale();
  const unitLabel = (u: string) =>
    u === "drops" ? t("calculatorForm.drops") : u;
  const [herbName, setHerbName] = useState(prefill?.herbName ?? "");
  const [adultDose, setAdultDose] = useState(prefill?.adultDose ?? "");
  const [doseUnit, setDoseUnit] = useState<(typeof unitOptions)[number]>(
    prefill?.doseUnit ?? "mg"
  );
  const [ageYears, setAgeYears] = useState("");
  const [weightValue, setWeightValue] = useState("");
  const [useLbs, setUseLbs] = useState(false);
  const selectedFormula: FormulaKey = "adult_reference";
  const [snapshot, setSnapshot] = useState<CalculationSnapshot | null>(null);
  const snapshotSeqRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  /** Set when dangerous/non-dosable herb or age gate blocks calculation. */
  const [safetyBlock, setSafetyBlock] = useState<SafetyBlockState>(null);
  const [autoFilled, setAutoFilled] = useState(false);
  const { profile, loaded: profileLoaded } = useDefaultPatientProfile();
  const dirtyFieldsRef = useRef({ weight: false, age: false });
  const appliedProfileRef = useRef(false);

  const liveBlockedHerb = matchCalculatorBlockedInput(herbName);

  function invalidateCalculation() {
    setSnapshot(null);
    setSafetyBlock(null);
    setError(null);
  }

  useEffect(() => {
    if (!profileLoaded || !profile || appliedProfileRef.current) return;
    appliedProfileRef.current = true;

    let changed = false;
    if (profile.weight_kg && !dirtyFieldsRef.current.weight) {
      setWeightValue(String(profile.weight_kg));
      changed = true;
    }
    if (profile.age_years && !dirtyFieldsRef.current.age) {
      setAgeYears(String(profile.age_years));
      changed = true;
    }

    if (changed) {
      setAutoFilled(true);
      setSnapshot(null);
      setSafetyBlock(null);
      setError(null);
    }
  }, [profileLoaded, profile]);

  function handleCalculate() {
    setError(null);
    setSnapshot(null);
    setSafetyBlock(null);

    // 1) Hazard precedence: block dangerous or non-dosable free-text herbs
    // before age or adult-dose checks so toxic plants never get a benign error.
    const blockedHerb = matchCalculatorBlockedInput(herbName);
    if (blockedHerb) {
      if (blockedHerb.kind === "dangerous") {
        setSafetyBlock({
          type: "dangerous_herb",
          slug: blockedHerb.slug,
          entry: blockedHerb.entry,
        });
      } else {
        setSafetyBlock({ type: "non_dosable", slug: blockedHerb.slug });
      }
      return;
    }

    // 2) Age gate BEFORE adult-dose validation: newborn/infant (0), minor (<18),
    // and unverified/unknown/out-of-range ages all fail closed distinctly.
    const trimmedAge = ageYears.trim();
    const parsedAge = trimmedAge === "" ? null : Number(trimmedAge);
    const eligibility = assessDoseEligibility(parsedAge);
    if (eligibility.status === "pediatric_unavailable") {
      setSafetyBlock({
        type: "pediatric_unavailable",
        ageYears: eligibility.ageYears,
      });
      return;
    }
    if (eligibility.status === "age_unverified") {
      setSafetyBlock({ type: "age_unverified" });
      return;
    }

    // 3) Validate positive finite adult reference dose
    const dose = parseFloat(adultDose);
    if (!Number.isFinite(dose) || dose <= 0) {
      setError(t("calculator.errors.invalidDose"));
      return;
    }

    // 4) Optional adult weight plausibility check (20..350 kg)
    const trimmedWeight = weightValue.trim();
    let weight: number | null = null;
    if (trimmedWeight !== "") {
      const rawWeight = Number(trimmedWeight);
      const converted = useLbs ? lbsToKg(rawWeight) : rawWeight;
      if (
        !Number.isFinite(converted) ||
        converted < MIN_ADULT_WEIGHT_KG ||
        converted > MAX_ADULT_WEIGHT_KG
      ) {
        setError(t("calculator.errors.invalidAdultWeight"));
        return;
      }
      weight = converted;
    }

    try {
      const calcResult = buildAdultReferenceDose({
        adultDose: dose,
        unit: doseUnit,
        ageYears: eligibility.ageYears,
        weightKg: weight,
        heightCm: null,
      });

      snapshotSeqRef.current += 1;
      setSnapshot({
        id: snapshotSeqRef.current,
        result: calcResult,
        herbName,
        adultDose,
        doseUnit,
        weightKg: weight,
        ageYears: eligibility.ageYears,
        heightCm: null,
        formula: selectedFormula,
      });
    } catch {
      setError(t("calculator.errors.calculationError"));
    }
  }

  const showPlausibilityNote =
    !!snapshot && snapshot.weightKg !== null && snapshot.weightKg > 250;

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
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCalculate();
            }}
            className="space-y-6"
          >
            {/* Adult-only notice — shown before any field is filled, so the
                under-18 block is never a surprise after the user has done
                the work. The calculator refuses anyone under 18. */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm font-medium text-foreground">
                {t("calculatorForm.adultOnlyNotice")}
              </p>
            </div>

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
                    {prefill.verified && prefill.dosageAdultRaw && (
                      <p className="text-green-700 dark:text-green-300">
                        {t("calculatorForm.standardAdultDose")}:{" "}
                        {prefill.dosageAdultRaw}
                      </p>
                    )}

                    {prefill.dosageForms.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <div className="flex flex-wrap gap-1">
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
                        <p className="text-xs text-green-800 dark:text-green-200">
                          {t("calculatorForm.preparationNotInterchangeable")}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Standard adult range picker — suppressed whenever any safety block
                or blocked herb input is active so blocked displays never appear
                alongside clickable adult dose suggestions. */}
            {prefill?.dosageRange && !safetyBlock && !liveBlockedHerb && (
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium text-foreground">
                  {t("calculatorForm.rangePickerTitle")}
                </p>
                {prefill.dosageAdultRaw && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("calculatorForm.standardAdultDose")}:{" "}
                    {prefill.dosageAdultRaw}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {(
                    [
                      ["low", prefill.dosageRange.low],
                      [
                        "middle",
                        (prefill.dosageRange.low + prefill.dosageRange.high) /
                          2,
                      ],
                      ["high", prefill.dosageRange.high],
                    ] as const
                  ).map(([key, value]) => (
                    <Button
                      key={key}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAdultDose(String(value));
                        setDoseUnit(prefill.dosageRange!.unit);
                        invalidateCalculation();
                      }}
                    >
                      {t(
                        `calculatorForm.range${key === "low" ? "Low" : key === "middle" ? "Middle" : "High"}`
                      )}{" "}
                      {value} {unitLabel(prefill.dosageRange!.unit)}
                    </Button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("calculatorForm.rangePickerNote")}
                </p>
              </div>
            )}

            {/* Unverified-source notice — do not present AI dosages as reference doses */}
            {prefill && !prefill.verified && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
                  <div className="space-y-1 text-sm text-amber-900 dark:text-amber-100">
                    <p>{t("calculatorForm.unverifiedHerbNotice")}</p>
                    {/* Unverified stated range, shown as information only:
                      the dose field stays blank and no range picker is
                      offered for unverified herbs, so nothing here is
                      presented as a validated reference dose or a
                      recommendation. The user must enter a dose explicitly. */}
                    {prefill.dosageAdultRaw && (
                      <p>
                        {t("calculatorForm.unverifiedStatedRange", {
                          dose: prefill.dosageAdultRaw,
                        })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Herb Name */}
            <div className="space-y-2">
              <Label htmlFor="herb-name">{t("calculatorForm.herbName")}</Label>
              <Input
                className="h-11"
                id="herb-name"
                placeholder={t("calculatorForm.herbNamePlaceholder")}
                value={herbName}
                onChange={(e) => {
                  setHerbName(e.target.value);
                  invalidateCalculation();
                }}
              />
            </div>

            {/* Adult Dose + Unit */}
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <Label htmlFor="adult-dose">
                  {t("calculatorForm.adultDose")}
                </Label>
                <Input
                  className="h-11"
                  id="adult-dose"
                  type="number"
                  min="0"
                  step="any"
                  placeholder={t("calculatorForm.adultDosePlaceholder")}
                  value={adultDose}
                  onChange={(e) => {
                    setAdultDose(e.target.value);
                    invalidateCalculation();
                  }}
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
                      onClick={() => {
                        setDoseUnit(unit);
                        invalidateCalculation();
                      }}
                      className={cn(
                        "min-h-11 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                        doseUnit === unit
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {unitLabel(unit)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <AutoFillBadge show={autoFilled} />

            {/* Age (years only — pediatric/months unit removed) */}
            <div className="space-y-2">
              <Label htmlFor="patient-age">
                {t("calculatorForm.childAge")} (
                {t("calculatorForm.years").toLowerCase()})
              </Label>
              <Input
                className="h-11"
                id="patient-age"
                type="number"
                min="0"
                step="any"
                placeholder="e.g. 30"
                value={ageYears}
                onChange={(e) => {
                  dirtyFieldsRef.current.age = true;
                  setAgeYears(e.target.value);
                  invalidateCalculation();
                }}
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
                    onCheckedChange={(checked) => {
                      dirtyFieldsRef.current.weight = true;
                      setUseLbs(checked);
                      invalidateCalculation();
                    }}
                    aria-label={t("calculatorForm.toggleWeightUnit")}
                  />
                  <span className="text-muted-foreground">lbs</span>
                </div>
              </div>
              <Input
                className="h-11"
                id="patient-weight"
                type="number"
                min="0"
                step="any"
                placeholder={useLbs ? "e.g. 155" : "e.g. 70"}
                value={weightValue}
                onChange={(e) => {
                  dirtyFieldsRef.current.weight = true;
                  setWeightValue(e.target.value);
                  invalidateCalculation();
                }}
              />
            </div>

            {/* Adult Reference Scope (replaces legacy weight/age scaling radios) */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <div className="font-medium text-foreground">
                {t("calculatorForm.adultReferenceTitle")}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("calculatorForm.adultReferenceDesc")}
              </p>
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
            <Button type="submit" className="w-full" size="lg">
              <Calculator className="size-4" />
              {t("calculatorForm.calculate")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Results Panel */}
      <div className="space-y-6">
        {safetyBlock ? (
          safetyBlock.type === "dangerous_herb" ? (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="size-5 shrink-0" />
                  {t("calculatorForm.dangerousHerbBlockedTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div
                  role="alert"
                  aria-live="polite"
                  className="text-sm leading-relaxed text-foreground"
                >
                  {locale === "fr"
                    ? safetyBlock.entry.reasonFr
                    : safetyBlock.entry.reason}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("calculatorForm.dangerousHerbBlockedFooter")}
                </p>
              </CardContent>
            </Card>
          ) : safetyBlock.type === "non_dosable" ? (
            <Card className="border-amber-300 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
                  <AlertTriangle className="size-5 shrink-0" />
                  {t("calculatorForm.nonDosableHerbBlockedTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  role="alert"
                  aria-live="polite"
                  className="text-sm leading-relaxed text-amber-900 dark:text-amber-100"
                >
                  {t("calculatorForm.nonDosableHerbBlockedDesc")}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-amber-300 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
                  <AlertTriangle className="size-5 shrink-0" />
                  {safetyBlock.type === "pediatric_unavailable"
                    ? t("calculatorForm.pediatricDoseBlockedTitle")
                    : t("calculatorForm.ageUnverifiedTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  role="alert"
                  aria-live="polite"
                  className="text-sm leading-relaxed text-amber-900 dark:text-amber-100"
                >
                  {safetyBlock.type === "pediatric_unavailable"
                    ? t("calculatorForm.pediatricDoseBlocked", {
                        age: MINIMUM_DOSE_AGE_YEARS,
                      })
                    : t("calculatorForm.ageRequiredForAdultDose", {
                        age: MINIMUM_DOSE_AGE_YEARS,
                      })}
                </div>
                <div className="rounded-lg bg-background/80 px-3 py-2 text-xs text-muted-foreground">
                  <Info className="mb-0.5 mr-1 inline-block size-3" />
                  {t("calculatorForm.pediatricDoseBlockedRationale")}
                </div>
              </CardContent>
            </Card>
          )
        ) : snapshot ? (
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-green-50 dark:to-green-950/20 animate-message-in">
            <CardHeader>
              <CardTitle className="text-primary">
                {t("calculatorForm.calculatedDose")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-4xl font-bold text-primary animate-count-up">
                  {snapshot.result.dose > 0 && snapshot.result.dose < 0.1
                    ? "<0.1"
                    : snapshot.result.dose}
                  <span className="ml-1 text-lg font-normal text-muted-foreground">
                    {unitLabel(snapshot.result.unit)}
                  </span>
                </div>
                {snapshot.herbName && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("calculatorForm.forHerb", { name: snapshot.herbName })}
                  </p>
                )}
              </div>

              {showPlausibilityNote && (
                <div
                  role="status"
                  className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
                >
                  <Info className="mb-0.5 mr-1 inline-block size-3" />
                  {t("calculatorForm.plausibilityWarning")}
                </div>
              )}

              <div className="space-y-3 rounded-lg bg-background/80 p-4">
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("calculatorForm.formulaUsed")}
                  </span>
                  <p className="mt-0.5 font-mono text-sm text-foreground">
                    {snapshot.result.formula}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("calculatorForm.explanation")}
                  </span>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {t(
                      `calculatorForm.explanations.${snapshot.result.explanationKey}`,
                      snapshot.result.explanationParams
                    )}
                  </p>
                </div>
              </div>

              <SaveCalcButton
                key={snapshot.id}
                result={snapshot.result}
                herbName={snapshot.herbName}
                adultDose={snapshot.adultDose}
                doseUnit={snapshot.doseUnit}
                weightValue={
                  snapshot.weightKg !== null ? String(snapshot.weightKg) : ""
                }
                weightUnit="kg"
                ageYears={
                  snapshot.ageYears !== null ? String(snapshot.ageYears) : ""
                }
                heightCm={
                  snapshot.heightCm !== null ? String(snapshot.heightCm) : ""
                }
                selectedFormula={snapshot.formula}
              />

              <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                <Info className="mb-0.5 mr-1 inline-block size-3" />
                {t("calculatorForm.disclaimer")}
              </div>
              <div className="print-only">
                <PrintSafetyFooter
                  locale={locale === "fr" ? "fr" : "en"}
                  adultAgeYears={snapshot.ageYears}
                />
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
              {t("calculatorForm.adultReferenceTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>{t("calculatorForm.adultReferenceDesc")}</p>
            <p className="font-mono text-xs">
              {DOSAGE_FORMULAS.adult_reference.formula}
            </p>
            <Badge variant="secondary">
              {t("calculatorForm.adultReferenceBadge")}
            </Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
