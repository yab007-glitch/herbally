import { ImageResponse } from "next/og";

/**
 * Per-herb social card.
 *
 * Until now every herb shared the one site-wide `/opengraph-image`, so a link
 * to Turmeric, Milk Thistle or Lion's Mane all previewed identically. This
 * route renders the herb's own name and evidence grade instead.
 *
 * Typographic on purpose: fetching the herb's photograph server-side would add
 * a Wikimedia round-trip (and its rate limit) to every social scrape, and a
 * failed fetch would break the card rather than degrade it.
 */
export const alt = "HerbAlly herb profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface HerbOg {
  name: string;
  scientific_name: string;
  evidence_level: string | null;
}

async function loadHerb(slug: string): Promise<HerbOg | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) return null;
  try {
    const res = await fetch(
      `${base}/rest/v1/herbs?slug=eq.${encodeURIComponent(slug)}&is_published=eq.true&select=name,scientific_name,evidence_level&limit=1`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        next: { revalidate: 3600 },
      }
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as HerbOg[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

const EVIDENCE_LABEL: Record<string, string> = {
  A: "Evidence A · Multiple RCTs",
  B: "Evidence B · Some clinical data",
  C: "Evidence C · Preliminary / preclinical",
  trad: "Traditional use",
};

export default async function HerbOpengraphImage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug } = await params;
  const herb = await loadHerb(slug);
  const name = herb?.name ?? slug.replace(/-/g, " ");
  const scientific = herb?.scientific_name ?? "";
  const evidence = herb?.evidence_level
    ? (EVIDENCE_LABEL[herb.evidence_level] ?? `Evidence ${herb.evidence_level}`)
    : null;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#f7f4ec",
        padding: "68px 76px",
        fontFamily: "system-ui, sans-serif",
        color: "#1f2a24",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 26,
          letterSpacing: 1,
          color: "#2f5d46",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#2f5d46",
            }}
          />
          <div style={{ display: "flex", fontWeight: 700 }}>HerbAlly</div>
        </div>
        <div style={{ display: "flex" }}>herbally.app</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div
          style={{
            display: "flex",
            fontSize: name.length > 26 ? 64 : 84,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -1.5,
          }}
        >
          {name}
        </div>
        {scientific ? (
          <div
            style={{
              display: "flex",
              fontSize: 34,
              fontStyle: "italic",
              color: "#5b6b61",
            }}
          >
            {scientific}
          </div>
        ) : null}
        {evidence ? (
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              marginTop: 10,
              padding: "10px 20px",
              borderRadius: 999,
              border: "1px solid #cdd8cf",
              background: "#eef3ee",
              fontSize: 24,
              color: "#2f5d46",
            }}
          >
            {evidence}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 22,
          color: "#6b7a70",
          borderTop: "1px solid #ded8c9",
          paddingTop: 24,
        }}
      >
        <div style={{ display: "flex" }}>
          {"Free herb & drug-interaction reference"}
        </div>
        <div style={{ display: "flex" }}>English · Français</div>
      </div>
    </div>,
    { ...size }
  );
}
