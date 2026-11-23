"use client";

export interface NarrativeSectionItem {
  heading: string;
  body: string;
}

export function HerbNarrativeView({
  title,
  sections,
}: {
  title: string;
  sections: NarrativeSectionItem[];
}) {
  return (
    <section aria-labelledby="recorded-facts" className="space-y-5">
      <h2 id="recorded-facts" className="text-xl font-semibold text-foreground">
        {title}
      </h2>
      {sections.map((section) => (
        <div key={section.heading}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {section.heading}
          </h3>
          <p className="measure prose-body mt-1.5 leading-relaxed text-foreground">
            {section.body}
          </p>
        </div>
      ))}
    </section>
  );
}
