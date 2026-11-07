import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { ChipLegend } from "@/components/herbs/chip-legend";

/**
 * The one page that explains the labels.
 *
 * These explanations used to sit inside every herb entry — as a collapsed
 * <details> block, which meant the text was in the HTML of all 3,238 pages even
 * though nobody saw it. Measured on a thin entry: 89 of its 135 lines of text
 * were identical to a page about a different plant, and the legend was most of
 * that. Google reads the markup, not the viewport, so the duplication counted.
 *
 * One page, one explanation, a link from every herb: the same information,
 * a third of the template repeated three thousand times.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "chipLegend" });
  return {
    title: `${t("title")} | HerbAlly`,
    description:
      "What the evidence grades and review labels on every herb entry mean, and how entries are checked against primary sources.",
    alternates: { canonical: "/methodology" },
  };
}

export default async function MethodologyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="container max-w-3xl py-10">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        How to read an entry
      </h1>

      <p className="mt-4 text-muted-foreground">
        Every herb entry carries two labels that measure different things: how
        strong the evidence is, and whether a person has checked the entry
        against a primary source. A page can honestly say &ldquo;strong
        evidence&rdquo; and &ldquo;not yet reviewed by a person&rdquo; at the
        same time — the first describes the research, the second describes our
        work.
      </p>

      <div className="mt-6">
        <ChipLegend defaultOpen />
      </div>

      <h2 className="mt-10 text-xl font-semibold text-foreground">
        Where the information comes from
      </h2>
      <p className="mt-3 text-muted-foreground">
        Identity is checked against taxonomic authorities — Plants of the World
        Online, GBIF, ITIS and IPNI. Regulatory statements quote the record
        itself: Health Canada&rsquo;s Licensed Natural Health Products Database,
        the European Medicines Agency&rsquo;s herbal monographs, or the US
        National Center for Complementary and Integrative Health, whose text is
        in the public domain under 17 U.S.C. §105. Research citations link to
        PubMed. Every source is named on the entry it supports, with the date it
        was read.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">
        What we do not do
      </h2>
      <p className="mt-3 text-muted-foreground">
        We do not fill a page for the sake of filling it. An entry that has
        little recorded about it says so, and stays out of search results until
        it has enough substance to be worth a reader&rsquo;s time. Nothing on a
        page is invented to make it look fuller.
      </p>

      <p className="mt-8">
        <Link
          href="/herbs"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Browse the herb library
        </Link>
      </p>
    </main>
  );
}
