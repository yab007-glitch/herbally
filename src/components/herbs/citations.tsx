"use client";

import { ExternalLink, BookOpen, FileText, Globe } from "lucide-react";
import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { getReviewer } from "@/lib/data/reviewers";
import { useTranslations } from "next-intl";

interface Citation {
  source: string;
  title?: string;
  url?: string;
  year?: number;
  pmid?: string;
}

interface CitationsListProps {
  citations: Citation[];
  className?: string;
}

const sourceIcons: Record<string, React.ReactNode> = {
  WHO: <Globe className="size-3" />,
  PubMed: <FileText className="size-3" />,
  "Commission E": <BookOpen className="size-3" />,
  NCCIH: <Globe className="size-3" />,
  EMA: <Globe className="size-3" />,
  default: <BookOpen className="size-3" />,
};

export function CitationsList({ citations, className }: CitationsListProps) {
  const t = useTranslations();

  if (!citations || citations.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground italic", className)}>
        {t("citations.pending")}
      </div>
    );
  }

  return (
    <ul className={cn("space-y-2", className)}>
      {citations.map((citation, index) => {
        const icon = sourceIcons[citation.source] || sourceIcons.default;
        const hasUrl = citation.url || citation.pmid;
        const linkUrl =
          citation.url ||
          (citation.pmid
            ? `https://pubmed.ncbi.nlm.nih.gov/${citation.pmid}/`
            : null);

        return (
          <li key={index} className="flex items-start gap-2 text-sm">
            <span className="mt-0.5 shrink-0 text-muted-foreground">
              {icon}
            </span>
            <div className="flex-1">
              <span className="font-medium">{citation.source}</span>
              {citation.title && <> · {citation.title}</>}
              {citation.year && (
                <span className="text-muted-foreground">
                  {" "}
                  ({citation.year})
                </span>
              )}
              {hasUrl && linkUrl && (
                <a
                  href={linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 inline-flex items-center gap-0.5 text-primary hover:underline"
                >
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// Component for a single inline citation
export function InlineCitation({
  source,
  url,
  pmid,
}: Omit<Citation, "year" | "title">) {
  const linkUrl =
    url || (pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : null);

  if (!linkUrl) {
    return <span className="text-muted-foreground">[{source}]</span>;
  }

  return (
    <a
      href={linkUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
    >
      [{source}]
      <ExternalLink className="size-3" />
    </a>
  );
}

// Component for source attribution block
interface SourceAttributionProps {
  reviewedBy?: string;
  reviewerCredentials?: string;
  lastReviewed?: string;
  sources?: string[];
  className?: string;
}

export function SourceAttribution({
  reviewedBy,
  reviewerCredentials,
  lastReviewed,
  sources,
  className,
}: SourceAttributionProps) {
  const t = useTranslations();
  const reviewer = getReviewer(reviewedBy);

  return (
    <div className={cn("rounded-lg border bg-muted/50 p-4 text-sm", className)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {reviewedBy &&
          (reviewer ? (
            <div className="min-w-0">
              <span className="text-muted-foreground">
                {t("citations.reviewedBy")}
              </span>
              <a
                href={reviewer.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground hover:text-primary hover:underline"
              >
                {reviewer.name}
              </a>
              <span className="text-muted-foreground">
                {" "}
                — {reviewer.credentials}
              </span>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <GraduationCap className="size-3" />
                  {reviewer.affiliation}
                </span>
                {reviewer.researchUrl && (
                  <a
                    href={reviewer.researchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <ExternalLink className="size-3" />
                    {t("citations.researchProfile")}
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div>
              <span className="text-muted-foreground">
                {t("citations.reviewedBy")}
              </span>
              <span className="font-medium">{reviewedBy}</span>
              {reviewerCredentials && (
                <span className="text-muted-foreground">
                  , {reviewerCredentials}
                </span>
              )}
            </div>
          ))}
        {lastReviewed && (
          <div>
            <span className="text-muted-foreground">
              {t("citations.lastUpdated")}
            </span>
            <span className="font-medium">{lastReviewed}</span>
          </div>
        )}
      </div>

      {sources && sources.length > 0 && (
        <div className="mt-2 pt-2 border-t">
          <span className="text-muted-foreground">
            {t("citations.sources")}
          </span>
          <span className="text-muted-foreground">{sources.join(" · ")}</span>
        </div>
      )}
    </div>
  );
}
