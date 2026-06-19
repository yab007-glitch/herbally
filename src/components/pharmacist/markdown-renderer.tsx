"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import type { ComponentPropsWithoutRef } from "react";
import { remarkHerbAlly } from "@/lib/chat/enrichment";
import { EvidenceGradeBadge } from "@/components/herbs/evidence-grade";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Leaf, PillBottle, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";

type EvidenceLevel = "strong" | "moderate" | "limited" | "traditional";
type InteractionSeverity = "mild" | "moderate" | "severe" | "contraindicated";

const EVIDENCE_TO_GRADE: Record<EvidenceLevel, "A" | "B" | "C" | "D" | "trad"> =
  {
    strong: "A",
    moderate: "B",
    limited: "D",
    traditional: "trad",
  };

const SEVERITY_STYLES: Record<
  InteractionSeverity,
  { label: string; bg: string; text: string; border: string }
> = {
  contraindicated: {
    label: "Contraindicated",
    bg: "bg-red-100 dark:bg-red-950/50",
    text: "text-red-800 dark:text-red-300",
    border: "border-red-300 dark:border-red-800",
  },
  severe: {
    label: "Severe",
    bg: "bg-orange-100 dark:bg-orange-950/50",
    text: "text-orange-800 dark:text-orange-300",
    border: "border-orange-300 dark:border-orange-800",
  },
  moderate: {
    label: "Moderate",
    bg: "bg-amber-100 dark:bg-amber-950/50",
    text: "text-amber-800 dark:text-amber-300",
    border: "border-amber-300 dark:border-amber-800",
  },
  mild: {
    label: "Mild",
    bg: "bg-yellow-50 dark:bg-yellow-950/30",
    text: "text-yellow-800 dark:text-yellow-300",
    border: "border-yellow-300 dark:border-yellow-800",
  },
};

function isPmidLink(href: string | undefined): boolean {
  return !!href && /pubmed\.ncbi\.nlm\.nih\.gov\/\d+/.test(href);
}

export function ChatMarkdown({ children }: { children: string }) {
  const t = useTranslations();

  const components: Components = {
    a({
      href,
      title,
      children: linkChildren,
      ...rest
    }: ComponentPropsWithoutRef<"a">) {
      const isExternal = !!href && /^https?:\/\//.test(href);
      const isPmid = isPmidLink(href);
      return (
        <a
          href={href}
          title={title}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
          className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
          {...rest}
        >
          {linkChildren}
          {isExternal && !isPmid && (
            <ExternalLink
              className="ml-0.5 inline size-3 align-baseline"
              aria-hidden="true"
            />
          )}
          {isPmid && (
            <span
              className="ml-1 inline-flex items-center gap-0.5 rounded bg-amber-100 dark:bg-amber-950/30 px-1 py-px text-[10px] text-amber-700 dark:text-amber-400"
              title="AI-generated citation — verify on PubMed"
            >
              <AlertCircle className="size-2.5" aria-hidden="true" />
              {t("common.verifyCitation")}
            </span>
          )}
        </a>
      );
    },

    p({ children: pChildren, ...rest }: ComponentPropsWithoutRef<"p">) {
      // remarkHerbAlly sets data-* attributes via hProperties; react-markdown
      // passes them through as HTML props (no `node` access needed in v10).
      const props = rest as Record<string, string | undefined>;
      if (props["data-interaction"] === "true") {
        const herb = props["data-interaction-herb"] ?? "";
        const drug = props["data-interaction-drug"] ?? "";
        const sev = (props["data-interaction-severity"] ??
          "mild") as InteractionSeverity;
        const style = SEVERITY_STYLES[sev] ?? SEVERITY_STYLES.mild;
        return (
          <div
            className={`my-2 flex flex-wrap items-center gap-2 rounded-md border ${style.border} ${style.bg} px-3 py-2 text-sm`}
          >
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Leaf className="size-3.5 text-green-600" aria-hidden="true" />
              {herb}
            </span>
            <span className="text-muted-foreground">+</span>
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <PillBottle
                className="size-3.5 text-blue-600"
                aria-hidden="true"
              />
              {drug}
            </span>
            <span className="text-muted-foreground">→</span>
            <Badge className={`${style.bg} ${style.text} border-current/20`}>
              {style.label}
            </Badge>
          </div>
        );
      }
      return <p {...rest}>{pChildren}</p>;
    },

    strong({
      children: strongChildren,
      ...rest
    }: ComponentPropsWithoutRef<"strong">) {
      const props = rest as Record<string, string | undefined>;
      const level = props["data-evidence-level"] as EvidenceLevel | undefined;
      if (level) {
        const grade = EVIDENCE_TO_GRADE[level];
        return (
          <span className="mx-1 inline-flex align-middle">
            <EvidenceGradeBadge level={grade} />
          </span>
        );
      }
      return <strong {...rest}>{strongChildren}</strong>;
    },
  };

  return (
    <ReactMarkdown remarkPlugins={[remarkHerbAlly]} components={components}>
      {children}
    </ReactMarkdown>
  );
}

export default ChatMarkdown;
