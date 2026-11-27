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

test("serves atomic CORS-enabled /open-data/* endpoints, OpenAPI 3.1 schema, and bilingual /trust pages", async ({
  request,
}) => {
  const [catRes, medRes, ixRes, qRes, schemaRes, trustEn, trustFr] =
    await Promise.all([
      request.get("/open-data/catalog.json"),
      request.get("/open-data/medications.json"),
      request.get("/open-data/interactions.json"),
      request.get("/open-data/quarantine.json"),
      request.get("/open-data/schema.json"),
      request.get("/trust"),
      request.get("/fr/trust"),
    ]);

  expect(trustEn.status()).toBe(200);
  expect(trustFr.status()).toBe(200);

  for (const res of [catRes, medRes, ixRes, qRes, schemaRes]) {
    expect(res.status()).toBe(200);
    expect(res.headers()["access-control-allow-origin"]).toBe("*");
  }

  const [cat, med, ix, q, schema] = await Promise.all([
    catRes.json(),
    medRes.json(),
    ixRes.json(),
    qRes.json(),
    schemaRes.json(),
  ]);

  expect(cat.datasetVersion).toBe("3.13.0");
  expect(med.snapshotId).toBe(cat.snapshotId);
  expect(ix.snapshotId).toBe(cat.snapshotId);
  expect(q.snapshotId).toBe(cat.snapshotId);
  expect(schema.openapi).toBe("3.1.0");
});
