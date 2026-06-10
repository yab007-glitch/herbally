"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import type { ComponentPropsWithoutRef } from "react";
import { remarkHerbAlly } from "@/lib/chat/enrichment";
import { EvidenceGradeBadge } from "@/components/herbs/evidence-grade";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Leaf, PillBottle } from "lucide-react";

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

/**
 * ChatMarkdown — ReactMarkdown wrapper that:
 *   - runs remarkHerbAlly to enrich the AST (PMID links, evidence pills, interaction cards)
 *   - provides a `components` map that styles the enriched nodes
 *
 * The enricher writes data attributes (data-pmid, data-evidence-level, data-interaction*)
 * into mdast `hProperties`; react-markdown's `components` map receives them as
 * `node.properties` and we pick them up via the spread props.
 */
export function ChatMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkHerbAlly]} components={components}>
      {children}
    </ReactMarkdown>
  );
}

const components: Components = {
  a({ href, title, children, ...rest }: ComponentPropsWithoutRef<"a">) {
    const isExternal = !!href && /^https?:\/\//.test(href);
    return (
      <a
        href={href}
        title={title}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noopener noreferrer" : undefined}
        className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
        {...rest}
      >
        {children}
        {isExternal && (
          <ExternalLink
            className="ml-0.5 inline size-3 align-baseline"
            aria-hidden="true"
          />
        )}
      </a>
    );
  },

  // The enricher leaves PMID:NNN text inside a custom <a data-pmid="NNN">,
  // which react-markdown renders via the `a` component above. We additionally
  // style those with a small PubMed pill icon.
  // (handled by the `a` override; PMID links get the ExternalLink icon automatically)

  // Intercept paragraphs that the enricher marked as interaction lines.
  p({
    children,
    node,
    ...rest
  }: ComponentPropsWithoutRef<"p"> & { node?: unknown }) {
    const props = ((node as { properties?: Record<string, string> } | undefined)
      ?.properties ?? {}) as Record<string, string>;
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
            <PillBottle className="size-3.5 text-blue-600" aria-hidden="true" />
            {drug}
          </span>
          <span className="text-muted-foreground">→</span>
          <Badge className={`${style.bg} ${style.text} border-current/20`}>
            {style.label}
          </Badge>
        </div>
      );
    }
    return <p {...rest}>{children}</p>;
  },

  // Intercept strong nodes the enricher marked as evidence levels.
  strong({
    children,
    node,
    ...rest
  }: ComponentPropsWithoutRef<"strong"> & { node?: unknown }) {
    const props = ((node as { properties?: Record<string, string> } | undefined)
      ?.properties ?? {}) as Record<string, string>;
    const level = props["data-evidence-level"] as EvidenceLevel | undefined;
    if (level) {
      const grade = EVIDENCE_TO_GRADE[level];
      return (
        <span className="mx-1 inline-flex align-middle">
          <EvidenceGradeBadge level={grade} />
        </span>
      );
    }
    return <strong {...rest}>{children}</strong>;
  },

  // Suppress the default link icon for the inline evidence rendering path.
};

export default ChatMarkdown;
