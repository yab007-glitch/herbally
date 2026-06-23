"use client";

import { useEffect, useState } from "react";
import { Sparkles, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Hook that loads the user's default patient profile and provides
 * auto-fill data for the dose calculator. Returns null for guests
 * or users without a profile.
 */
export function useDefaultPatientProfile() {
  const [profile, setProfile] = useState<{
    weight_kg: number | null;
    age_years: number | null;
    height_cm: number | null;
  } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const { getPatientProfiles } = await import("@/lib/actions/profile");
        const result = await getPatientProfiles();
        if (result.success && result.data) {
          const defaultProfile =
            result.data.find((p) => p.is_default) || result.data[0];
          if (defaultProfile) {
            setProfile({
              weight_kg: defaultProfile.weight_kg,
              age_years: defaultProfile.age_years,
              height_cm: defaultProfile.height_cm,
            });
          }
        }
      } catch {
        // Not logged in or error — silently skip
      }
      setLoaded(true);
    }
    loadProfile();
  }, []);

  return { profile, loaded };
}

/**
 * Badge that shows when calculator fields are auto-filled from profile.
 */
export function AutoFillBadge({ show }: { show: boolean }) {
  const t = useTranslations();
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-primary">
      <Sparkles className="size-3" />
      {t("profile.autoFillNote")}
    </span>
  );
}
type DoseResult = {
  dose: number;
  unit: string;
  formula: string;
  explanation: string;
  clamped: boolean;
};

/**
 * Button that saves the current dosage calculation to the user's history.
 * Silently no-ops for guests (not logged in).
 */
export function SaveCalcButton({
  result,
  herbName,
  adultDose,
  doseUnit,
  weightValue,
  ageYears,
  heightCm,
  selectedFormula,
}: {
  result: DoseResult | null;
  herbName: string;
  adultDose: string;
  doseUnit: string;
  weightValue: string;
  ageYears: string;
  heightCm: string;
  selectedFormula: string;
}) {
  const t = useTranslations();
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!result || !herbName) return;
    try {
      const { saveDosageCalculation } = await import("@/lib/actions/profile");
      const res = await saveDosageCalculation({
        adult_dose: `${adultDose} ${doseUnit}`,
        calculated_dose: `${result.dose} ${result.unit}`,
        formula_used: selectedFormula as
          | "clarks_rule"
          | "youngs_rule"
          | "bsa"
          | "fried_rule",
        patient_weight_kg: weightValue ? parseFloat(weightValue) : null,
        patient_age: ageYears ? parseFloat(ageYears) : null,
        patient_height_cm: heightCm ? parseFloat(heightCm) : null,
        patient_bsa: null,
        herb_id: null,
        notes: herbName,
      });
      if (res.success && res.data?.skipped) {
        // Guest (not signed in) — calculation wasn't persisted. Surface this
        // distinctly instead of falsely reporting "saved".
        toast.info(t("profile.signInToSave") || "Sign in to save calculations");
      } else if (res.success) {
        setSaved(true);
        toast.success(t("profile.calculationSaved"));
      }
    } catch {
      // Not logged in or error — silently skip
    }
  }

  if (!result || !herbName) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full"
      onClick={handleSave}
      disabled={saved}
      aria-label={
        saved ? t("profile.calculationSaved") : t("profile.saveCalculation")
      }
    >
      <Save className="size-4 mr-1" />
      {saved ? "✓" : t("profile.calculationSaved")}
    </Button>
  );
}
