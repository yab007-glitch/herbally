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

test("serves atomic CORS-enabled /open-data/* endpoints, SHA-256 manifest, OpenAPI 3.1, RFC 9116 security.txt, embed.js, and SSR stack overlap docs", async ({
  request,
}) => {
  const [
    catRes,
    medRes,
    ixRes,
    qRes,
    privacyRes,
    reviewQueueRes,
    manifestRes,
    releaseBundleRes,
    schemaRes,
    monRes,
    secRes,
    embedRes,
    interactionsPageRes,
    trustEn,
    trustFr,
  ] = await Promise.all([
    request.get("/open-data/catalog.json"),
    request.get("/open-data/medications.json"),
    request.get("/open-data/interactions.json"),
    request.get("/open-data/quarantine.json"),
    request.get("/open-data/privacy-manifest.json"),
    request.get("/open-data/review-queue.json"),
    request.get("/open-data/manifest.json"),
    request.get("/open-data/v3-15-0.json"),
    request.get("/open-data/schema.json"),
    request.get("/open-data/source-monitor-latest.json"),
    request.get("/.well-known/security.txt"),
    request.get("/embed.js"),
    request.get("/herb-drug-interactions"),
    request.get("/trust"),
    request.get("/fr/trust"),
  ]);

  expect(trustEn.status()).toBe(200);
  expect(trustFr.status()).toBe(200);
  expect(secRes.status()).toBe(200);
  expect(await secRes.text()).toContain("Contact: mailto:info@herbally.app");
  expect(embedRes.status()).toBe(200);
  expect(await embedRes.text()).toContain("herbally-checker");
  expect(interactionsPageRes.status()).toBe(200);
  const ixHtml = await interactionsPageRes.text();
  expect(ixHtml).toContain("bleeding_overlap");
  expect(ixHtml).toContain("serotonin_overlap");
  expect(ixHtml).toContain("Consultation Brief");

  for (const res of [
    catRes,
    medRes,
    ixRes,
    qRes,
    privacyRes,
    reviewQueueRes,
    manifestRes,
    releaseBundleRes,
    schemaRes,
    monRes,
  ]) {
    expect(res.status()).toBe(200);
    expect(res.headers()["access-control-allow-origin"]).toBe("*");
    expect(res.headers()["cache-control"]).toContain("s-maxage=60");
  }

  const [
    catRaw,
    medRaw,
    ixRaw,
    qRaw,
    privacyRaw,
    reviewQueueRaw,
    manifestRaw,
    releaseBundleRaw,
    schemaRaw,
    monRaw,
  ] = await Promise.all([
    catRes.text(),
    medRes.text(),
    ixRes.text(),
    qRes.text(),
    privacyRes.text(),
    reviewQueueRes.text(),
    manifestRes.text(),
    releaseBundleRes.text(),
    schemaRes.text(),
    monRes.text(),
  ]);

  const cat = JSON.parse(catRaw);
  const med = JSON.parse(medRaw);
  const ix = JSON.parse(ixRaw);
  const q = JSON.parse(qRaw);
  const privacy = JSON.parse(privacyRaw);
  const reviewQueue = JSON.parse(reviewQueueRaw);
  const manifest = JSON.parse(manifestRaw);
  const releaseBundle = JSON.parse(releaseBundleRaw);
  const schema = JSON.parse(schemaRaw);
  const mon = JSON.parse(monRaw);

  expect(cat.datasetVersion).toBe("3.15.0");
  expect(releaseBundle.datasetVersion).toBe("3.15.0");
  expect(releaseBundle.snapshotId).toBe(cat.snapshotId);
  expect(med.snapshotId).toBe(cat.snapshotId);
  expect(ix.snapshotId).toBe(cat.snapshotId);
  expect(q.snapshotId).toBe(cat.snapshotId);
  expect(privacy.snapshotId).toBe(cat.snapshotId);
  expect(reviewQueue.snapshotId).toBe(cat.snapshotId);
  expect(manifest.snapshotId).toBe(cat.snapshotId);
  expect(schema.openapi).toBe("3.1.0");
  expect(mon.report.citations.brokenUrls).toEqual([]);

  for (const [path, raw] of [
    ["/open-data/catalog.json", catRaw],
    ["/open-data/medications.json", medRaw],
    ["/open-data/interactions.json", ixRaw],
    ["/open-data/quarantine.json", qRaw],
    ["/open-data/privacy-manifest.json", privacyRaw],
    ["/open-data/review-queue.json", reviewQueueRaw],
    ["/open-data/schema.json", schemaRaw],
  ] as const) {
    const sha256 = createHash("sha256").update(raw, "utf8").digest("hex");
    expect(manifest.files[path].sha256).toBe(sha256);
  }
});

test("mounts CSP-safe <herbally-checker> Web Component via /embed.js in real browser with sandbox and accessibility attributes", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  await page.goto("/widgets");
  await page.evaluate(() => {
    const el = document.createElement("herbally-checker");
    el.setAttribute("locale", "fr");
    el.setAttribute("max-width", "640px");
    el.setAttribute("data-testid", "live-web-component");
    document.body.appendChild(el);
  });
  await page.addScriptTag({ url: "/embed.js" });

  const iframe = page.locator(
    '[data-testid="live-web-component"] iframe[loading="lazy"]'
  );
  await expect(iframe).toBeVisible();
  await expect(iframe).toHaveAttribute(
    "src",
    "https://herbally.app/fr/embed/checker"
  );
  await expect(iframe).toHaveAttribute(
    "sandbox",
    "allow-scripts allow-same-origin allow-forms allow-popups"
  );
  await expect(iframe).toHaveAttribute(
    "referrerpolicy",
    "strict-origin-when-cross-origin"
  );
  expect(consoleErrors).toEqual([]);
});
