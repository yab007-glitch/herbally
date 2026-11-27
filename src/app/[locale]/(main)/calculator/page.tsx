import { buildPageMetadata } from "@/lib/i18n/metadata";
import { BreadcrumbListSchema } from "@/components/seo/breadcrumb-list-schema";
import { FAQSchema } from "@/components/seo/faq-schema";
import { WebApplicationSchema } from "@/components/seo/web-app-schema";
import { siteUrl } from "@/lib/seo/site-url";
import { DoseCalculatorForm } from "@/components/calculator/dose-calculator-form";
import { DangerousHerbBanner } from "@/components/herbs/dangerous-herb-banner";
import {
  canShowDoseCalculator,
  isDangerousHerb,
} from "@/lib/data/dangerous-herbs";
import { getHerbBySlug } from "@/lib/actions/herbs";
import { getTranslations } from "next-intl/server";
import { getLocale } from "@/lib/i18n/page-locale";
import { ToolsMessagesProvider } from "@/components/i18n/tools-messages-provider";
import { parseProvenance, isVerified } from "@/lib/types/provenance";
import { ContinueExploring } from "@/components/shared/continue-exploring";

export const generateMetadata = () =>
  buildPageMetadata({
    titleKey: "doseCalculator",
    descKey: "doseCalculatorDesc",
    path: "/calculator",
  });

function parseDosage(dosageStr: string | null): {
  dose: number | null;
  low: number | null;
  high: number | null;
  unit: "mg" | "ml" | "g" | "drops";
} {
  if (!dosageStr) return { dose: null, low: null, high: null, unit: "mg" };
  // Match patterns like "500 mg", "500-1000 mg", "1-3 g", "30 drops", "2-4 ml"
  // A range is returned as low/high, never collapsed to a midpoint: silently
  // prefilling a midpoint would present an invented single dose as if it
  // were the herb's reference dose. The form shows the range and lets the
  // user explicitly pick a value inside it (or leave the field blank).
  const match = dosageStr.match(
    /(\d+(?:\.\d+)?)\s*(?:[-–]\s*(\d+(?:\.\d+)?)\s*)?(mg|ml|g|drops)/i
  );
  if (!match) return { dose: null, low: null, high: null, unit: "mg" };
  const low = parseFloat(match[1]);
  const high = match[2] ? parseFloat(match[2]) : null;
  // Reject malformed multi-bound chains like "500-1000-2000 mg": the regex
  // would match only "1000-2000" and silently discard the low bound.
  //
  // Counting every hyphen and rejecting more than one rejected most real
  // monographs, which often list several separate ranges ("250-500 mg twice
  // daily; 1-2 g in divided doses"). Those ranges are each well-formed and
  // the first is the correct prefill, so only a *contiguous* three-number
  // chain is treated as ambiguous.
  if (/\d\s*[-–]\s*\d+\s*[-–]\s*\d/.test(dosageStr))
    return { dose: null, low: null, high: null, unit: "mg" };
  return {
    dose: high === null ? low : null,
    low,
    high,
    unit: match[3].toLowerCase() as "mg" | "ml" | "g" | "drops",
  };
}

export default async function CalculatorPage({
  searchParams,
}: {
  searchParams: Promise<{ herb?: string }>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const t = await getTranslations({ locale });
  const herbSlug = params.herb;
  const blockedDangerousSlug =
    herbSlug && isDangerousHerb(herbSlug) ? herbSlug : null;
  let nonDosableHerbName: string | null = null;

  let prefill: {
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
  } | null = null;

  if (herbSlug && !blockedDangerousSlug) {
    const result = await getHerbBySlug(herbSlug);
    if (result.success && result.data) {
      const herb = result.data;
      if (!canShowDoseCalculator(herb.slug, herb.dosage_adult)) {
        nonDosableHerbName = herb.name;
      } else {
        // Only surface a reference adult dose when the monograph has been
        // human-reviewed against a primary source (manual / primary_source).
        // AI-generated dosages are unverified — prefilling them would present
        // an authoritative-looking number from unchecked data, which is
        // especially dangerous feeding a dose calculator.
        const verified = isVerified(
          parseProvenance(herb.provenance as Record<string, unknown> | null)
        );
        const parsed = parseDosage(herb.dosage_adult);
        // Only prefill a single, verified reference dose. A range is never
        // collapsed to one number here; the form offers explicit low/middle/
        // high picks from the range instead. Unverified herbs get no prefill.
        prefill = {
          herbName: herb.name,
          adultDose: verified && parsed.dose ? String(parsed.dose) : "",
          doseUnit: parsed.unit,
          dosageAdultRaw: herb.dosage_adult,
          dosageRange:
            verified && parsed.low !== null && parsed.high !== null
              ? { low: parsed.low, high: parsed.high, unit: parsed.unit }
              : null,
          dosageForms: herb.dosage_forms || [],
          verified,
        };
      }
    }
  }

  return (
    <ToolsMessagesProvider locale={locale}>
      <div className="space-y-8">
        <BreadcrumbListSchema
          items={[
            { name: t("common.home"), url: siteUrl() },
            { name: t("calculator.title"), url: "/calculator" },
          ]}
        />
        <WebApplicationSchema
          name={t("calculator.title")}
          description={t("calculator.subtitle")}
          url={`${siteUrl()}${locale === "fr" ? "/fr" : ""}/calculator`}
          featureList={[
            locale === "fr"
              ? "Référence posologique adulte uniquement (18 ans et plus)"
              : "Adults-only (18+) monograph reference dose checker",
            locale === "fr"
              ? "Aucun calcul pédiatrique ni ajustement selon l'âge ou le poids"
              : "Zero pediatric calculation and zero weight/age scaling formulas (Clark/Young/Fried disabled)",
            locale === "fr"
              ? "Blocage strict des plantes toxiques ou non dosables"
              : "Hard safety block for quarantined toxic or non-dosable botanicals",
          ]}
        />
        <FAQSchema
          items={[
            {
              question: t("calculator.faq.q1"),
              answer: t("calculator.faq.a1"),
            },
            {
              question: t("calculator.faq.q2"),
              answer: t("calculator.faq.a2"),
            },
            {
              question: t("calculator.faq.q3"),
              answer: t("calculator.faq.a3"),
            },
          ]}
        />
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t("calculator.title")}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {t("calculator.subtitle")}
          </p>
        </div>
        {blockedDangerousSlug ? (
          <div className="space-y-4">
            <DangerousHerbBanner
              slug={blockedDangerousSlug}
              locale={locale === "fr" ? "fr" : "en"}
            />
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm leading-relaxed text-foreground">
              {locale === "fr"
                ? "HerbAlly ne calcule pas de posologie pour les plantes toxiques ou potentiellement mortelles. N'utilisez pas cette plante en automédication et consultez un centre antipoison ou un médecin en cas d'exposition."
                : "HerbAlly does not calculate doses for toxic or potentially lethal plants. Do not self-administer preparations of this plant; contact Poison Control or a licensed clinician if exposure occurs."}
            </div>
          </div>
        ) : nonDosableHerbName ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm leading-relaxed text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
            {locale === "fr"
              ? `HerbAlly ne calcule ni n'automatise de posologie pour ${nonDosableHerbName} : cette entrée correspond à un usage strictement externe, à une préparation homéopathique, à une plante à marge thérapeutique étroite, ou ne dispose pas d'une dose adulte quantitative vérifiée. Consultez un pharmacien ou un médecin.`
              : `HerbAlly does not calculate or automate doses for ${nonDosableHerbName}: this entry is topical-only, homeopathic, narrow-margin, or lacks an established quantitative oral adult reference dose. Consult a licensed pharmacist or clinician.`}
          </div>
        ) : (
          <DoseCalculatorForm prefill={prefill} />
        )}
        <section aria-labelledby="calculator-faq-heading" className="pt-4">
          <h2
            id="calculator-faq-heading"
            className="mb-3 text-xl font-semibold text-foreground"
          >
            {t("calculator.faq.heading")}
          </h2>
          <div className="divide-y rounded-2xl border">
            {(["1", "2", "3"] as const).map((n) => (
              <details key={n} className="px-4 py-3">
                <summary className="cursor-pointer font-medium text-foreground">
                  {t(`calculator.faq.q${n}`)}
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(`calculator.faq.a${n}`)}
                </p>
              </details>
            ))}
          </div>
        </section>
        <ContinueExploring />
      </div>
    </ToolsMessagesProvider>
  );
}
