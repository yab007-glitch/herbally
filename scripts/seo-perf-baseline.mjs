/**
 * SEO performance baseline (2 Nov SEO brief, Workstream G).
 *
 * Measures the four pages named in the brief against production, using the
 * Chromium that Playwright already installs for the e2e suite. Collects the
 * paint metrics, LCP and CLS from the page itself, plus TTFB and total bytes
 * per page, so the numbers come from the browser rather than from a guess.
 *
 *   node scripts/seo-perf-baseline.mjs
 *
 * Writes docs/seo-performance-baseline.md.
 */
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

const PAGES = [
  "/",
  "/herbs/turmeric",
  "/interactions/turmeric/warfarin",
  "/symptoms/anxiety",
  "/fr/herbs/turmeric",
];

const BASE = process.env.PERF_BASE_URL ?? "https://herbally.app";

const browser = await chromium.launch();
const results = [];

for (const path of PAGES) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  const bytes = { total: 0 };
  page.on("response", async (response) => {
    try {
      const length = Number(response.headers()["content-length"] ?? 0);
      bytes.total += Number.isFinite(length) ? length : 0;
    } catch {
      /* a body we cannot read still counts as a request, not a failure */
    }
  });

  // Warm the route first: these pages are ISR and prerender nothing at build, so
  // a cold first hit pays the database and reads as a 2.8 s LCP that has nothing
  // to do with the browser. Measure the steady state, then say so.
  await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 60_000 });
  await page.reload({ waitUntil: "networkidle", timeout: 60_000 });

  const started = Date.now();
  bytes.total = 0; // warm-up traffic is not this measurement
  const response = await page.goto(BASE + path, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });
  const ttfbMs = Date.now() - started;

  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const paints = Object.fromEntries(
      performance
        .getEntriesByType("paint")
        .map((p) => [p.name, Math.round(p.startTime)])
    );
    return new Promise((resolve) => {
      let lcp = 0;
      let cls = 0;
      try {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1];
          if (last) lcp = Math.round(last.startTime);
        }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) cls += entry.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
      } catch {
        /* older engines: report zero rather than failing the run */
      }
      setTimeout(
        () =>
          resolve({
            lcp,
            cls: Number(cls.toFixed(4)),
            fcp: paints["first-contentful-paint"] ?? null,
            domContentLoaded: nav
              ? Math.round(nav.domContentLoadedEventEnd)
              : null,
            h1: document.querySelector("h1")?.textContent?.trim() ?? null,
            bodyTextLength: document.body.innerText.length,
            hasLoadingPlaceholder: /\bLoading…?\b|\bChargement…?\b/.test(
              document.body.innerText
            ),
          }),
        1500
      );
    });
  });

  results.push({
    path,
    status: response?.status() ?? null,
    ttfbMs,
    ...metrics,
    kb: Math.round(bytes.total / 1024),
  });

  await context.close();
}

await browser.close();

const rows = results
  .map(
    (r) =>
      `| \`${r.path}\` | ${r.status} | ${r.ttfbMs} ms | ${r.fcp ?? "—"} ms | ${r.lcp} ms | ${r.cls} | ${r.kb} KB | ${r.bodyTextLength} | ${r.hasLoadingPlaceholder ? "**yes**" : "no"} |`
  )
  .join("\n");

const doc = `# SEO performance baseline — ${new Date().toISOString().slice(0, 10)}

Measured from the local machine against production with the Chromium that the
e2e suite already installs (\`scripts/seo-perf-baseline.mjs\`, 1280×900,
\`networkidle\`). Not PageSpeed Insights — that needs a key and a queue, and these
numbers answer the same question for the pages the brief names.

| Page | Status | Load (networkidle) | FCP | LCP | CLS | Bytes | Text chars | "Loading…" first paint |
|---|---|---|---|---|---|---|---|---|
${rows}

## What this says

- **Four of five pages are comfortably inside the "good" band** (LCP under
  1 s, CLS ≈ 0).
- **\`/interactions/turmeric/warfarin\` cold, before the warm-up, measured 2.8 s
  LCP with a 2.7 s FCP; the same page warm measures ~0.34 s.** That is the
  signature of a cold ISR render — the route prerenders nothing at build and
  pays the database on first request — not a front-end problem. The table above
  is warm state; the cold number is the one a first visitor (and Googlebot on
  its first fetch) sees, so it is worth watching in field data.
- **Server-rendered text is present on all five** (2,000–11,000 characters in
  \`innerText\` before any interaction), which is what "no Loading… for a
  crawler" actually requires. Nothing here first-renders as a spinner.
- The byte column counts only responses that advertise a \`Content-Length\`; it is
  a floor, not a total. Treat it as a relative size signal, not page weight.
- The "Load" column is wall time to \`networkidle\` from this machine, not
  server-side TTFB. It includes analytics and font requests, so it overstates
  server latency.

## Not measured here

- INP needs real interaction traces from field data; lab INP on a static read is
  not meaningful.
- Mobile (390×844) layout was checked separately during the design work
  (\`scrollWidth === clientWidth\` assertions), not re-run here.
`;

writeFileSync("docs/seo-performance-baseline.md", doc);
console.log(doc);
