import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GET as getQuarantineJson } from "@/app/open-data/quarantine.json/route";
import { getAllDangerousHerbs } from "@/lib/data/dangerous-herbs";
import { WebApplicationSchema } from "@/components/seo/web-app-schema";

describe("Open Botanical Safety Data Suite & WebApplicationSchema", () => {
  it("exports all dangerous herbs deterministically sorted by slug", () => {
    const records = getAllDangerousHerbs();
    expect(records.length).toBeGreaterThan(20);
    const slugs = records.map((r) => r.slug);
    expect(slugs).toContain("abrus-precatorius");
    expect([...slugs].sort((a, b) => a.localeCompare(b))).toEqual(slugs);
  });

  it("serves CORS-enabled /open-data/quarantine.json with Poison Control emergency numbers", async () => {
    const res = await getQuarantineJson();
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const body = (await res.json()) as {
      dataset: string;
      totalQuarantinedBotanicals: number;
      emergencyContacts: {
        usPoisonControl: string;
        canadaPoisonControl: string;
        emergency: string;
      };
      botanicals: Array<{ slug: string; quarantineStatus: string }>;
    };
    expect(body.dataset).toBe("toxic_botanical_quarantine");
    expect(body.totalQuarantinedBotanicals).toBeGreaterThan(20);
    expect(body.emergencyContacts.usPoisonControl).toBe("1-800-222-1222");
    expect(body.emergencyContacts.canadaPoisonControl).toBe("1-844-764-7669");
    expect(body.emergencyContacts.emergency).toBe("911");
    expect(
      body.botanicals.find((b) => b.slug === "abrus-precatorius")
        ?.quarantineStatus
    ).toBe("permanent_toxic_quarantine");
  });

  it("renders valid free HealthApplication Schema.org JSON-LD via WebApplicationSchema", () => {
    const html = renderToStaticMarkup(
      createElement(WebApplicationSchema, {
        name: "Health Canada NPN Decoder",
        description: "Verify 8-digit Natural Product Numbers",
        url: "https://herbally.app/npn-checker",
        featureList: ["Live LNHPD lookup"],
      })
    );
    expect(html).toContain('"@type":"WebApplication"');
    expect(html).toContain('"isAccessibleForFree":true');
    expect(html).toContain('"price":"0"');
    expect(html).toContain('"priceCurrency":"CAD"');
  });
});
