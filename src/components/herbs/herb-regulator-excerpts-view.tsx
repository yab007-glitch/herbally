"use client";

import { NccihSummary } from "@/components/herbs/nccih-summary";

export interface RegulatorExcerptItem {
  key: string;
  id: string;
  claims: Array<string | { text?: string; section?: string }>;
  safety: string[];
  url: string | null;
  heading: string;
  sourceLabel: string;
  licenceText: string;
  claimsHeading: string;
  safetyHeading: string;
  notice: string | null;
  renderAs: "list" | "prose";
  collapsible: boolean;
}

export function HerbRegulatorExcerptsView({
  herbName,
  items,
  verbatimNote,
  expandLabel,
  reproducedLabel,
  collapseSummary,
}: {
  herbName: string;
  items: RegulatorExcerptItem[];
  verbatimNote: string | null;
  expandLabel: string;
  reproducedLabel: string;
  collapseSummary?: string;
}) {
  if (items.length === 0) return null;

  return (
    <>
      {items.map((item) => (
        <NccihSummary
          key={item.key}
          id={item.id}
          claims={item.claims}
          safety={item.safety}
          url={item.url}
          title={herbName}
          notice={item.notice}
          renderAs={item.renderAs}
          verbatimNote={verbatimNote}
          expandLabel={expandLabel}
          reproducedLabel={reproducedLabel}
          collapsible={item.collapsible}
          collapseSummary={item.collapsible ? collapseSummary : undefined}
          heading={item.heading}
          sourceLabel={item.sourceLabel}
          licenceText={item.licenceText}
          claimsHeading={item.claimsHeading}
          safetyHeading={item.safetyHeading}
        />
      ))}
    </>
  );
}
