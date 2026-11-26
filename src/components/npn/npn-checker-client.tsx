"use client";

import { useEffect, useRef, useState } from "react";
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
  partial?: boolean;
  unavailableSections?: Array<"ingredients" | "purposes" | "risks" | "doses">;
  sectionStatus?: {
    ingredients: "ok" | "unavailable";
    purposes: "ok" | "unavailable";
    risks: "ok" | "unavailable";
    doses: "ok" | "unavailable";
  };
  herbMatchingUnavailable?: boolean;
  ingredients: NpnIngredient[];
  nonMedicinalIngredients?: string[];
  purposes: string[];
  risks: Array<{ type: string; subType: string; text: string }>;
  doses: Array<{
    population: string;
    quantity: number | null;
    unit: string;
    frequency: number | null;
    frequencyUnit: string;
  }>;
  checkedAt?: string;
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
  conflicts?: Array<{
    herbName: string;
    herbSlug: string;
    drugInput: string;
    drugSlug: string;
    pairUrl: string;
    records: Array<{
      herbName: string;
      herbSlug: string;
      drugName: string;
      severity: "mild" | "moderate" | "severe" | "contraindicated";
      description: string;
      pairUrl: string;
    }>;
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

  const npnGenRef = useRef(0);
  const npnAbortRef = useRef<AbortController | null>(null);
  const medGenRef = useRef(0);
  const medAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      npnAbortRef.current?.abort();
      medAbortRef.current?.abort();
    };
  }, []);

  function invalidateMedCheck() {
    medGenRef.current += 1;
    medAbortRef.current?.abort();
    medAbortRef.current = null;
    setCheckingMed(false);
    setMedResult(null);
    setMedError(null);
  }

  async function lookupNpn(targetNpn: string) {
    const trimmed = targetNpn.trim();
    if (!trimmed) {
      npnGenRef.current += 1;
      npnAbortRef.current?.abort();
      npnAbortRef.current = null;
      setLoading(false);
      setData(null);
      setError(t("emptyError"));
      invalidateMedCheck();
      return;
    }

    const gen = ++npnGenRef.current;
    npnAbortRef.current?.abort();
    const controller = new AbortController();
    npnAbortRef.current = controller;

    setLoading(true);
    setError(null);
    setData(null);
    invalidateMedCheck();

    try {
      const res = await fetch(
        `/api/npn/lookup?npn=${encodeURIComponent(trimmed)}&locale=${locale}`,
        { signal: controller.signal }
      );
      if (gen !== npnGenRef.current) return;
      const payload = (await res.json()) as NpnLookupResult & {
        error?: string;
      };
      if (gen !== npnGenRef.current) return;
      if (!res.ok) {
        setData(null);
        setError(payload.error || t("errorGeneric"));
        return;
      }
      setData(payload);
    } catch {
      if (gen !== npnGenRef.current) return;
      setData(null);
      setError(t("errorGeneric"));
    } finally {
      if (gen === npnGenRef.current) {
        setLoading(false);
        if (npnAbortRef.current === controller) {
          npnAbortRef.current = null;
        }
      }
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
      invalidateMedCheck();
      setMedError(t("medCheckNeedInput"));
      return;
    }

    const gen = ++medGenRef.current;
    medAbortRef.current?.abort();
    const controller = new AbortController();
    medAbortRef.current = controller;

    setCheckingMed(true);
    setMedError(null);
    setMedResult(null);
    try {
      const res = await fetch("/api/interactions/check-stack", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-locale": locale },
        body: JSON.stringify({
          herbs: matchedNames.slice(0, 10),
          drugs: [drug],
          locale,
        }),
        signal: controller.signal,
      });
      if (gen !== medGenRef.current) return;
      const payload = (await res.json()) as StackMatchResult & {
        error?: string;
      };
      if (gen !== medGenRef.current) return;
      if (!res.ok) {
        setMedResult(null);
        setMedError(payload.error || t("errorGeneric"));
        return;
      }
      setMedResult(payload);
    } catch {
      if (gen !== medGenRef.current) return;
      setMedResult(null);
      setMedError(t("errorGeneric"));
    } finally {
      if (gen === medGenRef.current) {
        setCheckingMed(false);
        if (medAbortRef.current === controller) {
          medAbortRef.current = null;
        }
      }
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
            onChange={(e) => {
              setNpnInput(e.target.value);
              npnGenRef.current += 1;
              npnAbortRef.current?.abort();
              npnAbortRef.current = null;
              setLoading(false);
              setError(null);
              setData(null);
              invalidateMedCheck();
            }}
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
              <p className="mt-1 text-xs text-muted-foreground">
                {[
                  data.licenceDate
                    ? `${locale === "fr" ? "Homologation" : "Licensed"}: ${data.licenceDate}`
                    : null,
                  data.revisedDate
                    ? `${locale === "fr" ? "Révisé" : "Revised"}: ${data.revisedDate}`
                    : null,
                  data.checkedAt
                    ? `${locale === "fr" ? "Vérifié via LNHPD" : "Checked"}: ${data.checkedAt.slice(0, 10)}`
                    : null,
                ]
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

          {!data.status.active && (
            <div
              role="alert"
              className="rounded-xl border border-red-300 bg-red-50/80 p-4 text-xs leading-relaxed text-red-950 dark:border-red-800 dark:bg-red-950/30 dark:text-red-100"
            >
              <p className="font-semibold">
                {locale === "fr"
                  ? "Attention : cette licence NPN n'est pas active dans le registre de Santé Canada"
                  : "Warning: This NPN licence is NOT currently Active in Health Canada's register"}
              </p>
              <p className="mt-1">
                {locale === "fr"
                  ? "Une licence suspendue, discontinuée ou annulée signifie que le produit n'est peut-être plus autorisé à la vente au Canada. Demandez conseil à un pharmacien avant utilisation."
                  : "A suspended, discontinued, or cancelled status means this product may no longer be authorized for sale in Canada. Check the product bottle and ask a pharmacist before use."}
              </p>
            </div>
          )}

          <p className="rounded-lg border border-border/70 bg-muted/30 px-3.5 py-2.5 text-xs text-muted-foreground">
            {locale === "fr"
              ? "Portée réglementaire : un numéro de produit naturel (NPN) atteste d'une homologation de Santé Canada — cela ne prouve pas l'efficacité clinique ni l'innocuité avec vos médicaments."
              : "Regulatory scope: a Health Canada NPN confirms product licensing and label review — it does NOT establish clinical efficacy or personal safety alongside your medications."}
          </p>

          {/* Partial upstream failure banner */}
          {data.partial && (
            <div
              role="alert"
              className="rounded-xl border border-amber-300 bg-amber-50/80 p-4 text-xs leading-relaxed text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
            >
              <p className="font-semibold">
                {locale === "fr"
                  ? "Fiche partielle : certaines données de Santé Canada ou de correspondance n'ont pas pu être chargées."
                  : "Incomplete record: some Health Canada sections or interaction checks could not be loaded."}
              </p>
              <p className="mt-1 opacity-90">
                {locale === "fr"
                  ? "Ne considérez pas une section absente ou vide comme une absence de mise en garde. Consultez la fiche officielle Santé Canada ou un pharmacien."
                  : "Do not interpret missing or empty sections as absence of ingredients or cautions. Verify the official Health Canada listing or ask a pharmacist."}
              </p>
            </div>
          )}

          {/* Medicinal Ingredients */}
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <FlaskConical className="size-4 text-primary" />
              {t("ingredientsHeading")}{" "}
              {data.sectionStatus?.ingredients === "unavailable"
                ? ""
                : `(${data.ingredients.length})`}
            </h3>
            {data.sectionStatus?.ingredients === "unavailable" ? (
              <p
                role="alert"
                className="mt-2 rounded-lg border border-amber-300 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
              >
                {locale === "fr"
                  ? "Les ingrédients médicinaux n'ont pas pu être récupérés depuis le registre de Santé Canada."
                  : "Medicinal ingredients could not be loaded from Health Canada right now."}
              </p>
            ) : (
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
            )}
            {data.herbMatchingUnavailable && (
              <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
                {locale === "fr"
                  ? "La correspondance avec les fiches d'interactions HerbAlly est temporairement indisponible."
                  : "HerbAlly interaction cross-referencing is temporarily unavailable."}
              </p>
            )}
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
                  onChange={(e) => {
                    setMedInput(e.target.value);
                    invalidateMedCheck();
                  }}
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
                  {medResult.conflicts && medResult.conflicts.length > 0 && (
                    <div role="alert" className="space-y-2">
                      {medResult.conflicts.flatMap((c) =>
                        c.records.map((r, idx) => (
                          <div
                            key={`${c.herbSlug}-${r.drugName}-${idx}`}
                            className="rounded-lg border border-amber-300 bg-background p-3 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-foreground">
                                {r.herbName} + {r.drugName}
                              </span>
                              <span className="font-semibold uppercase text-amber-800 dark:text-amber-300">
                                {r.severity}
                              </span>
                            </div>
                            <p className="mt-1 text-muted-foreground">
                              {r.description}
                            </p>
                            <Link
                              href={r.pairUrl}
                              className="mt-1.5 inline-block font-medium text-primary hover:underline"
                            >
                              {t("readInteractionDetails")} →
                            </Link>
                          </div>
                        ))
                      )}
                    </div>
                  )}
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
                  ) : (medResult.conflicts?.length ?? 0) === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {t("medCheckNoMatches")}
                    </p>
                  ) : null}
                </div>
              )}
            </form>
          )}

          {/* Recommended Uses */}
          {(data.purposes.length > 0 ||
            data.sectionStatus?.purposes === "unavailable") && (
            <div>
              <h3 className="text-base font-semibold text-foreground">
                {t("purposesHeading")}
              </h3>
              {data.sectionStatus?.purposes === "unavailable" ? (
                <p
                  role="alert"
                  className="mt-2 rounded-lg border border-amber-300 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                >
                  {locale === "fr"
                    ? "Les usages recommandés par Santé Canada n'ont pas pu être chargés."
                    : "Recommended uses could not be loaded from Health Canada right now."}
                </p>
              ) : (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {data.purposes.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Official Health Canada Risks / Cautions */}
          {data.nonMedicinalIngredients &&
            data.nonMedicinalIngredients.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {locale === "fr"
                    ? "Ingrédients non médicinaux (excipients / allergènes possibles)"
                    : "Non-medicinal ingredients (excipients / potential allergens)"}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {data.nonMedicinalIngredients.join(", ")}
                </p>
              </div>
            )}

          {(data.risks.length > 0 ||
            data.sectionStatus?.risks === "unavailable") && (
            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
                <ShieldAlert className="size-4 text-amber-600" />
                {t("risksHeading")}
              </h3>
              {data.sectionStatus?.risks === "unavailable" ? (
                <p
                  role="alert"
                  className="mt-2 rounded-lg border border-amber-300 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                >
                  {locale === "fr"
                    ? "Les mises en garde et énoncés de risque officiels de Santé Canada n'ont pas pu être chargés. Consultez la fiche officielle ou demandez conseil à un pharmacien."
                    : "Official Health Canada cautions and risk statements could not be loaded right now. Check the official Health Canada record or ask a pharmacist."}
                </p>
              ) : (
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
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
