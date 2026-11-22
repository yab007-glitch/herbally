export type GuideStatus = "draft" | "published";

export interface GuideSection {
  heading: string;
  paragraphs: string[];
}

export interface GuideCopy {
  title: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  sections: GuideSection[];
  sources: { label: string; url: string }[];
}

export interface Guide {
  slug: string;
  status: GuideStatus;
  /** ISO date of the last edit to this guide. */
  updated: string;
  /** Registered reviewer id from `src/lib/data/reviewers.ts`. */
  reviewedBy?: string;
  /** ISO date the editorial review occurred. */
  reviewedOn?: string;
  en: GuideCopy;
  fr: GuideCopy;
  /** Internal pages this guide should hand off to. */
  related: { href: string; en: string; fr: string }[];
}
