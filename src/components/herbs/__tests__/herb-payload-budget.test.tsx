import type { ComponentProps, ReactNode } from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import en from "@/lib/i18n/dictionaries/en.json";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    width,
    height,
    className,
    loading,
    fetchPriority,
  }: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    className?: string;
    loading?: string;
    fetchPriority?: string;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading={loading as "eager" | "lazy" | undefined}
      fetchPriority={fetchPriority as "high" | "low" | "auto" | undefined}
    />
  ),
}));

vi.mock("@/lib/garden/streaks", () => ({
  recordHerbExplored: vi.fn(),
}));

import { HerbSchema } from "@/components/seo/herb-schema";
import { HerbFAQSchema } from "@/components/seo/herb-faq-schema";
import { HerbHeroV2 } from "@/components/herbs/herb-hero-v2";
import { AuthorByline } from "@/components/herbs/author-byline";
import { HerbJumpNav } from "@/components/herbs/herb-jump-nav";
import { HerbPhoto } from "@/components/herbs/herb-photo";
import { InteractionsTable } from "@/components/herbs/interactions-table";
import { HerbSourcesView } from "@/components/herbs/herb-sources-view";
import { HerbRegulatorExcerptsView } from "@/components/herbs/herb-regulator-excerpts-view";
import { HerbNarrativeView } from "@/components/herbs/herb-narrative-view";
import { HerbDetailTabs } from "@/components/herbs/herb-detail-tabs";
import {
  compactRegulatoryEvidence,
  RegulatoryEvidenceSection,
} from "@/components/herbs/regulatory-evidence";
import { GovSourcesView } from "@/components/herbs/gov-sources-view";
import { HerbFaqSection } from "@/components/herbs/herb-faq-section";
import { HerbRelatedSection } from "@/components/herbs/herb-related-grid";
import { CitationsList } from "@/components/herbs/citations";

const LONG_DESCRIPTION =
  "Turmeric (Curcuma longa) is a rhizomatous perennial herb of the Zingiberaceae family, cultivated widely across South and Southeast Asia. " +
  "Its rhizome is a source of curcuminoids (principally curcumin, demethoxycurcumin, and bisdemethoxycurcumin) and volatile oils such as turmerone. ".repeat(
    12
  );

function buildTurmericScaleFixture() {
  const interactions = [
    "Warfarin",
    "Aspirin",
    "Clopidogrel",
    "Cyclosporine",
    "Tacrolimus",
    "Metformin",
  ].map((drug, idx) => ({
    id: `ix-${idx}`,
    drug_name: drug,
    severity: (idx < 2 ? "severe" : "moderate") as "severe" | "moderate",
    description: `Co-administration with ${drug} may alter systemic exposure or bleeding risk based on clinical reports and pharmacokinetic data.`,
    source_url: "https://www.nccih.nih.gov/health/turmeric",
  }));

  const heroHerb = {
    id: "herb-turmeric",
    slug: "turmeric",
    name: "Turmeric",
    scientific_name: "Curcuma longa",
    image_url:
      "https://upload.wikimedia.org/wikipedia/commons/a/ab/Turmeric_inflorescence.jpg",
    pregnancy_safe: false,
    nursing_safe: false,
    pregnancy_safe_oral: false,
    pregnancy_safe_topical: true,
    nursing_safe_oral: false,
    nursing_safe_topical: true,
    herb_categories: { name: "Anti-inflammatory" },
    evidence_level: "B" as const,
    contraindications: [
      "Bile duct obstruction or gallstones",
      "Active bleeding disorders or upcoming surgery",
    ],
  };

  const compactProvenance = {
    verification_method: "primary_source",
    verification_status: "verified",
    verified_source_count: 5,
    verified_sources: [
      "Health Canada LNHPD",
      "European Medicines Agency (HMPC)",
      "NCCIH",
      "LiverTox",
      "PubMed",
    ],
    verified_by: null,
    review_status: null,
    reviewed_by_name: null,
    reviewed_on: null,
  };

  const tabData = {
    herb: {
      slug: "turmeric",
      description: LONG_DESCRIPTION,
      provenance: compactProvenance,
      traditional_uses: [
        "Relief of mild digestive disturbances",
        "Support of joint comfort",
        "Bitter tonic for sluggish appetite",
      ],
      modern_uses: [
        "Adjunctive management of knee osteoarthritis",
        "Inflammatory marker modulation",
      ],
      active_compounds: [
        "Curcumin",
        "Demethoxycurcumin",
        "Bisdemethoxycurcumin",
        "ar-Turmerone",
      ],
      dosage_forms: ["Powdered rhizome", "Standardized extract", "Tea"],
      dosage_adult: "500–1,000 mg standardized curcuminoids daily with meals",
      preparation_notes: "Take with food containing lipids.",
      pregnancy_safe: false,
      nursing_safe: false,
      contraindications: heroHerb.contraindications,
      side_effects: ["Mild gastrointestinal upset", "Nausea at high doses"],
    },
    monograph: {
      slug: "turmeric",
      summary: LONG_DESCRIPTION.slice(0, 900),
      mechanism:
        "Curcuminoids inhibit COX-2, 5-LOX, and NF-kappaB signalling pathways.",
      claims: [
        {
          claim: "Knee osteoarthritis symptom relief",
          evidence: "B" as const,
          note: "Multiple RCTs show modest benefit comparable to low-dose NSAIDs.",
        },
        {
          claim: "Functional dyspepsia relief",
          evidence: "C" as const,
          note: "Supported by traditional monograph use and small trials.",
        },
      ],
    },
    isClinicallyReviewed: false,
    regulatorName: "Health Canada",
    interactionCount: interactions.length,
    severityCounts: { contraindicated: 0, severe: 2, moderate: 4, mild: 0 },
    locale: "en" as const,
  };

  const excerpts = [
    "European Medicines Agency (HMPC)",
    "Health Canada",
    "LiverTox",
    "NCCIH",
  ].map((src, i) => ({
    key: src,
    id: `source-${i}`,
    claims: Array.from(
      { length: 4 },
      (_, j) =>
        `${src} recorded claim ${j + 1}: traditionally used for mild digestive disturbances and feelings of fullness.`
    ),
    safety: Array.from(
      { length: 4 },
      (_, j) =>
        `${src} safety note ${j + 1}: consult a healthcare practitioner prior to use if pregnant, breastfeeding, or taking anticoagulants.`
    ),
    url: "https://www.ema.europa.eu/",
    heading: `What ${src} says about Turmeric`,
    sourceLabel: src,
    licenceText: "Reproduced with attribution under public licence.",
    claimsHeading: "Uses",
    safetyHeading: "Cautions",
    notice: null,
    renderAs: "list" as const,
    collapsible: false,
  }));

  const regulatory = compactRegulatoryEvidence({
    herb_slug: "turmeric",
    source: "Health Canada LNHPD",
    source_licence: "OGL-Canada",
    purposes: Array.from(
      { length: 10 },
      (_, i) => `Licensed purpose ${i + 1}: helps relieve joint inflammation.`
    ),
    doses: Array.from({ length: 10 }, (_, i) => ({
      text: `${250 + i * 50} mg extract twice daily`,
      population: "Adults",
    })),
    risks: Array.from(
      { length: 10 },
      (_, i) => `Risk statement ${i + 1}: consult a practitioner if symptoms persist.`
    ),
    products_sampled: 25,
    source_urls: ["https://health-products.canada.ca/lnhpd-bdpsnh/"],
    retrieved_at: "2026-11-01T00:00:00Z",
  });

  const faqs = Array.from({ length: 6 }, (_, i) => ({
    question: `Turmeric FAQ question ${i + 1}?`,
    answer: `Turmeric evidence-based answer ${i + 1} summarizing safety, interactions, and traditional dosing.`,
  }));

  const relatedGuides = [
    {
      slug: "herb-drug-interactions-blood-thinners",
      title: "Herbs and Blood Thinners",
      metaDescription: "What to check before combining herbs with warfarin or antiplatelets.",
    },
    {
      slug: "surgery-herb-washout",
      title: "Pre-Surgery Herb Washout",
      metaDescription: "Timing guidelines before elective procedures.",
    },
    {
      slug: "liver-safety-herbs",
      title: "Herbs and Liver Safety",
      metaDescription: "How LiverTox classifies herbal hepatotoxicity risk.",
    },
  ];

  const relatedHerbs = [
    { name: "Ginger", slug: "ginger", scientific_name: "Zingiber officinale" },
    { name: "Boswellia", slug: "boswellia", scientific_name: "Boswellia serrata" },
    { name: "Black Pepper", slug: "black-pepper", scientific_name: "Piper nigrum" },
  ];

  const govItems = Array.from({ length: 10 }, (_, i) => ({
    id: `gov-${i}`,
    url: `https://example.gov/monograph/${i}`,
    label: `Authoritative Source ${i + 1}`,
    kindLabel: i < 4 ? "Direct monograph" : "Index",
  }));

  return {
    interactions,
    heroHerb,
    compactProvenance,
    tabData,
    excerpts,
    regulatory,
    faqs,
    relatedGuides,
    relatedHerbs,
    govItems,
  };
}

describe("Herb page payload size budget", () => {
  it("keeps HerbSchema JSON-LD concise without triple-repeating description", () => {
    const schemaMarkup = renderToStaticMarkup(
      <HerbSchema
        herb={{
          name: "Turmeric",
          scientific_name: "Curcuma longa",
          slug: "turmeric",
          description: LONG_DESCRIPTION,
          active_compounds: ["Curcumin", "Demethoxycurcumin"],
          traditional_uses: ["Digestive relief", "Joint comfort"],
          contraindications: ["Bile duct obstruction"],
          side_effects: ["Mild GI upset"],
          pregnancy_safe: false,
          nursing_safe: false,
          dosage_adult: "500–1,000 mg daily",
          herb_categories: { name: "Anti-inflammatory" },
          created_at: "2026-01-01T00:00:00Z",
        }}
        url="https://herbally.app/herbs/turmeric"
      />
    );

    const bytes = Buffer.byteLength(schemaMarkup);
    const occurrences = schemaMarkup.split("rhizomatous perennial herb").length - 1;
    console.log(`[budget] HerbSchema JSON-LD: ${(bytes / 1024).toFixed(2)} KB (${bytes} B)`);

    expect(occurrences).toBe(1);
    expect(bytes).toBeLessThan(8 * 1024);
  });

  it("keeps rendered herb page markup + serialized client props under 200 KB", () => {
    const f = buildTurmericScaleFixture();
    const glanceInteractions = f.interactions.map((i) => ({
      drug_name: i.drug_name,
      severity: i.severity,
    }));

    const clientPropsPayload = {
      heroHerb: f.heroHerb,
      compactProvenance: f.compactProvenance,
      glanceInteractions,
      tableInteractions: f.interactions,
      excerpts: f.excerpts,
      tabData: f.tabData,
      regulatory: f.regulatory.evidence,
      govItems: f.govItems,
      faqs: f.faqs,
      relatedGuides: f.relatedGuides,
      relatedHerbs: f.relatedHerbs,
    };
    const serializedPropsBytes = Buffer.byteLength(
      JSON.stringify(clientPropsPayload)
    );

    const wrap = (node: ReactNode) => (
      <NextIntlClientProvider
        locale="en"
        messages={en}
        timeZone="America/Toronto"
      >
        {node}
      </NextIntlClientProvider>
    );

    const html = renderToStaticMarkup(
      wrap(
        <div className="space-y-8">
          <HerbSchema
            herb={{
              ...f.heroHerb,
              description: LONG_DESCRIPTION,
              active_compounds: f.tabData.herb.active_compounds,
              traditional_uses: f.tabData.herb.traditional_uses,
              side_effects: f.tabData.herb.side_effects,
              dosage_adult: f.tabData.herb.dosage_adult,
            }}
            url="https://herbally.app/herbs/turmeric"
          />
          <HerbFAQSchema
            herbName="Turmeric"
            scientificName="Curcuma longa"
            uses={f.tabData.herb.traditional_uses}
            safetyNotes="Avoid in bile duct obstruction."
            pregnancyCategory="unsafe"
            drugInteractions={f.interactions.length}
            preGeneratedFaqs={f.faqs}
          />
          <HerbHeroV2
            herb={f.heroHerb}
            provenance={f.compactProvenance}
            isManualMonograph={true}
            showCalculator={true}
            interactions={glanceInteractions}
            safetyHref="#interactions"
          />
          <AuthorByline locale="en" lastReviewed="2026-11-01" isReviewed={false} />
          <HerbJumpNav locale="en" hasInteractions={true} />
          <HerbPhoto
            slug="turmeric"
            name="Turmeric"
            imageUrl={f.heroHerb.image_url}
            credit="Wikimedia Author"
            licence="CC BY-SA 4.0"
          />
          <InteractionsTable interactions={f.interactions} herbSlug="turmeric" />
          <HerbSourcesView
            referenceSources={f.compactProvenance.verified_sources}
            taxonomySources={["GBIF", "ITIS", "POWO"]}
            historicalSources={[]}
            countText="5 independent sources"
            date="2026-11-01"
            label="Sources checked for this entry"
            checkedLabel="Last checked"
            taxonomyLabel="Botanical identity confirmed via:"
            historicalLabel="Historical archival texts"
            note="Cross-checked against these sources."
          />
          <HerbRegulatorExcerptsView
            herbName="Turmeric"
            items={f.excerpts}
            verbatimNote={null}
            expandLabel="Show source text"
            reproducedLabel="Reproduced verbatim from"
          />
          <HerbNarrativeView
            title="Recorded facts"
            sections={[
              { heading: "Traditional use", body: "Used for mild digestive discomfort." },
              { heading: "Safety", body: "Not recommended in pregnancy." },
            ]}
          />
          <HerbDetailTabs data={f.tabData} />
          <CitationsList
            citations={Array.from({ length: 5 }, (_, i) => ({
              source: "PubMed",
              title: `Clinical trial ${i + 1} of curcuminoids`,
              year: 2024,
              pmid: `${38000000 + i}`,
            }))}
          />
          <RegulatoryEvidenceSection
            evidence={f.regulatory.evidence}
            isHomeopathic={f.regulatory.isHomeopathic}
            locale="en"
          />
          <GovSourcesView
            title="Government & Regulatory Sources"
            noMonographNotice={null}
            items={f.govItems}
          />
          <HerbFaqSection faqs={f.faqs} />
          <HerbRelatedSection
            locale="en"
            herbSlug="turmeric"
            interactions={glanceInteractions.slice(0, 6)}
            prev={{ slug: "tulsi", name: "Tulsi" }}
            next={{ slug: "valerian", name: "Valerian" }}
            symptomPeers={f.relatedHerbs.map((h) => ({
              slug: h.slug,
              name: h.name,
            }))}
            relatedHerbs={f.relatedHerbs}
            relatedHeading="Related Herbs"
            relatedGuides={f.relatedGuides}
          />
        </div>
      )
    );

    const htmlBytes = Buffer.byteLength(html);
    const combinedBytes = htmlBytes + serializedPropsBytes;
    console.log(
      `[budget] Herb SSR HTML: ${(htmlBytes / 1024).toFixed(1)} KB | Client props: ${(serializedPropsBytes / 1024).toFixed(1)} KB | Combined: ${(combinedBytes / 1024).toFixed(1)} KB`
    );

    expect(serializedPropsBytes).toBeLessThan(35 * 1024);
    expect(combinedBytes).toBeLessThan(200 * 1024);
  });
});
