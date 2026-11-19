"use client";

import { useState } from "react";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileSearch,
  FlaskConical,
  Leaf,
  Pill,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface NpnIngredient {
  name: string;
  cleanedName: string;
  quantity: number | null;
  unit: string | null;
  potencyAmount: number | null;
  potencyConstituent: string | null;
  potencyUnit: string | null;
  dhe: string | number | null;
  dheUnit: string | null;
  extractType: string | null;
  sourceMaterial: string | null;
  matchedHerb: {
    slug: string;
    name: string;
    scientificName: string;
    interactionCount: number;
  } | null;
}

interface NpnLookupResult {
  npn: string;
  lnhpdId: number;
  locale: "en" | "fr";
  productName: string;
  companyName: string | null;
  dosageForm: string | null;
  submissionType: string | null;
  licenceDate: string | null;
  revisedDate: string | null;
  status: { active: boolean; label: string };
  ingredients: NpnIngredient[];
  purposes: string[];
  risks: Array<{ type: string; subType: string; text: string }>;
  doses: Array<{
    population: string;
    quantity: number | null;
    unit: string;
    frequency: number | null;
    frequencyUnit: string;
  }>;
  sourceUrl: string;
}

interface StackMatchResult {
  matches: Array<{
    herbName: string;
    herbSlug: string;
    drugName: string;
    severity: "mild" | "moderate" | "severe" | "contraindicated";
    description: string;
    pairUrl: string;
  }>;
  unrecorded: Array<{ herbName: string; drugInput: string }>;
}

const SAMPLE_NPNS = [
  { npn: "80000001", labelKey: "sampleFlax" },
  { npn: "80010538", labelKey: "sampleGreens" },
  { npn: "80035032", labelKey: "sampleAstragalus" },
] as const;

export function NpnCheckerClient() {
  const t = useTranslations("npnCheckerPage");
  const locale = useLocale() === "fr" ? "fr" : "en";

  const [npnInput, setNpnInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<NpnLookupResult | null>(null);

  const [medInput, setMedInput] = useState("");
  const [checkingMed, setCheckingMed] = useState(false);
  const [medError, setMedError] = useState<string | null>(null);
  const [medResult, setMedResult] = useState<StackMatchResult | null>(null);

  async function lookupNpn(targetNpn: string) {
    const trimmed = targetNpn.trim();
    if (!trimmed) {
      setError(t("emptyError"));
      return;
    }
    setLoading(true);
    setError(null);
    setMedResult(null);
    setMedError(null);
    try {
      const res = await fetch(
        `/api/npn/lookup?npn=${encodeURIComponent(trimmed)}&locale=${locale}`
      );
      const payload = (await res.json()) as NpnLookupResult & {
        error?: string;
      };
      if (!res.ok) {
        setData(null);
        setError(payload.error || t("errorGeneric"));
        setLoading(false);
        return;
      }
      setData(payload);
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setLoading(false);
    }
  }

  async function checkBottleAgainstMed(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    const matchedNames = [
      ...new Set(
        data.ingredients
          .filter((i) => i.matchedHerb !== null)
          .map((i) => i.matchedHerb!.name)
      ),
    ];
    const drug = medInput.trim();
    if (matchedNames.length === 0 || drug.length < 2) {
      setMedError(t("medCheckNeedInput"));
      return;
    }

    setCheckingMed(true);
    setMedError(null);
    try {
      const res = await fetch("/api/interactions/check-stack", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-locale": locale },
        body: JSON.stringify({
          herbs: matchedNames.slice(0, 10),
          drugs: [drug],
          locale,
        }),
      });
      const payload = (await res.json()) as StackMatchResult & {
        error?: string;
      };
      if (!res.ok) {
        setMedError(payload.error || t("errorGeneric"));
        return;
      }
      setMedResult(payload);
    } catch {
      setMedError(t("errorGeneric"));
    } finally {
      setCheckingMed(false);
    }
  }

  const matchedHerbsCount =
    data?.ingredients.filter((i) => i.matchedHerb !== null).length ?? 0;

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void lookupNpn(npnInput);
        }}
        className="rounded-2xl border border-border bg-card p-5 sm:p-6"
      >
        <label
          htmlFor="npn-number-input"
          className="text-sm font-medium text-foreground"
        >
          {t("inputLabel")}
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Input
            id="npn-number-input"
            value={npnInput}
            onChange={(e) => setNpnInput(e.target.value)}
            placeholder={t("inputPlaceholder")}
            inputMode="numeric"
            className="sm:flex-1"
          />
          <Button type="submit" disabled={loading}>
            <FileSearch className="mr-1.5 size-4" />
            {loading ? t("searchingButton") : t("searchButton")}
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">{t("samplesLabel")}</span>
          {SAMPLE_NPNS.map((sample) => (
            <button
              key={sample.npn}
              type="button"
              onClick={() => {
                setNpnInput(sample.npn);
                void lookupNpn(sample.npn);
              }}
              className="rounded-full border border-border bg-background px-2.5 py-1 text-foreground transition-colors hover:border-primary/40 hover:bg-muted"
            >
              {sample.npn} · {t(sample.labelKey)}
            </button>
          ))}
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
      </form>

      {data && (
        <div className="space-y-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-foreground">
                  NPN {data.npn}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                    data.status.active
                      ? "border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200"
                      : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                  }`}
                >
                  {data.status.active ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : (
                    <AlertTriangle className="size-3.5" />
                  )}
                  {data.status.label}
                </span>
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">
                {data.productName}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {[data.companyName, data.dosageForm, data.submissionType]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <a
              href={data.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {t("officialRecordLink")}
              <ExternalLink className="size-3.5" />
            </a>
          </div>

          {/* Medicinal Ingredients */}
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <FlaskConical className="size-4 text-primary" />
              {t("ingredientsHeading")} ({data.ingredients.length})
            </h3>
            <ul className="mt-3 space-y-2">
              {data.ingredients.map((ing, idx) => (
                <li
                  key={`${ing.name}-${idx}`}
                  className="flex flex-col justify-between gap-2 rounded-xl border border-border/80 bg-background/60 p-3 sm:flex-row sm:items-center"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {ing.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[
                        ing.quantity && ing.unit
                          ? `${ing.quantity} ${ing.unit}`
                          : null,
                        ing.dhe && ing.dheUnit
                          ? `DHE/QBE ${ing.dhe} ${ing.dheUnit}`
                          : null,
                        ing.potencyAmount && ing.potencyConstituent
                          ? `${ing.potencyAmount} ${ing.potencyUnit ?? ""} ${ing.potencyConstituent}`
                          : null,
                        ing.sourceMaterial,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {ing.matchedHerb && (
                    <Link
                      href={`/herbs/${ing.matchedHerb.slug}`}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/15"
                    >
                      <Leaf className="size-3.5" />
                      {ing.matchedHerb.name}
                      {ing.matchedHerb.interactionCount > 0 && (
                        <span className="opacity-80">
                          ({ing.matchedHerb.interactionCount})
                        </span>
                      )}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Medication Cross-Check */}
          {matchedHerbsCount > 0 && (
            <form
              onSubmit={checkBottleAgainstMed}
              className="rounded-xl border border-primary/30 bg-primary/5 p-4"
            >
              <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
                <Pill className="size-4 text-primary" />
                {t("medCheckTitle")}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("medCheckSubtitle")}
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input
                  value={medInput}
                  onChange={(e) => setMedInput(e.target.value)}
                  placeholder={t("medCheckPlaceholder")}
                  className="bg-background sm:flex-1"
                />
                <Button type="submit" disabled={checkingMed}>
                  {checkingMed ? t("checkingMedButton") : t("checkMedButton")}
                </Button>
              </div>
              {medError && (
                <p className="mt-2 text-xs text-destructive">{medError}</p>
              )}
              {medResult && (
                <div className="mt-3 space-y-2">
                  {medResult.matches.length > 0 ? (
                    medResult.matches.map((m, i) => (
                      <div
                        key={`${m.herbSlug}-${i}`}
                        className="rounded-lg border border-amber-300 bg-background p-3 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-foreground">
                            {m.herbName} + {m.drugName}
                          </span>
                          <span className="font-semibold uppercase text-amber-800 dark:text-amber-300">
                            {m.severity}
                          </span>
                        </div>
                        <p className="mt-1 text-muted-foreground">
                          {m.description}
                        </p>
                        <Link
                          href={m.pairUrl}
                          className="mt-1.5 inline-block font-medium text-primary hover:underline"
                        >
                          {t("readInteractionDetails")} →
                        </Link>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {t("medCheckNoMatches")}
                    </p>
                  )}
                </div>
              )}
            </form>
          )}

          {/* Recommended Uses */}
          {data.purposes.length > 0 && (
            <div>
              <h3 className="text-base font-semibold text-foreground">
                {t("purposesHeading")}
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {data.purposes.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Official Health Canada Risks / Cautions */}
          {data.risks.length > 0 && (
            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
                <ShieldAlert className="size-4 text-amber-600" />
                {t("risksHeading")}
              </h3>
              <ul className="mt-2 space-y-2">
                {data.risks.map((r, i) => (
                  <li
                    key={`${r.text}-${i}`}
                    className="rounded-lg border border-border/70 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground"
                  >
                    {r.type && (
                      <span className="mr-1.5 font-semibold text-foreground">
                        {r.type}:
                      </span>
                    )}
                    {r.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
