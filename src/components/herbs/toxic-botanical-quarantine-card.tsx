import { AlertTriangle, ExternalLink, Phone } from "lucide-react";
import {
  getDangerousHerb,
  getDangerousHerbParts,
} from "@/lib/data/dangerous-herbs";
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
  const hazards = (contraindications ?? []).filter(
    (item): item is string =>
      Boolean(item) &&
      !/\b(pregnancy|pregnant|breastfeeding|nursing|grossesse|allaitement)\b/i.test(
        item
      )
  );
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
        <div className="flex flex-wrap items-center justify-between gap-2">
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
          <span className="rounded-full border border-red-300 bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-900 dark:border-red-800 dark:bg-red-950/70 dark:text-red-200">
            {fr ? "Quarantaine permanente" : "Permanent Quarantine"}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-foreground">
          {fr
            ? "Aucun usage thérapeutique, aucune référence posologique, aucune indication clinique et aucune voie d'automédication ne sont présentés pour les plantes toxiques en quarantaine permanente."
            : "No therapeutic use, dosing reference, clinical indication, or self-administration pathway is provided for permanently quarantined toxic plants."}
        </p>
      </div>

      {/* Dedicated Immediate Emergency Action Area (Mobile tap-to-call first) */}
      <div
        role="alert"
        aria-labelledby="toxic-emergency-actions-heading"
        className="space-y-3 rounded-xl border-2 border-destructive/60 bg-destructive/10 p-4"
      >
        <p
          id="toxic-emergency-actions-heading"
          className="flex items-center gap-1.5 text-sm font-bold text-destructive"
        >
          <Phone className="size-4 shrink-0" aria-hidden="true" />
          <span>
            {fr
              ? "Urgence — En cas d'ingestion ou d'exposition suspectée :"
              : "Emergency — If ingested or exposure is suspected:"}
          </span>
        </p>

        <div className="grid gap-2.5 sm:grid-cols-3">
          <a
            href="tel:911"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-red-800 dark:bg-red-600 dark:text-white dark:hover:bg-red-500"
          >
            <Phone className="size-4 shrink-0" aria-hidden="true" />
            <span>{fr ? "Appeler le 911" : "Call 911 (Emergency)"}</span>
          </a>
          <a
            href="tel:+18002221222"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border-2 border-destructive/60 bg-background px-3 py-2 text-xs font-bold text-destructive transition-colors hover:bg-destructive/10 sm:text-sm"
          >
            <Phone className="size-3.5 shrink-0" aria-hidden="true" />
            <span>
              {fr
                ? "Centre antipoison (É.-U.) : 1-800-222-1222"
                : "US Poison Control: 1-800-222-1222"}
            </span>
          </a>
          <a
            href="tel:+18447647669"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border-2 border-destructive/60 bg-background px-3 py-2 text-xs font-bold text-destructive transition-colors hover:bg-destructive/10 sm:text-sm"
          >
            <Phone className="size-3.5 shrink-0" aria-hidden="true" />
            <span>
              {fr
                ? "Centre antipoison (Canada) : 1-844-764-7669"
                : "Canada Poison Control: 1-844-764-7669"}
            </span>
          </a>
        </div>

        <p className="text-xs font-medium text-foreground">
          {fr ? (
            <>
              Centre antipoison (Canada) : 1-844-764-7669 (
              <a
                href="https://infopoison.ca"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                infopoison.ca
              </a>
              ) · Centre antipoison (É.-U.) : 1-800-222-1222 (
              <a
                href="https://www.poison.org"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                poison.org
              </a>
              ) · Urgence : 911
            </>
          ) : (
            <>
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
              ) · Emergency: 911
            </>
          )}
        </p>

        <dl className="grid gap-2 border-t border-destructive/25 pt-3 text-xs sm:grid-cols-3">
          <div className="rounded-lg bg-background/80 p-2.5">
            <dt className="font-semibold text-foreground">
              {fr ? "Ingestion" : "If swallowed"}
            </dt>
            <dd className="mt-0.5 text-muted-foreground">
              {fr
                ? "Appelez immédiatement le 911 ou le centre antipoison. Ne provoquez pas de vomissements sans consigne médicale."
                : "Call Poison Control or 911 immediately. Do not induce vomiting unless directed by poison specialists."}
            </dd>
          </div>
          <div className="rounded-lg bg-background/80 p-2.5">
            <dt className="font-semibold text-foreground">
              {fr ? "Contact cutané" : "Skin contact"}
            </dt>
            <dd className="mt-0.5 text-muted-foreground">
              {fr
                ? "Retirez les vêtements contaminés et rincez abondamment la peau à l'eau pendant 15 minutes."
                : "Remove contaminated clothing and rinse exposed skin thoroughly with running water for 15 minutes."}
            </dd>
          </div>
          <div className="rounded-lg bg-background/80 p-2.5">
            <dt className="font-semibold text-foreground">
              {fr ? "Exposition oculaire" : "Eye exposure"}
            </dt>
            <dd className="mt-0.5 text-muted-foreground">
              {fr
                ? "Rincez délicatement les yeux à l'eau tiède pendant 15 minutes et consultez immédiatement en urgence."
                : "Flush eyes gently with lukewarm water for 15 minutes and seek immediate emergency medical evaluation."}
            </dd>
          </div>
        </dl>
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
              ? `Parties concernées : ${getDangerousHerbParts(info, "fr")}.`
              : `Affected botanical parts: ${getDangerousHerbParts(info, "en")}.`}
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
