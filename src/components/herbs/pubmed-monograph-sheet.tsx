import {
  ExternalLink,
  FileText,
  FlaskConical,
  ShieldAlert,
  Pill,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

/**
 * Renders a PubMed-compiled information sheet on a herb page (for herbs with
 * no hand-written monograph). The sheet is AI-assisted but every claim is cited
 * to a real PubMed article; the source list is published with the sheet. The
 * provenance line is explicit so this is never mistaken for human-reviewed.
 */

export interface ClinicalEvidence {
  condition?: string;
  finding?: string;
  evidenceLevel?: string;
  pmids?: string[];
}
export interface SheetContent {
  title?: string;
  summary?: string;
  background?: string;
  traditionalUses?: string;
  activeCompounds?: string;
  mechanismOfAction?: string;
  clinicalEvidence?: ClinicalEvidence[];
  safetyAndAdverseEffects?: string;
  pregnancyAndLactation?: string;
  drugInteractions?: string;
  dosageAndAdministration?: string;
  evidenceSummary?: string;
}
export interface Citation {
  pmid?: string;
  title?: string;
  journal?: string;
  year?: string | null;
  pubtype?: string[];
  url?: string;
  evidenceLevel?: string;
}
interface Props {
  content: SheetContent;
  citations: Citation[];
  articleCount: number;
  model: string | null;
  status: string | null;
}

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
      <div className="text-sm leading-relaxed text-muted-foreground">
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

export async function PubmedMonographSheet({
  content,
  citations,
  articleCount,
  model,
  status,
}: Props) {
  const t = await getTranslations("pubmedSheet");
  const reviewed = status === "reviewed";

  return (
    <article className="space-y-6">
      {/* Provenance line */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-800 dark:bg-blue-950/30">
        <div className="flex items-start gap-2">
          <FileText
            className="mt-0.5 size-4 shrink-0 text-blue-600"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <p className="font-medium text-blue-900 dark:text-blue-100">
              {reviewed ? t("reviewedTitle") : t("compiledTitle")}
            </p>
            <p className="text-blue-800 dark:text-blue-200">
              {reviewed ? t("reviewedBody") : t("compiledBody")}
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              {t("compiledFrom", { count: articleCount, model: model ?? "AI" })}
            </p>
          </div>
        </div>
      </div>

      {hasData(content.summary) && (
        <Section
          icon={<FileText className="size-4 text-primary" />}
          title={t("summary")}
        >
          {content.summary}
        </Section>
      )}
      {hasData(content.background) && (
        <Section
          icon={<FileText className="size-4 text-primary" />}
          title={t("background")}
        >
          {content.background}
        </Section>
      )}
      {hasData(content.traditionalUses) && (
        <Section
          icon={<FileText className="size-4 text-primary" />}
          title={t("traditionalUses")}
        >
          {content.traditionalUses}
        </Section>
      )}
      {hasData(content.activeCompounds) && (
        <Section
          icon={<FlaskConical className="size-4 text-primary" />}
          title={t("activeCompounds")}
        >
          {content.activeCompounds}
        </Section>
      )}
      {hasData(content.mechanismOfAction) && (
        <Section
          icon={<FlaskConical className="size-4 text-primary" />}
          title={t("mechanism")}
        >
          {content.mechanismOfAction}
        </Section>
      )}

      {content.clinicalEvidence && content.clinicalEvidence.length > 0 && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <FlaskConical className="size-4 text-primary" />
            {t("clinicalEvidence")}
          </h3>
          <div className="space-y-3">
            {content.clinicalEvidence.map((e, i) => (
              <div key={i} className="rounded-lg border bg-muted/30 p-3">
                <div className="mb-1 flex items-center gap-2">
                  {e.evidenceLevel && (
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${levelColor[e.evidenceLevel] ?? levelColor.D}`}
                    >
                      {t(`level.${e.evidenceLevel}`)}
                    </span>
                  )}
                  <span className="font-medium text-foreground">
                    {e.condition}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{e.finding}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {hasData(content.safetyAndAdverseEffects) && (
        <Section
          icon={<ShieldAlert className="size-4 text-primary" />}
          title={t("safety")}
        >
          {content.safetyAndAdverseEffects}
        </Section>
      )}
      {hasData(content.pregnancyAndLactation) && (
        <Section
          icon={<ShieldAlert className="size-4 text-primary" />}
          title={t("pregnancy")}
        >
          {content.pregnancyAndLactation}
        </Section>
      )}
      {hasData(content.drugInteractions) && (
        <Section
          icon={<ShieldAlert className="size-4 text-primary" />}
          title={t("interactions")}
        >
          {content.drugInteractions}
        </Section>
      )}
      {hasData(content.dosageAndAdministration) && (
        <Section
          icon={<Pill className="size-4 text-primary" />}
          title={t("dosage")}
        >
          {content.dosageAndAdministration}
        </Section>
      )}
      {hasData(content.evidenceSummary) && (
        <Section
          icon={<FileText className="size-4 text-primary" />}
          title={t("evidenceSummary")}
        >
          {content.evidenceSummary}
        </Section>
      )}

      {/* Citations */}
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
    </article>
  );
}
