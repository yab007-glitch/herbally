"use client";

import { cn } from "@/lib/utils";
import { cleanQuotedText } from "@/lib/herbs/clean-quote";

/**
 * Regulator-sourced evidence for one herb.
 *
 * Everything here is quoted from licensed products in Health Canada's Licensed
 * Natural Health Products Database (Open Government Licence – Canada). The
 * licence requires attribution and forbids implying Health Canada endorsement,
 * so the block names the source, links the dataset, and says plainly that the
 * statements describe licensed products rather than being Health Canada advice.
 *
 * No generated prose: if the record is missing, the section does not render.
 */
export type RegulatoryEvidence = {
  herb_slug: string;
  source: string;
  source_licence: string;
  purposes: string[];
  doses: {
    text: string;
    population?: string | null;
    age_minimum?: number | null;
  }[];
  risks: string[];
  products_sampled: number;
  source_urls: string[];
  retrieved_at: string;
};

const COPY = {
  en: {
    heading: "What licensed products claim",
    intro:
      "Quoted from product licences issued by Health Canada. These are the words on licensed products, not medical advice. Some Health Canada licences cover multi-ingredient formulas, so listed claims or doses may reflect a full product rather than this herb alone.",
    dangerousNote:
      "Health Canada's LNHPD lists ultra-diluted homeopathic preparations under this botanical name. Extreme homeopathic dilutions are fundamentally distinct from the raw toxic plant, so licensed homeopathic doses and indications are intentionally withheld here.",
    homeopathicNote:
      "Homeopathic dilution notice: One or more licensed products on record are homeopathic dilutions (e.g., globules, granules, C/X/LM potencies). Homeopathic dilutions are not clinically equivalent to herbal extracts, tinctures, or raw plant material.",
    purposes: "Indications on record",
    doses: "Adult doses on record",
    risks: "Risk statements",
    products: (n: number) =>
      `Drawn from ${n} licensed product${n === 1 ? "" : "s"}.`,
    attribution: "Health Canada, Licensed Natural Health Products Database",
    retrieved: "retrieved",
    verbatimNote: null as string | null,
    expandLabel: "Show source text",
  },
  fr: {
    heading: "Ce que déclarent les produits homologués",
    intro:
      "Citations tirées de licences de produits délivrées par Santé Canada. Ce sont les mentions des produits homologués, et non un avis médical. Certaines licences couvrent des formules multi-ingrédients ; les mentions peuvent donc refléter le produit complet plutôt que cette plante seule.",
    dangerousNote:
      "La base de Santé Canada répertorie des préparations homéopathiques hautement diluées sous ce nom botanique. Ces dilutions ne correspondent pas à la plante brute toxique ; leurs posologies et allégations sont donc masquées par sécurité.",
    homeopathicNote:
      "Mention homéopathique : au moins un produit homologué au dossier est une préparation homéopathique diluée (granules, globules). Ces dilutions ne sont pas équivalentes à des extraits, teintures ou parties brutes de la plante.",
    purposes: "Indications au dossier",
    doses: "Doses adultes au dossier",
    risks: "Mentions de risque",
    products: (n: number) =>
      `Tiré de ${n} produit${n === 1 ? "" : "s"} homologué${n === 1 ? "" : "s"}.`,
    attribution:
      "Santé Canada, Base de données des produits de santé naturels homologués",
    retrieved: "consultée le",
    // The licensed-product wording is English data; saying so beats a silent
    // language switch, and collapsing it keeps the French page readable.
    verbatimNote:
      "Ces mentions sont reproduites dans leur langue d'origine (anglais), sans traduction : il s'agit de citations de produits homologués.",
    expandLabel: "Afficher les mentions originales en anglais",
  },
} as const;

const PEDIATRIC_DOSE_PATTERN =
  /\b(infant|infants|child|children|adolescent|adolescents|pediatric|paediatric|bébé|bébés|enfant|enfants|nourrisson|nourrissons)\b/i;

const GARBAGE_DOSE_PATTERN =
  /\b(Quantity Unit TBA|Time Unit TBA|Sub Pop to be created|TBA)\b/i;

const HOMEOPATHIC_UNIT_PATTERN =
  /\b(globule|granule|pellet|tube|homeopath|hom[eé]opath|dilution)\b/i;

const ZERO_ONLY_DOSE_PATTERN = /^\s*0(?:\.0+)?\s+[a-zA-Z]/;

function isPediatricOnlyOrTaggedDose(d: {
  text?: string | null;
  population?: string | null;
  age_minimum?: number | null;
}): boolean {
  const pop = d.population ?? "";
  const txt = d.text ?? "";
  if (PEDIATRIC_DOSE_PATTERN.test(pop) || PEDIATRIC_DOSE_PATTERN.test(txt)) {
    return true;
  }
  if (
    typeof d.age_minimum === "number" &&
    d.age_minimum > 0 &&
    d.age_minimum < 18
  ) {
    return true;
  }
  return false;
}

export function isGarbageOrHomeopathicDose(
  d: { text?: string | null; population?: string | null },
  isHomeopathic: boolean
): boolean {
  const txt = (d.text ?? "").trim();
  const pop = (d.population ?? "").trim();
  if (!txt) return true;
  if (GARBAGE_DOSE_PATTERN.test(txt) || GARBAGE_DOSE_PATTERN.test(pop)) {
    return true;
  }
  if (ZERO_ONLY_DOSE_PATTERN.test(txt)) {
    return true;
  }
  if (isHomeopathic && HOMEOPATHIC_UNIT_PATTERN.test(txt)) {
    return true;
  }
  return false;
}

export function formatDoseText(raw: string, locale: "en" | "fr"): string {
  const cleaned = cleanQuotedText(raw);
  return cleaned.replace(
    /^0(?:\.0+)?\s*[-–]\s*(\d+(?:\.\d+)?)\s+/i,
    locale === "fr" ? "jusqu'à $1 " : "up to $1 "
  );
}

export function isCrossContaminatedRisk(slug: string, risk: string): boolean {
  const r = risk.toLowerCase();
  if (
    !/green-tea|camellia-sinensis|thea-sinensis/i.test(slug) &&
    (r.includes("green tea extract") ||
      (r.includes("liver injury") &&
        r.includes("dark urine") &&
        r.includes("jaundice") &&
        !/black-cohosh|kava|chaparral|gobernadora|fo-ti|chelidonium|germander|comfrey|senecio/i.test(
          slug
        )))
  ) {
    return true;
  }
  if (
    !/psyllium|plantago/i.test(slug) &&
    (r.includes("psyllium") ||
      r.includes("choking if swallowed without sufficient water"))
  ) {
    return true;
  }
  if (
    !/bee|propolis|royal-jelly|apitherapy/i.test(slug) &&
    /\b(bee venom|propolis|royal jelly|allergic to bees|vaccine)\b/i.test(r)
  ) {
    return true;
  }
  if (
    !/nicotin|tobacco|lobelia/i.test(slug) &&
    /\b(nicotine replacement|stop smoking|quit smoking)\b/i.test(r)
  ) {
    return true;
  }
  if (r.includes("enough drug in this package to seriously harm a child")) {
    return true;
  }
  return false;
}

export function compactRegulatoryEvidence(
  evidence: RegulatoryEvidence
): { evidence: RegulatoryEvidence; isHomeopathic: boolean } {
  const isHomeopathic =
    /\b(homeopath|hom[eé]opath|globule|granule|pellet|organotherapy|dilution)\b/i.test(
      JSON.stringify({ p: evidence.purposes, d: evidence.doses })
    );
  const adultDoses = (evidence.doses ?? [])
    .filter(
      (d) =>
        !isPediatricOnlyOrTaggedDose(d) &&
        !isGarbageOrHomeopathicDose(d, isHomeopathic)
    )
    .slice(0, 6);
  const filteredRisks = (evidence.risks ?? [])
    .filter((r) => !isCrossContaminatedRisk(evidence.herb_slug, r))
    .slice(0, 5);
  return {
    isHomeopathic,
    evidence: {
      herb_slug: evidence.herb_slug,
      source: evidence.source,
      source_licence: "",
      purposes: (evidence.purposes ?? []).slice(0, 6),
      doses: adultDoses,
      risks: filteredRisks,
      products_sampled: evidence.products_sampled,
      source_urls: [],
      retrieved_at: evidence.retrieved_at,
    },
  };
}

export function RegulatoryEvidenceSection({
  evidence,
  locale,
  className,
  isDangerous = false,
  isHomeopathic: isHomeopathicProp,
}: {
  evidence: RegulatoryEvidence | null;
  locale: "en" | "fr";
  className?: string;
  isDangerous?: boolean;
  isHomeopathic?: boolean;
}) {
  if (!evidence) return null;
  const hasAny =
    evidence.purposes?.length ||
    evidence.doses?.length ||
    evidence.risks?.length;
  if (!hasAny) return null;

  const c = COPY[locale];
  const datasetUrl =
    "https://open.canada.ca/data/en/dataset/ef546c83-43a8-4404-943e-ab324164eeb3";
  const retrieved = new Date(evidence.retrieved_at).toLocaleDateString(
    locale === "fr" ? "fr-CA" : "en-CA",
    { year: "numeric", month: "long" }
  );

  if (isDangerous) {
    return (
      <section
        aria-labelledby="regulatory-evidence-heading"
        className={cn(
          "rounded-2xl border border-border/70 bg-muted/30 p-5",
          className
        )}
      >
        <h2
          id="regulatory-evidence-heading"
          className="text-xl font-semibold text-foreground"
        >
          {c.heading}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {c.dangerousNote}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          <a
            href={datasetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            {c.attribution}
          </a>
          {` — ${c.retrieved} ${retrieved}.`}
        </p>
      </section>
    );
  }

  const isHomeopathic =
    isHomeopathicProp ??
    /\b(homeopath|hom[eé]opath|globule|granule|pellet|organotherapy|dilution)\b/i.test(
      JSON.stringify({ p: evidence.purposes, d: evidence.doses })
    );
  const adultDoses = (evidence.doses ?? []).filter(
    (d) =>
      !isPediatricOnlyOrTaggedDose(d) &&
      !isGarbageOrHomeopathicDose(d, isHomeopathic)
  );
  const filteredRisks = (evidence.risks ?? []).filter(
    (r) => !isCrossContaminatedRisk(evidence.herb_slug, r)
  );

  return (
    <section
      aria-labelledby="regulatory-evidence-heading"
      className={cn(
        "rounded-2xl border border-border/70 bg-muted/30 p-5",
        className
      )}
    >
      <h2
        id="regulatory-evidence-heading"
        className="text-xl font-semibold text-foreground"
      >
        {c.heading}
      </h2>
      <p className="measure mt-2 text-sm leading-relaxed text-muted-foreground">
        {c.intro}
      </p>

      {isHomeopathic && (
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
          {c.homeopathicNote}
        </p>
      )}

      {(() => {
        const lists = (
          <>
            {evidence.purposes?.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-foreground">
                  {c.purposes}
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {evidence.purposes.slice(0, 6).map((p) => (
                    <li
                      key={p}
                      className="border-l-2 border-primary/30 pl-3 text-sm leading-relaxed text-muted-foreground"
                    >
                      {cleanQuotedText(p)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {adultDoses.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-foreground">
                  {c.doses}
                </h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {adultDoses.slice(0, 6).map((d) => (
                    <li
                      key={`${d.text}-${d.population ?? ""}`}
                      className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground"
                    >
                      {formatDoseText(d.text, locale)}
                      {d.population ? ` · ${d.population}` : ""}
                      {typeof d.age_minimum === "number" && d.age_minimum >= 18
                        ? ` · ${d.age_minimum}+`
                        : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {filteredRisks.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-foreground">
                  {c.risks}
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {filteredRisks.slice(0, 5).map((r) => (
                    <li
                      key={r}
                      className="border-l-2 border-amber-500/40 pl-3 text-sm leading-relaxed text-muted-foreground"
                    >
                      {cleanQuotedText(r)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        );
        // On /fr the quoted indications, doses and risk statements stay in
        // their source language; the notice says so and the text opens on
        // demand rather than leading the page in English.
        if (!c.verbatimNote) return lists;
        return (
          <>
            <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              {c.verbatimNote}
            </p>
            <details className="mt-3 rounded-lg border border-border/60">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">
                {c.expandLabel}
              </summary>
              <div className="px-3 pb-1">{lists}</div>
            </details>
          </>
        );
      })()}

      <p className="mt-4 text-xs text-muted-foreground">
        {c.products(evidence.products_sampled)}{" "}
        <a
          href={datasetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          {c.attribution}
        </a>
        {` — ${c.retrieved} ${retrieved}.`}
      </p>
    </section>
  );
}
