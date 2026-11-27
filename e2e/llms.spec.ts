import { createHash } from "node:crypto";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

for (const [name, headers] of [
  ["default", {}],
  ["French language", { "Accept-Language": "fr" }],
  ["French cookie", { Cookie: "herbally-locale=fr" }],
] as const) {
  test(`serves llms.txt without localization: ${name}`, async ({ request }) => {
    const response = await request.get("/llms.txt", {
      headers,
      maxRedirects: 0,
    });
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/plain");
    expect(await response.text()).toBe(
      await readFile("public/llms.txt", "utf8")
    );
  });
}

test("serves atomic CORS-enabled /open-data/* endpoints, SHA-256 manifest, OpenAPI 3.1, RFC 9116 security.txt, and bilingual /trust pages", async ({
  request,
}) => {
  const [
    catRes,
    medRes,
    ixRes,
    qRes,
    manifestRes,
    schemaRes,
    monRes,
    secRes,
    trustEn,
    trustFr,
  ] = await Promise.all([
    request.get("/open-data/catalog.json"),
    request.get("/open-data/medications.json"),
    request.get("/open-data/interactions.json"),
    request.get("/open-data/quarantine.json"),
    request.get("/open-data/manifest.json"),
    request.get("/open-data/schema.json"),
    request.get("/open-data/source-monitor-latest.json"),
    request.get("/.well-known/security.txt"),
    request.get("/trust"),
    request.get("/fr/trust"),
  ]);

  expect(trustEn.status()).toBe(200);
  expect(trustFr.status()).toBe(200);
  expect(secRes.status()).toBe(200);
  expect(await secRes.text()).toContain("Contact: mailto:info@herbally.app");

  for (const res of [
    catRes,
    medRes,
    ixRes,
    qRes,
    manifestRes,
    schemaRes,
    monRes,
  ]) {
    expect(res.status()).toBe(200);
    expect(res.headers()["access-control-allow-origin"]).toBe("*");
    expect(res.headers()["cache-control"]).toContain("s-maxage=60");
  }

  const [catRaw, medRaw, ixRaw, qRaw, manifestRaw, schemaRaw, monRaw] =
    await Promise.all([
      catRes.text(),
      medRes.text(),
      ixRes.text(),
      qRes.text(),
      manifestRes.text(),
      schemaRes.text(),
      monRes.text(),
    ]);

  const cat = JSON.parse(catRaw);
  const med = JSON.parse(medRaw);
  const ix = JSON.parse(ixRaw);
  const q = JSON.parse(qRaw);
  const manifest = JSON.parse(manifestRaw);
  const schema = JSON.parse(schemaRaw);
  const mon = JSON.parse(monRaw);

  expect(cat.datasetVersion).toBe("3.14.1");
  expect(med.snapshotId).toBe(cat.snapshotId);
  expect(ix.snapshotId).toBe(cat.snapshotId);
  expect(q.snapshotId).toBe(cat.snapshotId);
  expect(manifest.snapshotId).toBe(cat.snapshotId);
  expect(schema.openapi).toBe("3.1.0");
  expect(mon.report.citations.brokenUrls).toEqual([]);

  for (const [path, raw] of [
    ["/open-data/catalog.json", catRaw],
    ["/open-data/medications.json", medRaw],
    ["/open-data/interactions.json", ixRaw],
    ["/open-data/quarantine.json", qRaw],
    ["/open-data/schema.json", schemaRaw],
  ] as const) {
    const sha256 = createHash("sha256").update(raw, "utf8").digest("hex");
    expect(manifest.files[path].sha256).toBe(sha256);
  }
});
