import { publishedGuides } from "@/lib/guides/guides";
import { siteUrl } from "@/lib/seo/site-url";

export const revalidate = 3600;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const TOOL_ITEMS = [
  {
    path: "/medications",
    title: "Medications & Herb Interactions Directory A–Z",
    description:
      "Reverse-lookup directory of 142 prescription medications and drug classes showing every interacting medicinal herb ranked by severity.",
    updated: "2026-11-19",
  },
  {
    path: "/surgery-planner",
    title: "Pre-Surgery Herb & Supplement Washout Planner",
    description:
      "Calculate review and stop timelines ahead of surgery for bleeding-risk, sedation, and CYP450-active herbs based on ASA and Health Canada guidance.",
    updated: "2026-11-20",
  },
  {
    path: "/npn-checker",
    title: "Health Canada NPN & DIN-HM Supplement Decoder",
    description:
      "Look up any 8-digit Health Canada Natural Product Number to inspect licensed medicinal ingredients, risks, and drug interactions.",
    updated: "2026-11-18",
  },
  {
    path: "/herb-drug-interactions",
    title: "Herb–Drug Interaction & Multi-Medication Stack Checker",
    description:
      "Check single herbs or full multi-herb and prescription combinations with printable pharmacist consultation summaries.",
    updated: "2026-11-18",
  },
];

export async function GET() {
  const base = siteUrl();
  const guides = publishedGuides();
  const nowRfc = new Date().toUTCString();

  const itemsXml = [
    ...guides.map((g) => {
      const link = `${base}/guides/${g.slug}`;
      const pubDate = new Date(`${g.updated}T12:00:00Z`).toUTCString();
      return `    <item>
      <title>${escapeXml(g.en.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <author>contact@herbally.app (Yasser Bheekun, MLT)</author>
      <description>${escapeXml(g.en.metaDescription)}</description>
    </item>`;
    }),
    ...TOOL_ITEMS.map((item) => {
      const link = `${base}${item.path}`;
      const pubDate = new Date(`${item.updated}T12:00:00Z`).toUTCString();
      return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <author>contact@herbally.app (Yasser Bheekun, MLT)</author>
      <description>${escapeXml(item.description)}</description>
    </item>`;
    }),
  ].join("\n");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>HerbAlly — Evidence-Graded Herbal &amp; Drug Interaction Guides</title>
    <link>${escapeXml(base)}</link>
    <atom:link href="${escapeXml(`${base}/rss.xml`)}" rel="self" type="application/rss+xml" />
    <description>Clinical reference guides, medication interaction lookups, and safety tools editorially reviewed by Yasser Bheekun, MLT (OPTMQ · CSMLS).</description>
    <language>en-us</language>
    <lastBuildDate>${nowRfc}</lastBuildDate>
${itemsXml}
  </channel>
</rss>
`;

  return new Response(rss, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
