"use client";

import { useMemo, useState } from "react";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { useLocale } from "next-intl";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Plus,
  Printer,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SURGERY_HERB_RULES,
  buildSurgeryWashoutPlan,
  type WashoutCategory,
} from "@/lib/interactions/surgery-washout";

function defaultSurgeryDateIso(): string {
  const dt = new Date(Date.now() + 21 * 86_400_000);
  return dt.toISOString().slice(0, 10);
}

function categoryLabel(cat: WashoutCategory, fr: boolean): string {
  if (fr) {
    switch (cat) {
      case "bleeding":
        return "Risque hémorragique";
      case "sedation":
        return "Sédation / anesthésie";
      case "metabolism":
        return "Enzymes CYP450 / P-gp";
      case "cardiovascular":
        return "Pression artérielle / cœur";
      case "glycemic":
        return "Glycémie / jeûne opératoire";
    }
  }
  switch (cat) {
    case "bleeding":
      return "Bleeding risk";
    case "sedation":
      return "Anesthesia / sedation overlap";
    case "metabolism":
      return "CYP450 drug clearance";
    case "cardiovascular":
      return "Blood pressure / heart rhythm";
    case "glycemic":
      return "Blood sugar during fasting";
  }
}

export function SurgeryPlannerClient() {
  const fr = useLocale() === "fr";
  const [surgeryDate, setSurgeryDate] = useState(defaultSurgeryDateIso);
  const [herbs, setHerbs] = useState<string[]>([
    "Ginkgo Biloba",
    "Garlic",
    "Valerian",
  ]);
  const [draft, setDraft] = useState("");

  const addHerb = (name: string) => {
    const clean = name.trim();
    if (!clean || herbs.length >= 12) return;
    if (herbs.some((h) => h.toLowerCase() === clean.toLowerCase())) return;
    setHerbs([...herbs, clean]);
  };

  const plan = useMemo(
    () => buildSurgeryWashoutPlan(surgeryDate, herbs),
    [surgeryDate, herbs]
  );

  return (
    <div className="space-y-6">
      <div className="print-sheet rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label
              htmlFor="surgery-date-input"
              className="block text-sm font-semibold text-foreground"
            >
              {fr ? "Date prévue de l'intervention" : "Scheduled surgery date"}
            </label>
            <Input
              id="surgery-date-input"
              type="date"
              value={surgeryDate}
              onChange={(e) => setSurgeryDate(e.target.value)}
              className="mt-1.5"
            />
          </div>

          <div>
            <label
              htmlFor="surgery-herb-input"
              className="block text-sm font-semibold text-foreground"
            >
              {fr
                ? "Vos plantes, thés ou suppléments actuels"
                : "Your current herbs & supplements"}
            </label>
            <div className="no-print mt-1.5 flex gap-2">
              <Input
                id="surgery-herb-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={
                  fr
                    ? "ex. curcuma, ginkgo, ail, millepertuis..."
                    : "e.g. turmeric, ginkgo, garlic, kava..."
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addHerb(draft);
                    setDraft("");
                  }
                }}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  addHerb(draft);
                  setDraft("");
                }}
                aria-label={fr ? "Ajouter" : "Add herb"}
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Quick add chips */}
        <div className="no-print mt-4 space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            {fr
              ? "Ajout rapide (plantes fréquentes en préopératoire) :"
              : "Quick add common pre-operative herbs:"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SURGERY_HERB_RULES.slice(0, 10).map((r) => (
              <button
                key={r.slug}
                type="button"
                onClick={() => addHerb(fr ? r.frName : r.enName)}
                className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                + {fr ? r.frName : r.enName}
              </button>
            ))}
          </div>
        </div>

        {/* Active chips */}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-4">
          {herbs.map((h) => (
            <span
              key={h}
              className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium text-foreground"
            >
              {h}
              <button
                type="button"
                onClick={() => setHerbs(herbs.filter((x) => x !== h))}
                className="no-print ml-1 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                aria-label={`${fr ? "Retirer" : "Remove"} ${h}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      {plan && (
        <div className="print-sheet space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {fr
                  ? "Calendrier préopératoire à vérifier avec votre équipe"
                  : "Pre-Operative Washout Timeline for Surgical Review"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {fr
                  ? `Intervention le ${surgeryDate} (${plan.daysUntilSurgery} jours restants)`
                  : `Surgery date: ${surgeryDate} (${plan.daysUntilSurgery} day${plan.daysUntilSurgery === 1 ? "" : "s"} from today)`}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="no-print"
              onClick={() => window.print()}
            >
              <Printer className="mr-1.5 size-4" />
              {fr ? "Imprimer pour le chirurgien" : "Print for surgeon"}
            </Button>
          </div>

          {plan.matched.length > 0 ? (
            <ul className="space-y-3">
              {plan.matched.map(({ rule, stopDateIso, alreadyPastWindow }) => (
                <li
                  key={rule.slug}
                  className="rounded-xl border border-border bg-background/60 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CalendarClock
                        className="size-4 text-primary"
                        aria-hidden="true"
                      />
                      <Link
                        href={`/herbs/${rule.slug}`}
                        className="text-base font-semibold text-foreground hover:text-primary hover:underline"
                      >
                        {fr ? rule.frName : rule.enName}
                      </Link>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {categoryLabel(rule.category, fr)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                        {fr
                          ? `Réviser / stopper vers le ${stopDateIso} (J-${rule.daysBefore})`
                          : `Review / pause by ${stopDateIso} (${rule.daysBefore}d prior)`}
                      </span>
                      {alreadyPastWindow && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-900 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200">
                          <AlertTriangle className="size-3" />
                          {fr ? "Délai déjà entamé" : "Window started"}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {fr ? rule.frRationale : rule.enRationale}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-primary" />
              <span>
                {fr
                  ? "Aucune plante de cette liste ne figure dans les règles standardisées ASA/Santé Canada de saignement ou d'anesthésie ci-dessus — déclarez-les tout de même en consultation préopératoire."
                  : "None of your entered herbs trigger a specific ASA/Health Canada pre-operative bleeding, sedation, or CYP rule here — still list every supplement at your pre-op clinic visit."}
              </span>
            </div>
          )}

          {plan.unmatched.length > 0 && (
            <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">
                {fr
                  ? "Suppléments sans règle automatique — à déclarer également :"
                  : "Supplements without a specific washout rule (still disclose at pre-op):"}
              </p>
              <p className="mt-1">{plan.unmatched.join(", ")}</p>
            </div>
          )}

          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span>
              {fr
                ? "Information éducative fondée sur les recommandations de l'American Society of Anesthesiologists (ASA) et de Santé Canada — ne remplace pas les consignes de votre chirurgien ou anesthésiste."
                : "Educational planning aid grounded in American Society of Anesthesiologists (ASA) and Health Canada pre-operative guidance. Never stop prescribed drugs without surgical or medical instructions."}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
