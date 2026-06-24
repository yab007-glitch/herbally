import { buildPageMetadata } from "@/lib/i18n/metadata";
import dynamic from "next/dynamic";
const DoseCalculatorForm = dynamic(() =>
  import("@/components/calculator/dose-calculator-form").then(
    (mod) => mod.DoseCalculatorForm
  )
);
import { getHerbBySlug } from "@/lib/actions/herbs";
import { getTranslations } from "next-intl/server";
import { getLocaleFromRequest } from "@/lib/i18n/server-locale";
import { parseProvenance, isVerified } from "@/lib/types/provenance";

export const generateMetadata = () =>
  buildPageMetadata({ titleKey: "doseCalculator", path: "/calculator" });

function parseDosage(dosageStr: string | null): {
  dose: number | null;
  unit: "mg" | "ml" | "g" | "drops";
} {
  if (!dosageStr) return { dose: null, unit: "mg" };
  // Match patterns like "500 mg", "500-1000 mg", "1-3 g", "30 drops", "2-4 ml"
  // Capture both bounds of an optional range so we can use the midpoint
  // rather than the low end — dosing off the floor of a range underdoses.
  const match = dosageStr.match(
    /(\d+(?:\.\d+)?)\s*(?:[-–]\s*(\d+(?:\.\d+)?)\s*)?(mg|ml|g|drops)/i
  );
  if (!match) return { dose: null, unit: "mg" };
  const low = parseFloat(match[1]);
  const high = match[2] ? parseFloat(match[2]) : null;
  // L22: reject malformed multi-bound ranges like "500-1000-2000 mg". The
  // regex would backtrack to "1000-2000" and silently discard the low bound,
  // biasing the computed pediatric dose HIGH (toward overdose). More than one
  // range separator means malformed input — leave the prefill empty rather
  // than surface a silently-truncated value.
  const separatorCount = (dosageStr.match(/[-–]/g) || []).length;
  if (separatorCount > 1) return { dose: null, unit: "mg" };
  return {
    dose: high !== null ? (low + high) / 2 : low,
    unit: match[3].toLowerCase() as "mg" | "ml" | "g" | "drops",
  };
}

export default async function CalculatorPage({
  searchParams,
}: {
  searchParams: Promise<{ herb?: string }>;
}) {
  const params = await searchParams;
  const locale = await getLocaleFromRequest();
  const t = await getTranslations({ locale });
  const herbSlug = params.herb;

  let prefill: {
    herbName: string;
    adultDose: string;
    doseUnit: "mg" | "ml" | "g" | "drops";
    dosageAdultRaw: string | null;
    dosageChildRaw: string | null;
    dosageForms: string[];
    verified: boolean;
  } | null = null;

  if (herbSlug) {
    const result = await getHerbBySlug(herbSlug);
    if (result.success && result.data) {
      const herb = result.data;
      // Only surface a reference adult dose when the monograph has been
      // human-reviewed against a primary source (manual / primary_source).
      // AI-generated dosages are unverified — prefilling them would present
      // an authoritative-looking number from unchecked data, which is
      // especially dangerous feeding a pediatric calculator.
      const verified = isVerified(
        parseProvenance(herb.provenance as Record<string, unknown> | null)
      );
      const parsed = parseDosage(herb.dosage_adult);
      prefill = {
        herbName: herb.name,
        adultDose: verified && parsed.dose ? String(parsed.dose) : "",
        doseUnit: parsed.unit,
        dosageAdultRaw: herb.dosage_adult,
        dosageChildRaw: herb.dosage_child,
        dosageForms: herb.dosage_forms || [],
        verified,
      };
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {t("calculator.title")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("calculator.subtitle")}</p>
      </div>
      <DoseCalculatorForm prefill={prefill} />
    </div>
  );
}
