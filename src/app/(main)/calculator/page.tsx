import type { Metadata } from "next";
import { cookies } from "next/headers";
import dynamic from "next/dynamic";
const DoseCalculatorForm = dynamic(() =>
  import("@/components/calculator/dose-calculator-form").then(
    (mod) => mod.DoseCalculatorForm
  )
);
import { getHerbBySlug } from "@/lib/actions/herbs";
import { getTranslations } from "next-intl/server";
import { type Locale } from "@/lib/i18n/config";

export const metadata: Metadata = {
  title: "HerbAlly - Dose Calculator",
  description:
    "Free herbal dosage calculator using Clark's Rule, Young's Rule, BSA, and Fried's Rule. Calculate safe children's and infant doses for 2,700+ medicinal herbs.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app"}/calculator`,
  },
};

function parseDosage(dosageStr: string | null): {
  dose: number | null;
  unit: "mg" | "ml" | "g" | "drops";
} {
  if (!dosageStr) return { dose: null, unit: "mg" };
  // Match patterns like "500 mg", "500-1000 mg", "1-3 g", "30 drops", "2-4 ml"
  const match = dosageStr.match(
    /(\d+(?:\.\d+)?)\s*(?:[-–]\s*\d+(?:\.\d+)?\s*)?(mg|ml|g|drops)/i
  );
  if (!match) return { dose: null, unit: "mg" };
  return {
    dose: parseFloat(match[1]),
    unit: match[2].toLowerCase() as "mg" | "ml" | "g" | "drops",
  };
}

export default async function CalculatorPage({
  searchParams,
}: {
  searchParams: Promise<{ herb?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("herbally-locale");
  const _locale: Locale = localeCookie?.value === "fr" ? "fr" : "en";
  const t = await getTranslations();
  const herbSlug = params.herb;

  let prefill: {
    herbName: string;
    adultDose: string;
    doseUnit: "mg" | "ml" | "g" | "drops";
    dosageAdultRaw: string | null;
    dosageChildRaw: string | null;
    dosageForms: string[];
  } | null = null;

  if (herbSlug) {
    const result = await getHerbBySlug(herbSlug);
    if (result.success && result.data) {
      const herb = result.data;
      const parsed = parseDosage(herb.dosage_adult);
      prefill = {
        herbName: herb.name,
        adultDose: parsed.dose ? String(parsed.dose) : "",
        doseUnit: parsed.unit,
        dosageAdultRaw: herb.dosage_adult,
        dosageChildRaw: herb.dosage_child,
        dosageForms: herb.dosage_forms || [],
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
