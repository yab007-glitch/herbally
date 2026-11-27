"use client";

import {
  ExternalLink,
  FileText,
  FlaskConical,
  ShieldAlert,
  Pill,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { stripPediatricDosageSentences } from "@/lib/herbs/regulatory-evidence";
import { classifyStudyEvidenceType } from "@/lib/herbs/evidence-type";
import type {
  Citation,
  SheetContent,
} from "@/components/herbs/pubmed-monograph-sheet";

const levelColor: Record<string, string> = {
  A: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  B: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  C: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  D: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
        {icon}
        {title}
      </h3>
      <div className="measure prose-body leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function hasData(s: string | undefined): boolean {
  return (
    !!s && s.trim().length > 0 && !/^no pubmed data available/i.test(s.trim())
  );
}

export function PubmedMonographSheetView({
  content,
  citations,
  articleCount,
  status,
  isDangerous = false,
}: {
  content: SheetContent;
  citations: Citation[];
  articleCount: number;
  status: string | null;
  isDangerous?: boolean;
}) {
  const t = useTranslations("pubmedSheet");
  const locale = useLocale();
  const reviewed = status === "reviewed";
  const safeAdultDosageText = hasData(content.dosageAndAdministration)
    ? stripPediatricDosageSentences(content.dosageAndAdministration)
    : "";
  const safeText = (val: string | undefined) =>
    hasData(val) ? stripPediatricDosageSentences(val) : "";
  const summaryText = safeText(content.summary);
  const backgroundText = safeText(content.background);
  const traditionalUsesText = isDangerous
    ? ""
    : safeText(content.traditionalUses);
  const activeCompoundsText = safeText(content.activeCompounds);
  const mechanismText = safeText(content.mechanismOfAction);
  const safetyText = safeText(content.safetyAndAdverseEffects);
  const pregnancyText = safeText(content.pregnancyAndLactation);
  const interactionsText = safeText(content.drugInteractions);
  const evidenceSummaryText = safeText(content.evidenceSummary);
  const effectiveArticleCount =
    citations.length > 0 ? citations.length : articleCount;

  const researchBody = (
    <div className="space-y-6">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-800 dark:bg-blue-950/30">
        <div className="flex items-start gap-2">
          <FileText
            className="mt-0.5 size-4 shrink-0 text-blue-600"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <span className="inline-block rounded-full border border-blue-300 bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-blue-900 dark:border-blue-700 dark:bg-blue-950/60 dark:text-blue-200">
              {reviewed
                ? locale === "fr"
                  ? "Section PubMed supplémentaire · Relue par un humain"
                  : "Supplemental PubMed summary · Human-reviewed"
                : locale === "fr"
                  ? "Section PubMed supplémentaire par IA · Non relue par un humain"
                  : "Supplemental AI research summary · Not human-reviewed"}
            </span>
            <p className="font-medium text-blue-900 dark:text-blue-100">
              {reviewed ? t("reviewedTitle") : t("compiledTitle")}
            </p>
            <p className="text-blue-800 dark:text-blue-200">
              {reviewed ? t("reviewedBody") : t("compiledBody")}
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              {t("compiledFrom", { count: effectiveArticleCount })}
            </p>
          </div>
        </div>
      </div>

      {summaryText.length > 0 && (
        <Section
          icon={<FileText className="size-4 text-primary" />}
          title={t("summary")}
        >
          {summaryText}
        </Section>
      )}
      {backgroundText.length > 0 && (
        <Section
          icon={<FileText className="size-4 text-primary" />}
          title={t("background")}
        >
          {backgroundText}
        </Section>
      )}
      {traditionalUsesText.length > 0 && (
        <Section
          icon={<FileText className="size-4 text-primary" />}
          title={t("traditionalUses")}
        >
          {traditionalUsesText}
        </Section>
      )}
      {activeCompoundsText.length > 0 && (
        <Section
          icon={<FlaskConical className="size-4 text-primary" />}
          title={t("activeCompounds")}
        >
          {activeCompoundsText}
        </Section>
      )}
      {mechanismText.length > 0 && (
        <Section
          icon={<FlaskConical className="size-4 text-primary" />}
          title={t("mechanism")}
        >
          {mechanismText}
        </Section>
      )}

      {content.clinicalEvidence && content.clinicalEvidence.length > 0 && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <FlaskConical className="size-4 text-primary" />
            {isDangerous
              ? locale === "fr"
                ? "Résultats de recherche — aucune preuve d'usage médicinal sûr"
                : "Research findings — not evidence of safe medicinal use"
              : t("clinicalEvidence")}
          </h3>
          {isDangerous && (
            <p
              role="note"
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
            >
              {locale === "fr"
                ? "Contexte toxicologique / expérimental uniquement : ces travaux précliniques ou de laboratoire n'autorisent aucun usage humain."
                : "Toxicological / experimental literature only — laboratory or preclinical findings do not represent safe or usable human treatment."}
            </p>
          )}
          {!reviewed && (
            <p className="rounded-lg border border-amber-300/70 bg-amber-50/70 px-3 py-2 text-xs text-amber-900 dark:border-amber-700/70 dark:bg-amber-950/30 dark:text-amber-200">
              {locale === "fr"
                ? "Notes provisoires : dans les fiches générées par IA non révisées, les niveaux d'étude peuvent inclure des études précliniques ou synthèses narratives jusqu'à validation humaine."
                : "Provisional grades: study grades in unreviewed AI-compiled drafts may reflect preclinical or review papers until human-reviewed."}
            </p>
          )}
          <div className="space-y-3">
            {content.clinicalEvidence.map((e, i) => {
              const condText = safeText(e.condition);
              const findingText = safeText(e.finding);
              if (!condText && !findingText) return null;
              const studyType = classifyStudyEvidenceType(
                condText,
                findingText,
                e.evidenceLevel
              );
              const hideMisleadingAnecdotalD =
                e.evidenceLevel === "D" &&
                studyType.type !== "anecdotal" &&
                studyType.type !== "traditional_historical";
              return (
                <div key={i} className="rounded-lg border bg-muted/30 p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground">
                      {locale === "fr" ? studyType.labelFr : studyType.labelEn}
                    </span>
                    {e.evidenceLevel && !hideMisleadingAnecdotalD && (
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${levelColor[e.evidenceLevel] ?? levelColor.D}`}
                      >
                        {t(`level.${e.evidenceLevel}`)}
                      </span>
                    )}
                    <span className="font-medium text-foreground">
                      {condText}
                    </span>
                  </div>
                  {findingText && (
                    <p className="text-sm text-muted-foreground">
                      {findingText}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {safetyText.length > 0 && (
        <Section
          icon={<ShieldAlert className="size-4 text-primary" />}
          title={t("safety")}
        >
          {safetyText}
        </Section>
      )}
      {pregnancyText.length > 0 && (
        <Section
          icon={<ShieldAlert className="size-4 text-primary" />}
          title={t("pregnancy")}
        >
          {pregnancyText}
        </Section>
      )}
      {interactionsText.length > 0 && (
        <Section
          icon={<ShieldAlert className="size-4 text-primary" />}
          title={t("interactions")}
        >
          {interactionsText}
        </Section>
      )}
      {!isDangerous && safeAdultDosageText.length > 0 && (
        <Section
          icon={<Pill className="size-4 text-primary" />}
          title={t("dosage")}
        >
          {safeAdultDosageText}
        </Section>
      )}
      {evidenceSummaryText.length > 0 && (
        <Section
          icon={<FileText className="size-4 text-primary" />}
          title={t("evidenceSummary")}
        >
          {evidenceSummaryText}
        </Section>
      )}

      {citations.length > 0 && (
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <FileText className="size-4 text-primary" />
            {t("citations")}
          </h3>
          <ol className="space-y-1.5 text-sm">
            {citations.map((c, i) => (
              <li key={c.pmid ?? i} className="flex items-start gap-2">
                <span className="shrink-0 text-muted-foreground">{i + 1}.</span>
                <span>
                  {c.url ? (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      PMID: {c.pmid}
                      <ExternalLink className="ml-1 inline size-3" />
                    </a>
                  ) : (
                    <span>PMID: {c.pmid}</span>
                  )}
                  {c.year && (
                    <span className="text-muted-foreground"> ({c.year})</span>
                  )}
                  {c.title && (
                    <span className="text-muted-foreground"> — {c.title}</span>
                  )}
                  {c.journal && (
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      · {c.journal}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );

  return (
    <article className="space-y-6">
      {locale === "fr" && (
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          {t("languageNote")}
        </p>
      )}
      {isDangerous ? (
        <div className="space-y-4">
          <div
            role="alert"
            className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
          >
            <p className="font-semibold">
              {locale === "fr"
                ? "Quarantaine toxicologique : aucune utilisation thérapeutique ni posologie autorisée"
                : "Toxicology quarantine: no therapeutic or dosing guidance displayed"}
            </p>
            <p className="mt-1 text-xs">
              {locale === "fr"
                ? "En cas d'exposition : Centre antipoison (Canada) 1-844-764-7669 · États-Unis 1-800-222-1222 · Urgences 911."
                : "If exposed: Poison Control (US) 1-800-222-1222 · Poison Control (Canada) 1-844-764-7669 · Emergency 911."}
            </p>
          </div>
          <details className="rounded-xl border border-border bg-muted/20">
            <summary className="flex min-h-11 cursor-pointer items-center px-4 py-3 text-sm font-medium text-foreground">
              {locale === "fr"
                ? "Littérature toxicologique et de laboratoire archivée (repliée — aucune preuve d'usage médicinal sûr)"
                : "Archived Toxicology & Laboratory Literature (Collapsed — Not Evidence of Safe Medicinal Use)"}
            </summary>
            <div className="px-4 pb-4">{researchBody}</div>
          </details>
        </div>
      ) : (
        researchBody
      )}
    </article>
  );
}
