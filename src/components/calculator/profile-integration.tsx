"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { isAdultDosingEligibleProfile } from "@/lib/utils/dosage-safety";
import { lbsToKg } from "@/lib/utils/dosage-calculations";

/**
 * Hook that loads an eligible adult (18+, non-child, non-months) patient
 * profile and provides auto-fill data for the adult reference checker.
 * Returns null for guests, child profiles, age_months profiles, or profiles
 * without a confirmed adult age.
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
          const eligibleProfiles = result.data.filter((p) =>
            isAdultDosingEligibleProfile(p)
          );
          const selectedProfile =
            eligibleProfiles.find((p) => p.is_default) || eligibleProfiles[0];
          if (selectedProfile) {
            setProfile({
              weight_kg: selectedProfile.weight_kg,
              age_years: selectedProfile.age_years,
              height_cm: selectedProfile.height_cm,
            });
          } else {
            setProfile(null);
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
  weightUnit = "kg",
  ageYears,
  heightCm,
  selectedFormula,
}: {
  result: DoseResult | null;
  herbName: string;
  adultDose: string;
  doseUnit: string;
  weightValue: string;
  weightUnit?: "kg" | "lbs";
  ageYears: string;
  heightCm: string;
  selectedFormula: string;
}) {
  const t = useTranslations();
  const [consentChecked, setConsentChecked] = useState(false);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const snapshotKey = [
    herbName,
    adultDose,
    doseUnit,
    weightValue,
    weightUnit,
    ageYears,
    heightCm,
    selectedFormula,
    result?.dose ?? "",
    result?.unit ?? "",
  ].join("|");
  const activeSnapshotKeyRef = useRef(snapshotKey);

  const saved = savedKey === snapshotKey;
  const isSaving = savingKey === snapshotKey;

  useEffect(() => {
    activeSnapshotKeyRef.current = snapshotKey;
    inFlightRef.current = false;
  }, [snapshotKey]);

  async function handleSave() {
    if (!result || !herbName || !consentChecked || inFlightRef.current || saved)
      return;
    if (selectedFormula !== "adult_reference") return;

    const rawWeight = weightValue ? parseFloat(weightValue) : null;
    const weightKg =
      rawWeight !== null && Number.isFinite(rawWeight)
        ? weightUnit === "lbs"
          ? lbsToKg(rawWeight)
          : rawWeight
        : null;

    const requestKey = snapshotKey;
    inFlightRef.current = true;
    setSavingKey(requestKey);
    try {
      const { saveDosageCalculation } = await import("@/lib/actions/profile");
      const res = await saveDosageCalculation({
        adult_dose: `${adultDose} ${doseUnit}`,
        calculated_dose: `${result.dose} ${result.unit}`,
        formula_used: "adult_reference",
        patient_weight_kg: weightKg,
        patient_age: ageYears ? parseFloat(ageYears) : null,
        patient_height_cm: heightCm ? parseFloat(heightCm) : null,
        patient_bsa: null,
        herb_id: null,
        notes: herbName,
        health_data_consent: true,
      });

      if (activeSnapshotKeyRef.current !== requestKey) {
        return;
      }

      if (res.success && res.data?.skipped) {
        toast.info(t("profile.signInToSave") || "Sign in to save calculations");
      } else if (res.success) {
        setSavedKey(requestKey);
        toast.success(t("profile.calculationSaved"));
      } else {
        toast.error(res.error || "Could not save calculation");
      }
    } catch {
      if (activeSnapshotKeyRef.current === requestKey) {
        toast.error("Could not save calculation");
      }
    } finally {
      inFlightRef.current = false;
      setSavingKey((prev) => (prev === requestKey ? null : prev));
    }
  }

  if (!result || !herbName) return null;

  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          data-testid="save-history-consent"
          checked={consentChecked}
          onChange={(e) => setConsentChecked(e.target.checked)}
          className="mt-0.5 size-3.5 rounded border-border"
        />
        <span>
          {t("profile.saveConsent") ||
            "I consent to store this adult reference calculation (18+)"}
        </span>
      </label>
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={handleSave}
        disabled={!consentChecked || saved || isSaving}
        aria-label={
          saved ? t("profile.calculationSaved") : t("profile.saveCalculation")
        }
      >
        <Save className="size-4 mr-1" />
        {saved
          ? `✓ ${t("profile.calculationSaved")}`
          : t("profile.saveCalculation")}
      </Button>
    </div>
  );
}
