import { AlertTriangle, ExternalLink, Phone } from "lucide-react";
import { getDangerousHerb } from "@/lib/data/dangerous-herbs";
import { cleanQuotedText } from "@/lib/herbs/clean-quote";
import { stripFieldLabels } from "@/lib/herbs/clean-faq";

interface ToxicBotanicalQuarantineCardProps {
  slug: string;
  scientificName: string;
  contraindications?: string[] | null;
  sideEffects?: string[] | null;
  locale: "en" | "fr";
}

/**
 * Dedicated toxicology-only quarantine panel rendered for permanently
 * quarantined lethal or severely toxic plants. Excludes pregnancy/nursing
 * supplement alerts, medication-checker CTAs, dosing guidance, and general
 * wellness copy.
 */
export function ToxicBotanicalQuarantineCard({
  slug,
  scientificName,
  contraindications,
  sideEffects,
  locale,
}: ToxicBotanicalQuarantineCardProps) {
  const fr = locale === "fr";
  const info = getDangerousHerb(slug);
  const hazards = contraindications?.filter(Boolean) ?? [];
  const manifestations = sideEffects?.filter(Boolean) ?? [];

  const pubmedToxicologyUrl = `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(
    `${scientificName} toxicity`
  )}`;
  const pubchemUrl = `https://pubchem.ncbi.nlm.nih.gov/#query=${encodeURIComponent(
    scientificName
  )}`;

  return (
    <section
      aria-labelledby="toxic-quarantine-heading"
      className="space-y-5 rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-5 sm:p-6"
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
          <h2
            id="toxic-quarantine-heading"
            className="text-xl font-bold tracking-tight text-foreground"
          >
            {fr
              ? "Toxicologie et quarantaine d'urgence"
              : "Toxicology & Emergency Quarantine"}
          </h2>
        </div>
        <p className="text-sm leading-relaxed text-foreground">
          {fr
            ? "Aucun usage thérapeutique, aucune référence posologique, aucune recommandation pendant la grossesse ou l'allaitement et aucune voie d'automédication ne sont présentés pour les plantes toxiques en quarantaine permanente."
            : "No therapeutic use, dosing reference, pregnancy/lactation recommendation, or self-administration pathway is provided for permanently quarantined toxic plants."}
        </p>
      </div>

      {info && (
        <div className="rounded-xl border border-destructive/30 bg-background/80 p-4 text-sm">
          <p className="font-semibold text-foreground">
            {fr ? "Mécanisme et parties toxiques" : "Toxic Hazard Profile"}
          </p>
          <p className="mt-1 text-muted-foreground">
            {fr ? info.reasonFr : info.reason}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {fr
              ? `Parties concernées : ${info.parts}.`
              : `Affected botanical parts: ${info.parts}.`}
          </p>
        </div>
      )}

      {hazards.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            {fr
              ? "Dangers toxicologiques documentés"
              : "Documented Toxicity & Hazards"}
          </h3>
          <ul className="space-y-1.5">
            {hazards.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                <span
                  className="mt-2 size-1.5 shrink-0 rounded-full bg-destructive"
                  aria-hidden="true"
                />
                <span>{cleanQuotedText(stripFieldLabels(item))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {manifestations.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            {fr
              ? "Manifestations toxiques signalées"
              : "Reported Toxic Effects"}
          </h3>
          <ul className="space-y-1.5">
            {manifestations.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                <span
                  className="mt-2 size-1.5 shrink-0 rounded-full bg-destructive/70"
                  aria-hidden="true"
                />
                <span>{cleanQuotedText(stripFieldLabels(item))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div
        role="alert"
        className="space-y-2 rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-xs text-destructive"
      >
        <p className="flex items-center gap-1.5 font-bold">
          <Phone className="size-4 shrink-0" aria-hidden="true" />
          <span>
            {fr
              ? "En cas d'ingestion ou d'exposition suspectée :"
              : "If ingested or exposure is suspected:"}
          </span>
        </p>
        <p className="font-medium">
          Poison Control (US): 1-800-222-1222 (
          <a
            href="https://www.poison.org"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            poison.org
          </a>
          ) · Poison Control (Canada): 1-844-764-7669 (
          <a
            href="https://infopoison.ca"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            infopoison.ca
          </a>
          ) · {fr ? "Urgence : 911" : "Emergency: 911"}
        </p>
      </div>

      <div className="space-y-2 border-t border-destructive/20 pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {fr
            ? "Références toxicologiques primaires"
            : "Authoritative Toxicology References"}
        </h3>
        <div className="flex flex-wrap gap-3 text-xs">
          <a
            href={pubmedToxicologyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-4"
          >
            {fr
              ? "Littérature toxicologique PubMed"
              : "PubMed Toxicology Literature"}
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
          <a
            href={pubchemUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-4"
          >
            {fr
              ? "Fiche chimique et toxicologique NIH PubChem"
              : "NIH PubChem Chemical & Toxicology Record"}
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}
