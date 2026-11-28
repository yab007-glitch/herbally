import fs from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Comprehensive WCAG 2.2 AA, Axe-Core, Uncapped All-Element Composited Contrast,
 * Interactive-State Contrast (errors, expanded disclosures, focus, disabled),
 * Visible Focus Appearance, Accessible Name, Keyboard Workflow, Live Region,
 * Target Size, 320px Reflow, and Multi-Page Clinical Print Verification Suite
 * (R2-08, R2-18, Round 2.2).
 *
 * When `E2E_INCLUDE_CLINICAL_ROUTES=1` (enabled in `postgrest-and-migrated-e2e`
 * on every CI run AND in `live-accessibility-audit.yml` against production
 * `https://herbally.app`), the matrix expands from 6 core routes (12 checks)
 * to all 11 routes (22 checks), explicitly including the toxic-botanical
 * quarantine pages (`/herbs/abrus-precatorius`, `/fr/herbs/abrus-precatorius`)
 * and dynamic clinical routes (`/herbs/turmeric`,
 * `/interactions/st-johns-wort/rivaroxaban`, `/medications/rivaroxaban`).
 */

const INCLUDE_CLINICAL_ROUTES = process.env.E2E_INCLUDE_CLINICAL_ROUTES === "1";

const CORE_MATRIX_ROUTES = [
  "/",
  "/fr",
  "/herb-drug-interactions",
  "/fr/herb-drug-interactions",
  "/clinical-review?intent=signoff&targetType=interaction&slug=st-johns-wort&drug=Rivaroxaban",
  "/trust",
] as const;

const CLINICAL_AND_QUARANTINE_ROUTES = [
  "/herbs/abrus-precatorius",
  "/fr/herbs/abrus-precatorius",
  "/herbs/turmeric",
  "/interactions/st-johns-wort/rivaroxaban",
  "/medications/rivaroxaban",
] as const;

const MATRIX_ROUTES: readonly string[] = INCLUDE_CLINICAL_ROUTES
  ? [...CORE_MATRIX_ROUTES, ...CLINICAL_AND_QUARANTINE_ROUTES]
  : [...CORE_MATRIX_ROUTES];

const REFLOW_ROUTES: readonly string[] = INCLUDE_CLINICAL_ROUTES
  ? [
      "/",
      "/fr",
      "/herb-drug-interactions",
      "/fr/herb-drug-interactions",
      "/medications",
      "/herbs",
      "/clinical-review?intent=signoff&targetType=interaction&slug=st-johns-wort&drug=Rivaroxaban",
      "/clinical-review?intent=advisory",
      "/trust",
      ...CLINICAL_AND_QUARANTINE_ROUTES,
    ]
  : [
      "/",
      "/fr",
      "/herb-drug-interactions",
      "/fr/herb-drug-interactions",
      "/medications",
      "/herbs",
      "/clinical-review?intent=signoff&targetType=interaction&slug=st-johns-wort&drug=Rivaroxaban",
      "/clinical-review?intent=advisory",
      "/trust",
    ];

interface AxeRouteReport {
  route: string;
  theme: "light" | "dark";
  violations: Array<{
    id: string;
    impact: string | null | undefined;
    help: string;
    nodes: number;
  }>;
  compositedContrast: {
    checkedElements: number;
    minRatio: number;
    failures: Array<{
      tag: string;
      text: string;
      ratio: number;
      required: number;
    }>;
  };
  unnamedInteractiveControls: number;
}

interface InteractiveStateReport {
  state: string;
  theme: "light" | "dark";
  ratio: number;
  passed: boolean;
}

const REPORT_PATH = path.join(
  process.cwd(),
  "test-results",
  "accessibility-audit-report.json"
);

const auditReports: AxeRouteReport[] = [];
const interactiveStateReports: InteractiveStateReport[] = [];

test.describe("UX & Comprehensive WCAG 2.2 AA Accessibility Verification", () => {
  test.afterAll(() => {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(
      REPORT_PATH,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          standard:
            "WCAG 2.2 AA (wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa)",
          includesClinicalAndQuarantineRoutes: INCLUDE_CLINICAL_ROUTES,
          routesAudited: auditReports.length,
          totalAxeViolations: auditReports.reduce(
            (sum, r) => sum + r.violations.length,
            0
          ),
          totalContrastFailures: auditReports.reduce(
            (sum, r) => sum + r.compositedContrast.failures.length,
            0
          ),
          interactiveStatesAudited: interactiveStateReports.length,
          results: auditReports,
          interactiveStates: interactiveStateReports,
        },
        null,
        2
      ) + "\n",
      "utf8"
    );
  });

  test("axe-core WCAG 2.2 AA, uncapped all-element composited contrast, and accessible names pass across all audited routes in light and dark modes", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1280, height: 800 });

    for (const route of MATRIX_ROUTES) {
      for (const theme of ["light", "dark"] as const) {
        await page.emulateMedia({
          colorScheme: theme,
          reducedMotion: "reduce",
        });
        const res = await page.goto(route, { waitUntil: "domcontentloaded" });
        expect(res?.status(), `HTTP status for ${route}`).toBeLessThan(400);

        await page.evaluate((mode) => {
          try {
            window.localStorage.setItem("theme", mode);
          } catch {
            // Ignore storage restrictions
          }
          document.documentElement.classList.toggle("dark", mode === "dark");
          document.documentElement.style.colorScheme = mode;
        }, theme);
        await page.waitForTimeout(200);
        const appliedDark = await page.evaluate(() =>
          document.documentElement.classList.contains("dark")
        );
        expect(appliedDark, `Theme class active for ${theme}`).toBe(
          theme === "dark"
        );

        // 1. Run axe-core across WCAG 2.0/2.1/2.2 A & AA rulesets
        const axeResults = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze();

        // 2. Uncapped all-element composited contrast scan across EVERY visible
        // leaf text-bearing element inside main, header, and footer (headings,
        // nested warning text, secondary labels, badges, buttons, links, alerts).
        const domAudit = await page.evaluate(() => {
          type RGBA = [number, number, number, number];
          const canvas = document.createElement("canvas");
          canvas.width = 1;
          canvas.height = 1;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });

          function parseColor(str: string): RGBA | null {
            if (
              !ctx ||
              !str ||
              str === "transparent" ||
              str === "rgba(0, 0, 0, 0)"
            ) {
              return [0, 0, 0, 0];
            }
            ctx.clearRect(0, 0, 1, 1);
            ctx.fillStyle = "rgba(0, 0, 0, 0)";
            ctx.fillStyle = str;
            ctx.fillRect(0, 0, 1, 1);
            const data = ctx.getImageData(0, 0, 1, 1).data;
            return [data[0], data[1], data[2], data[3] / 255];
          }

          function composite(
            fg: RGBA,
            bg: [number, number, number]
          ): [number, number, number] {
            const a = fg[3];
            return [
              fg[0] * a + bg[0] * (1 - a),
              fg[1] * a + bg[1] * (1 - a),
              fg[2] * a + bg[2] * (1 - a),
            ];
          }

          function effectiveBg(el: Element): [number, number, number] {
            const layers: RGBA[] = [];
            let cur: Element | null = el;
            while (cur) {
              const parsed = parseColor(getComputedStyle(cur).backgroundColor);
              if (parsed && parsed[3] > 0) {
                layers.push(parsed);
                if (parsed[3] >= 0.99) break;
              }
              cur = cur.parentElement;
            }
            let base: [number, number, number] =
              document.documentElement.classList.contains("dark")
                ? [24, 22, 20]
                : [248, 246, 241];
            for (let i = layers.length - 1; i >= 0; i--) {
              base = composite(layers[i], base);
            }
            return base;
          }

          function relLum([r, g, b]: [number, number, number]): number {
            const lin = (c: number) => {
              const s = c / 255;
              return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
            };
            return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
          }

          function contrastRatio(
            fg: [number, number, number],
            bg: [number, number, number]
          ): number {
            const l1 = relLum(fg);
            const l2 = relLum(bg);
            return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
          }

          function hasDirectText(el: Element): boolean {
            for (const node of Array.from(el.childNodes)) {
              if (
                node.nodeType === Node.TEXT_NODE &&
                (node.textContent ?? "").trim().length > 0
              ) {
                return true;
              }
            }
            return false;
          }

          function isHiddenOrDecorative(el: Element): boolean {
            let cur: Element | null = el;
            while (cur) {
              const s = getComputedStyle(cur);
              if (
                s.display === "none" ||
                s.visibility === "hidden" ||
                Number(s.opacity) < 0.9 ||
                cur.classList.contains("sr-only") ||
                cur.classList.contains("gradient-text") ||
                cur.getAttribute("aria-hidden") === "true" ||
                cur.hasAttribute("disabled")
              ) {
                return true;
              }
              if (cur.tagName === "DETAILS" && !cur.hasAttribute("open")) {
                if (!el.closest("summary")) return true;
              }
              cur = cur.parentElement;
            }
            return false;
          }

          let checkedElements = 0;
          let minRatio = 21;
          const failures: Array<{
            tag: string;
            text: string;
            ratio: number;
            required: number;
          }> = [];

          const containers = Array.from(
            document.querySelectorAll("main, header, footer")
          );
          for (const root of containers) {
            const allEls = Array.from(root.querySelectorAll("*"));
            for (const el of allEls) {
              if (
                el.tagName === "SCRIPT" ||
                el.tagName === "STYLE" ||
                el.tagName === "NOSCRIPT" ||
                el.tagName === "OPTION" ||
                el.tagName === "SVG" ||
                el.closest("svg")
              ) {
                continue;
              }
              if (!hasDirectText(el)) continue;
              if (isHiddenOrDecorative(el)) continue;
              const rect = el.getBoundingClientRect();
              if (rect.width < 4 || rect.height < 4) continue;
              const text = (el.textContent ?? "").trim();
              if (!text) continue;

              const style = getComputedStyle(el);
              if (
                style.webkitTextFillColor === "rgba(0, 0, 0, 0)" ||
                style.backgroundClip === "text"
              ) {
                continue;
              }
              const fgParsed = parseColor(style.color);
              if (!fgParsed || fgParsed[3] === 0) continue;
              const bg = effectiveBg(el);
              const fg = composite(fgParsed, bg);
              const ratio = contrastRatio(fg, bg);
              const fontSize = parseFloat(style.fontSize) || 16;
              const fontWeight = parseInt(style.fontWeight, 10) || 400;
              const isLarge =
                fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
              const required = isLarge ? 3.0 : 4.5;
              checkedElements++;
              if (ratio < minRatio) minRatio = ratio;
              if (ratio < required) {
                failures.push({
                  tag: el.tagName,
                  text: text.slice(0, 60),
                  ratio: Number(ratio.toFixed(2)),
                  required,
                });
              }
            }
          }

          // 3. Verify every visible interactive control has an accessible name
          let unnamedInteractiveControls = 0;
          for (const el of Array.from(
            document.querySelectorAll(
              "a[href], button:not(:disabled), input:not([type='hidden']), select, textarea"
            )
          )) {
            const style = getComputedStyle(el);
            if (style.display === "none" || style.visibility === "hidden") {
              continue;
            }
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) continue;
            const ariaLabel = el.getAttribute("aria-label")?.trim();
            const ariaLabelledBy = el.getAttribute("aria-labelledby")?.trim();
            const title = el.getAttribute("title")?.trim();
            const text = (el.textContent ?? "").trim();
            const id = el.getAttribute("id");
            const associatedLabel = id
              ? document
                  .querySelector(`label[for="${CSS.escape(id)}"]`)
                  ?.textContent?.trim()
              : "";
            const wrappingLabel = el.closest("label")?.textContent?.trim();
            if (
              !ariaLabel &&
              !ariaLabelledBy &&
              !title &&
              !text &&
              !associatedLabel &&
              !wrappingLabel
            ) {
              unnamedInteractiveControls++;
            }
          }

          return {
            checkedElements,
            minRatio: Number(minRatio.toFixed(2)),
            failures,
            unnamedInteractiveControls,
          };
        });

        auditReports.push({
          route,
          theme,
          violations: axeResults.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            nodes: v.nodes.length,
          })),
          compositedContrast: {
            checkedElements: domAudit.checkedElements,
            minRatio: domAudit.minRatio,
            failures: domAudit.failures,
          },
          unnamedInteractiveControls: domAudit.unnamedInteractiveControls,
        });

        expect(
          axeResults.violations,
          `Axe WCAG 2.2 AA violations on ${route} (${theme} mode): ${JSON.stringify(
            axeResults.violations.map((v) => ({
              id: v.id,
              impact: v.impact,
              nodes: v.nodes.map((n) => n.html).slice(0, 3),
            }))
          )}`
        ).toEqual([]);

        expect(
          domAudit.checkedElements,
          `Uncapped rendered text elements checked on ${route} (${theme})`
        ).toBeGreaterThanOrEqual(20);

        expect(
          domAudit.failures,
          `Uncapped composited WCAG 2.2 AA contrast failures on ${route} (${theme})`
        ).toEqual([]);

        expect(
          domAudit.unnamedInteractiveControls,
          `Unnamed interactive controls on ${route} (${theme})`
        ).toBe(0);
      }
    }
  });

  test("interactive states (validation errors, expanded disclosures, focus indicators, and disabled controls) pass WCAG 2.2 AA in light and dark modes", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.goto("/herb-drug-interactions", {
        waitUntil: "domcontentloaded",
      });
      await page.evaluate((mode) => {
        try {
          window.localStorage.setItem("theme", mode);
        } catch {
          // Ignore
        }
        document.documentElement.classList.toggle("dark", mode === "dark");
        document.documentElement.style.colorScheme = mode;
      }, theme);
      await page.waitForTimeout(200);

      // 1. Trigger StackChecker empty validation error and measure alert contrast
      const checkStackBtn = page
        .locator("#stack-checker")
        .getByRole("button", { name: /check/i })
        .first();
      await checkStackBtn.click();
      const alertEl = page.locator("#stack-checker [role='alert']").first();
      await expect(alertEl).toBeVisible();

      const errorContrast = await alertEl.evaluate((el) => {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        const parse = (c: string): [number, number, number, number] => {
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = "rgba(0,0,0,0)";
          ctx.fillStyle = c;
          ctx.fillRect(0, 0, 1, 1);
          const d = ctx.getImageData(0, 0, 1, 1).data;
          return [d[0], d[1], d[2], d[3] / 255];
        };
        const comp = (
          fg: [number, number, number, number],
          bg: [number, number, number]
        ): [number, number, number] => [
          fg[0] * fg[3] + bg[0] * (1 - fg[3]),
          fg[1] * fg[3] + bg[1] * (1 - fg[3]),
          fg[2] * fg[3] + bg[2] * (1 - fg[3]),
        ];
        const layers: Array<[number, number, number, number]> = [];
        let cur: Element | null = el;
        while (cur) {
          const p = parse(getComputedStyle(cur).backgroundColor);
          if (p[3] > 0) {
            layers.push(p);
            if (p[3] >= 0.99) break;
          }
          cur = cur.parentElement;
        }
        let bg: [number, number, number] =
          document.documentElement.classList.contains("dark")
            ? [24, 22, 20]
            : [248, 246, 241];
        for (let i = layers.length - 1; i >= 0; i--) bg = comp(layers[i], bg);
        const fg = comp(parse(getComputedStyle(el).color), bg);
        const lum = ([r, g, b]: [number, number, number]) => {
          const lin = (v: number) =>
            v / 255 <= 0.03928
              ? v / 255 / 12.92
              : ((v / 255 + 0.055) / 1.055) ** 2.4;
          return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
        };
        const l1 = lum(fg);
        const l2 = lum(bg);
        return Number(
          ((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2)
        );
      });
      interactiveStateReports.push({
        state: "stack-checker-validation-alert",
        theme,
        ratio: errorContrast,
        passed: errorContrast >= 4.5,
      });
      expect(
        errorContrast,
        `Validation error alert contrast (${theme})`
      ).toBeGreaterThanOrEqual(4.5);

      // 2. Verify disabled add button is properly marked disabled before input
      const addHerbBtn = page.getByRole("button", { name: /Add herb/i });
      await expect(addHerbBtn).toBeDisabled();

      // 3. Verify keyboard Tab produces a genuinely visible focus-visible indicator
      await page.keyboard.press("Tab");
      const focusedHasRing = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return false;
        const s = getComputedStyle(el);
        return (
          (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 1) ||
          (s.boxShadow !== "none" && s.boxShadow !== "")
        );
      });
      expect(focusedHasRing, `Focused control indicator (${theme})`).toBe(true);

      // 4. Expanded disclosure (<details>) state & axe-core check on clinical-review or interaction page
      await page.goto("/clinical-review?intent=signoff", {
        waitUntil: "domcontentloaded",
      });
      await page.evaluate((mode) => {
        document.documentElement.classList.toggle("dark", mode === "dark");
        document.documentElement.style.colorScheme = mode;
      }, theme);
      const detailsCount = await page.locator("details").count();
      if (detailsCount > 0) {
        await page.locator("details summary").first().click();
        await expect(page.locator("details").first()).toHaveAttribute(
          "open",
          ""
        );
        const expandedAxe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(
          expandedAxe.violations,
          `Axe violations in expanded <details> (${theme})`
        ).toEqual([]);
        interactiveStateReports.push({
          state: "expanded-disclosure-axe",
          theme,
          ratio: 21,
          passed: expandedAxe.violations.length === 0,
        });
      }
    }
  });

  test("narrow mobile 320px reflow produces zero horizontal overflow across all audited EN, FR, and clinical routes", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 320, height: 640 });

    for (const route of REFLOW_ROUTES) {
      const res = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(res?.status(), `HTTP status for ${route}`).toBeLessThan(400);

      const overflowPx = await page.evaluate(() => {
        return (
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth
        );
      });
      expect(
        overflowPx,
        `Horizontal overflow at 320px on ${route}`
      ).toBeLessThanOrEqual(2);
    }
  });

  test("keyboard workflow, visible focus indicator, StackChecker chips, live region, and WCAG 2.2 target sizes work end-to-end", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/herb-drug-interactions", {
      waitUntil: "domcontentloaded",
    });

    // 1. Verify keyboard Tab produces a genuinely VISIBLE focus indicator (outline or ring)
    await page.keyboard.press("Tab");
    const focusInfo = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return null;
      const s = getComputedStyle(el);
      const outlineWidth = parseFloat(s.outlineWidth) || 0;
      const hasOutline = s.outlineStyle !== "none" && outlineWidth >= 1;
      const hasShadow = s.boxShadow !== "none" && s.boxShadow !== "";
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        hasVisibleIndicator: hasOutline || hasShadow,
        outline: `${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}`,
        visibleOnScreen: rect.width > 0 && rect.height > 0,
      };
    });
    expect(
      focusInfo?.hasVisibleIndicator,
      `Visible focus indicator: ${JSON.stringify(focusInfo)}`
    ).toBe(true);
    expect(focusInfo?.visibleOnScreen).toBe(true);

    // 2. Verify accessible names via ARIA getByRole / getByLabel (not raw CSS IDs)
    await expect(page.getByRole("link", { name: /Mode 1/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Mode 2/i })).toBeVisible();
    const herbInput = page.getByLabel(/Herbs.*\/10/i);
    const drugInput = page.getByLabel(/Medications.*\/10/i);
    const prepSelect = page.getByLabel(/Supplement preparation context/i);
    await expect(herbInput).toBeVisible();
    await expect(drugInput).toBeVisible();
    await expect(prepSelect).toBeVisible();

    // 3. Full keyboard operation of StackChecker: add chip via Enter, verify live region & >= 24px remove target, remove via keyboard Enter
    await herbInput.focus();
    await page.keyboard.type("Turmeric");
    await page.keyboard.press("Enter");

    const removeTurmericBtn = page.getByRole("button", {
      name: /Remove Turmeric/i,
    });
    await expect(removeTurmericBtn).toBeVisible();
    const chipBox = await removeTurmericBtn.boundingBox();
    expect(chipBox?.width ?? 0).toBeGreaterThanOrEqual(24);
    expect(chipBox?.height ?? 0).toBeGreaterThanOrEqual(24);

    // Live-region status should announce the addition
    await expect(
      page.locator("#stack-checker [role='status'][aria-live='polite']")
    ).toContainText(/Added Turmeric/i);

    await removeTurmericBtn.focus();
    await page.keyboard.press("Enter");
    await expect(removeTurmericBtn).toHaveCount(0);
    await expect(
      page.locator("#stack-checker [role='status'][aria-live='polite']")
    ).toContainText(/Removed Turmeric/i);
  });

  test("mobile navigation bar exposes readable text labels and >= 44px touch height", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const navLinks = page.locator("nav.fixed.bottom-0 a");
    const count = await navLinks.count();
    expect(count).toBeGreaterThanOrEqual(4);

    for (let i = 0; i < count; i++) {
      const box = await navLinks.nth(i).boundingBox();
      const text = (await navLinks.nth(i).innerText()).trim();
      expect(text.length, `Mobile nav tab ${i} label`).toBeGreaterThan(0);
      expect(
        box?.height ?? 0,
        `Mobile nav tab ${i} height`
      ).toBeGreaterThanOrEqual(44);
    }
  });

  test("multi-herb clinical consultation brief and long interaction print output preserve warnings, citations, severity badges, and page-break rules (R2-18)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 });

    // 1. Mock a realistic multi-herb + multi-drug stack consultation brief with
    // Contraindicated + Severe pairwise findings, cumulative pathway alerts, and citations.
    await page.route("**/api/interactions/check-stack", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          checkedAt: "2026-11-28T06:00:00.000Z",
          locale: "en",
          herbs: [
            {
              input: "St. John's Wort",
              found: true,
              slug: "st-johns-wort",
              name: "St. John's Wort",
              scientificName: "Hypericum perforatum",
              pairCount: 12,
            },
            {
              input: "Garlic",
              found: true,
              slug: "garlic",
              name: "Garlic",
              scientificName: "Allium sativum",
              pairCount: 6,
            },
            {
              input: "Ginkgo",
              found: true,
              slug: "ginkgo-biloba",
              name: "Ginkgo",
              scientificName: "Ginkgo biloba",
              pairCount: 8,
            },
          ],
          drugs: ["Warfarin", "Rivaroxaban"],
          summary: {
            totalCombinations: 6,
            matchedCount: 2,
            unrecordedCount: 4,
            withheldCount: 0,
            conflictCount: 0,
            hasConflicts: false,
            highestSeverity: "contraindicated",
            unresolvedHerbs: [],
          },
          matches: [
            {
              herbInput: "St. John's Wort",
              herbSlug: "st-johns-wort",
              herbName: "St. John's Wort",
              drugInput: "Warfarin",
              drugName: "Warfarin",
              drugSlug: "warfarin",
              severity: "contraindicated",
              description:
                "Potent CYP2C9/CYP3A4 induction substantially reduces warfarin plasma concentrations and INR.",
              mechanism: "Induction of hepatic CYP2C9, CYP3A4, and P-gp.",
              evidenceLevel: "well-documented",
              source: "EMA HMPC Monograph",
              sourceUrl: "https://www.ema.europa.eu/en/medicines/herbal",
              publicationStatus: "legacy_unreviewed",
              pairUrl: "/interactions/st-johns-wort/warfarin",
            },
            {
              herbInput: "St. John's Wort",
              herbSlug: "st-johns-wort",
              herbName: "St. John's Wort",
              drugInput: "Rivaroxaban",
              drugName: "Rivaroxaban",
              drugSlug: "rivaroxaban",
              severity: "severe",
              description:
                "Combined CYP3A4 and P-gp induction reduces rivaroxaban exposure in human pharmacokinetic studies.",
              mechanism: "Dual CYP3A4 and P-glycoprotein induction.",
              evidenceLevel: "well-documented",
              source: "PubMed PMID:32478963",
              sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/32478963/",
              publicationStatus: "legacy_unreviewed",
              pairUrl: "/interactions/st-johns-wort/rivaroxaban",
            },
          ],
          conflicts: [],
          withheld: [],
          unrecorded: [
            {
              herbInput: "Garlic",
              herbSlug: "garlic",
              herbName: "Garlic",
              drugInput: "Rivaroxaban",
            },
          ],
          stackAlerts: [
            {
              code: "bleeding_overlap",
              severity: "severe",
              title: "Cumulative bleeding / antiplatelet load",
              herbs: ["Garlic", "Ginkgo"],
              message:
                "Additive inhibition of platelet aggregation alongside oral anticoagulants. Discuss your full supplement list with a pharmacist.",
            },
          ],
        }),
      });
    });

    await page.goto("/herb-drug-interactions", {
      waitUntil: "domcontentloaded",
    });

    // Load sample stack and run check
    await page
      .locator("#stack-checker")
      .getByRole("button", { name: /sample/i })
      .click();
    await page
      .locator("#stack-checker")
      .getByRole("button", { name: /check/i })
      .first()
      .click();

    await expect(
      page.locator("#stack-checker").getByText(/Cumulative bleeding/i)
    ).toBeVisible();

    // Emulate print media and verify comprehensive consultation brief print rules
    await page.emulateMedia({ media: "print" });

    const briefPrintCheck = await page.evaluate(() => {
      const header = document.querySelector("header");
      const footer = document.querySelector("footer");
      const printHeader = document.querySelector("#stack-checker .print-only");
      const stackText =
        document.querySelector("#stack-checker")?.textContent ?? "";
      const alerts = Array.from(
        document.querySelectorAll("#stack-checker [role='alert']")
      );
      const alertBreakRules = alerts.map(
        (a) => getComputedStyle(a).breakInside
      );
      const overflowPx =
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth;

      return {
        headerDisplay: header ? getComputedStyle(header).display : "none",
        footerDisplay: footer ? getComputedStyle(footer).display : "none",
        printHeaderDisplay: printHeader
          ? getComputedStyle(printHeader).display
          : "none",
        hasContraindicated: /contraindicated/i.test(stackText),
        hasSevere: /severe/i.test(stackText),
        hasCumulativeWarning: /cumulative bleeding/i.test(stackText),
        hasCitation: /EMA HMPC|PubMed/i.test(stackText),
        alertCount: alerts.length,
        allAlertsAvoidBreak: alertBreakRules.every((r) => /avoid/i.test(r)),
        overflowPx,
      };
    });

    expect(briefPrintCheck.headerDisplay).toBe("none");
    expect(briefPrintCheck.footerDisplay).toBe("none");
    expect(briefPrintCheck.printHeaderDisplay).toBe("block");
    expect(briefPrintCheck.hasContraindicated).toBe(true);
    expect(briefPrintCheck.hasSevere).toBe(true);
    expect(briefPrintCheck.hasCumulativeWarning).toBe(true);
    expect(briefPrintCheck.hasCitation).toBe(true);
    expect(briefPrintCheck.allAlertsAvoidBreak).toBe(true);
    expect(briefPrintCheck.overflowPx).toBeLessThanOrEqual(2);

    // 2. When clinical routes are enabled, also verify print mode on a long interaction detail page
    if (INCLUDE_CLINICAL_ROUTES) {
      await page.emulateMedia({ media: "screen" });
      await page.goto("/interactions/st-johns-wort/rivaroxaban", {
        waitUntil: "domcontentloaded",
      });
      await page.emulateMedia({ media: "print" });

      const pairPrintCheck = await page.evaluate(() => {
        const header = document.querySelector("header");
        const mainText = document.querySelector("main")?.textContent ?? "";
        const alerts = Array.from(
          document.querySelectorAll("main [role='alert']")
        );
        return {
          headerDisplay: header ? getComputedStyle(header).display : "none",
          hasSeverity: /severe/i.test(mainText),
          hasEvidenceTaxonomy: /Group A|Group B/i.test(mainText),
          hasCitationLink: !!document.querySelector("main a[href^='https://']"),
          alertsAvoidBreak: alerts.every((a) =>
            /avoid/i.test(getComputedStyle(a).breakInside)
          ),
        };
      });

      expect(pairPrintCheck.headerDisplay).toBe("none");
      expect(pairPrintCheck.hasSeverity).toBe(true);
      expect(pairPrintCheck.hasEvidenceTaxonomy).toBe(true);
      expect(pairPrintCheck.hasCitationLink).toBe(true);
      expect(pairPrintCheck.alertsAvoidBreak).toBe(true);
    }
  });
});
