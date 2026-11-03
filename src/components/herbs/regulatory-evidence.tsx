import { cn } from "@/lib/utils";

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
      "Quoted from product licences issued by Health Canada. These are the words on licensed products, not medical advice.",
    purposes: "Indications on record",
    doses: "Doses used",
    risks: "Risk statements",
    products: (n: number) =>
      `Drawn from ${n} licensed product${n === 1 ? "" : "s"}.`,
    attribution: "Health Canada, Licensed Natural Health Products Database",
    retrieved: "retrieved",
  },
  fr: {
    heading: "Ce que déclarent les produits homologués",
    intro:
      "Citations tirées de licences de produits délivrées par Santé Canada. Ce sont les mentions des produits homologués, et non un avis médical.",
    purposes: "Indications au dossier",
    doses: "Doses utilisées",
    risks: "Mentions de risque",
    products: (n: number) =>
      `Tiré de ${n} produit${n === 1 ? "" : "s"} homologué${n === 1 ? "" : "s"}.`,
    attribution:
      "Santé Canada, Base de données des produits de santé naturels homologués",
    retrieved: "consultée le",
  },
} as const;

export function RegulatoryEvidenceSection({
  evidence,
  locale,
  className,
}: {
  evidence: RegulatoryEvidence | null;
  locale: "en" | "fr";
  className?: string;
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
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {evidence.doses?.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-foreground">{c.doses}</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {evidence.doses.slice(0, 6).map((d) => (
              <li
                key={`${d.text}-${d.population ?? ""}`}
                className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground"
              >
                {d.text}
                {d.population ? ` · ${d.population}` : ""}
                {typeof d.age_minimum === "number" && d.age_minimum > 0
                  ? ` · ${d.age_minimum}+`
                  : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {evidence.risks?.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-foreground">{c.risks}</h3>
          <ul className="mt-2 space-y-1.5">
            {evidence.risks.slice(0, 5).map((r) => (
              <li
                key={r}
                className="border-l-2 border-amber-500/40 pl-3 text-sm leading-relaxed text-muted-foreground"
              >
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

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
