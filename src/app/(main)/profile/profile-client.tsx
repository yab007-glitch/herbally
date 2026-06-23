"use client";

import { useState, useEffect, useCallback } from "react";
import { User, Plus, Trash2, Heart, Pill, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import {
  getPatientProfiles,
  savePatientProfile,
  updatePatientProfile,
  deletePatientProfile,
  getHealthProfile,
  saveHealthProfile,
  getUserMedications,
  addMedication,
  removeMedication,
  getDosageHistory,
} from "@/lib/actions/profile";

type PatientProfile = {
  id: string;
  name: string;
  relationship: string;
  weight_kg: number | null;
  age_years: number | null;
  age_months: number | null;
  height_cm: number | null;
  is_default: boolean | null;
  notes: string | null;
};

type Medication = {
  id: string;
  drug_name: string;
  dosage: string | null;
  frequency: string | null;
  is_active: boolean | null;
};

type DosageCalc = {
  id: string;
  adult_dose: string;
  calculated_dose: string;
  formula_used: string;
  patient_weight_kg: number | null;
  patient_age: number | null;
  herb_id: string | null;
  created_at: string;
};

export function ProfileClient() {
  const t = useTranslations();
  const locale = useLocale();
  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [calculations, setCalculations] = useState<DosageCalc[]>([]);
  const [conditions, setConditions] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [showAddMed, setShowAddMed] = useState(false);
  const [newCondition, setNewCondition] = useState("");
  const [newAllergy, setNewAllergy] = useState("");

  // New patient form state
  const [pName, setPName] = useState("");
  const [pRel, setPRel] = useState("self");
  const [pWeight, setPWeight] = useState("");
  const [pAge, setPAge] = useState("");
  const [pHeight, setPHeight] = useState("");
  const [pNotes, setPNotes] = useState("");

  // New medication form state
  const [medName, setMedName] = useState("");
  const [medDosage, setMedDosage] = useState("");
  const [medFreq, setMedFreq] = useState("");

  const loadAll = useCallback(async () => {
    const [p, h, m, d] = await Promise.all([
      getPatientProfiles(),
      getHealthProfile(),
      getUserMedications(),
      getDosageHistory(),
    ]);
    if (p.success && p.data) setPatients(p.data);
    if (h.success && h.data) {
      setConditions(h.data.conditions ?? []);
      setAllergies(h.data.allergies ?? []);
    }
    if (m.success && m.data) setMedications(m.data);
    if (d.success && d.data) setCalculations(d.data);
    setLoading(false);
  }, []);

  /* eslint-disable */
  useEffect(() => {
    loadAll();
  }, [loadAll]);
  /* eslint-enable */

  async function handleAddPatient() {
    if (!pName.trim()) return;
    const result = await savePatientProfile({
      name: pName,
      relationship: pRel,
      weight_kg: pWeight ? parseFloat(pWeight) : null,
      age_years: pAge ? parseFloat(pAge) : null,
      age_months: null,
      height_cm: pHeight ? parseFloat(pHeight) : null,
      is_default: patients.length === 0, // First patient is default
      notes: pNotes || null,
    });
    if (result.success) {
      toast.success(t("profile.profileSaved"));
      setShowAddPatient(false);
      setPName("");
      setPRel("self");
      setPWeight("");
      setPAge("");
      setPHeight("");
      setPNotes("");
      loadAll();
    } else if (!result.success && result.error) {
      toast.error(result.error);
    }
  }

  async function handleSetDefault(id: string) {
    await updatePatientProfile(id, { is_default: true });
    loadAll();
  }

  async function handleDeletePatient(id: string) {
    await deletePatientProfile(id);
    loadAll();
  }

  async function handleAddCondition() {
    const trimmed = newCondition.trim();
    if (!trimmed) return;
    // Dedupe case-insensitively so the badge list stays unique and the value
    // can be used as a stable React key (audit frontend Low: array-index keys).
    if (conditions.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setNewCondition("");
      return;
    }
    const updated = [...conditions, trimmed];
    setConditions(updated);
    setNewCondition("");
    await saveHealthProfile({
      conditions: updated,
      allergies,
    });
  }

  async function handleAddAllergy() {
    const trimmed = newAllergy.trim();
    if (!trimmed) return;
    if (allergies.some((a) => a.toLowerCase() === trimmed.toLowerCase())) {
      setNewAllergy("");
      return;
    }
    const updated = [...allergies, trimmed];
    setAllergies(updated);
    setNewAllergy("");
    await saveHealthProfile({
      conditions,
      allergies: updated,
    });
  }

  async function handleRemoveCondition(idx: number) {
    const updated = conditions.filter((_, i) => i !== idx);
    setConditions(updated);
    await saveHealthProfile({
      conditions: updated,
      allergies,
    });
  }

  async function handleRemoveAllergy(idx: number) {
    const updated = allergies.filter((_, i) => i !== idx);
    setAllergies(updated);
    await saveHealthProfile({
      conditions,
      allergies: updated,
    });
  }

  async function handleAddMedication() {
    if (!medName.trim()) return;
    const result = await addMedication({
      drug_name: medName,
      dosage: medDosage || null,
      frequency: medFreq || null,
      rxcui: null,
      notes: null,
    });
    if (result.success) {
      toast.success(t("profile.medicationAdded"));
      setShowAddMed(false);
      setMedName("");
      setMedDosage("");
      setMedFreq("");
      loadAll();
    } else if (!result.success && result.error) {
      toast.error(result.error);
    }
  }

  async function handleRemoveMedication(id: string) {
    const result = await removeMedication(id);
    if (result.success) {
      toast.success(t("profile.medicationRemoved"));
      loadAll();
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-2xl bg-muted" />
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Patient Profiles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="size-5 text-primary" />
            {t("profile.patientProfiles")}
          </CardTitle>
          <CardDescription>{t("profile.patientProfilesDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {patients.length === 0 && !showAddPatient && (
            <p className="text-sm text-muted-foreground">
              {t("profile.noProfiles")}
            </p>
          )}
          {patients.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.name}</span>
                    {p.is_default && (
                      <Badge variant="secondary">
                        {t("profile.defaultPatient")}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("profile.relationship")}:{" "}
                    {t(`profile.${p.relationship}`)}
                    {p.weight_kg && ` · ${p.weight_kg} kg`}
                    {p.age_years && ` · ${p.age_years} yrs`}
                    {p.height_cm && ` · ${p.height_cm} cm`}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {!p.is_default && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleSetDefault(p.id)}
                  >
                    {t("profile.setDefault")}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeletePatient(p.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
          {showAddPatient && (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="pf-name">{t("profile.name")}</Label>
                  <Input
                    id="pf-name"
                    value={pName}
                    onChange={(e) => setPName(e.target.value)}
                    placeholder="Jane Doe"
                  />
                </div>
                <div>
                  <Label htmlFor="pf-rel">{t("profile.relationship")}</Label>
                  <select
                    id="pf-rel"
                    value={pRel}
                    onChange={(e) => setPRel(e.target.value)}
                    className="h-9 w-full rounded-lg border bg-transparent px-3 text-sm"
                  >
                    <option value="self">{t("profile.self")}</option>
                    <option value="child">{t("profile.child")}</option>
                    <option value="partner">{t("profile.partner")}</option>
                    <option value="parent">{t("profile.parent")}</option>
                    <option value="other">{t("profile.other")}</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="pf-weight">{t("profile.weightKg")}</Label>
                  <Input
                    id="pf-weight"
                    type="number"
                    value={pWeight}
                    onChange={(e) => setPWeight(e.target.value)}
                    placeholder="70"
                  />
                </div>
                <div>
                  <Label htmlFor="pf-age">{t("profile.ageYears")}</Label>
                  <Input
                    id="pf-age"
                    type="number"
                    value={pAge}
                    onChange={(e) => setPAge(e.target.value)}
                    placeholder="35"
                  />
                </div>
                <div>
                  <Label htmlFor="pf-height">{t("profile.heightCm")}</Label>
                  <Input
                    id="pf-height"
                    type="number"
                    value={pHeight}
                    onChange={(e) => setPHeight(e.target.value)}
                    placeholder="170"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddPatient}>
                  {t("profile.save")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddPatient(false)}
                >
                  {t("profile.cancel")}
                </Button>
              </div>
            </div>
          )}
          {!showAddPatient && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddPatient(true)}
            >
              <Plus className="size-4 mr-1" />
              {t("profile.addPatient")}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Health Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="size-5 text-destructive" />
            {t("profile.healthProfile")}
          </CardTitle>
          <CardDescription>{t("profile.healthProfileDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="pf-condition" className="mb-2 block">
              {t("profile.conditions")}
            </Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {conditions.map((c, i) => (
                <Badge
                  key={c}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => handleRemoveCondition(i)}
                >
                  {c} ×
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                id="pf-condition"
                value={newCondition}
                onChange={(e) => setNewCondition(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddCondition()}
                placeholder={t("profile.addCondition")}
                className="h-8"
              />
              <Button size="sm" variant="outline" onClick={handleAddCondition}>
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="pf-allergy" className="mb-2 block">
              {t("profile.allergies")}
            </Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {allergies.map((a, i) => (
                <Badge
                  key={a}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => handleRemoveAllergy(i)}
                >
                  {a} ×
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                id="pf-allergy"
                value={newAllergy}
                onChange={(e) => setNewAllergy(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddAllergy()}
                placeholder={t("profile.addAllergy")}
                className="h-8"
              />
              <Button size="sm" variant="outline" onClick={handleAddAllergy}>
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Medications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pill className="size-5 text-primary" />
            {t("profile.medications")}
          </CardTitle>
          <CardDescription>{t("profile.medicationsDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {medications.length === 0 && !showAddMed && (
            <p className="text-sm text-muted-foreground">
              {t("profile.noMedications")}
            </p>
          )}
          {medications.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div>
                <p className="font-medium">{m.drug_name}</p>
                <p className="text-xs text-muted-foreground">
                  {m.dosage && `${m.dosage}`}
                  {m.dosage && m.frequency && " · "}
                  {m.frequency && `${m.frequency}`}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleRemoveMedication(m.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          {showAddMed && (
            <div className="space-y-3 rounded-lg border p-4">
              <div>
                <Label htmlFor="pf-drug-name">{t("profile.drugName")}</Label>
                <Input
                  id="pf-drug-name"
                  value={medName}
                  onChange={(e) => setMedName(e.target.value)}
                  placeholder="Warfarin"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="pf-dosage">{t("profile.dosage")}</Label>
                  <Input
                    id="pf-dosage"
                    value={medDosage}
                    onChange={(e) => setMedDosage(e.target.value)}
                    placeholder="5mg"
                  />
                </div>
                <div>
                  <Label htmlFor="pf-frequency">{t("profile.frequency")}</Label>
                  <Input
                    id="pf-frequency"
                    value={medFreq}
                    onChange={(e) => setMedFreq(e.target.value)}
                    placeholder="Once daily"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddMedication}>
                  {t("profile.save")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddMed(false)}
                >
                  {t("profile.cancel")}
                </Button>
              </div>
            </div>
          )}
          {!showAddMed && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddMed(true)}
            >
              <Plus className="size-4 mr-1" />
              {t("profile.addMedication")}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Dosage History */}
      {calculations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="size-5 text-primary" />
              {t("profile.dosageHistory")}
            </CardTitle>
            <CardDescription>{t("profile.dosageHistoryDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {calculations.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{c.calculated_dose}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.formula_used}
                      {c.patient_weight_kg && ` · ${c.patient_weight_kg} kg`}
                      {c.patient_age != null && ` · ${c.patient_age} yrs`}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString(
                      locale === "fr" ? "fr-FR" : "en-US"
                    )}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
