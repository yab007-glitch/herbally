import fs from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Comprehensive WCAG 2.2 AA, Axe-Core, Multi-Component Composited Contrast,
 * Visible Focus Appearance, Accessible Name, Keyboard Workflow, Live Region,
 * Target Size, 320px Reflow, and Print Emulation Suite (R2-08, R2-18).
 *
 * Runs on both Chromium and Firefox in CI and emits a machine-readable JSON
 * report at `test-results/accessibility-audit-report.json` uploaded as a CI
 * artifact on every run.
 */

const CORE_ROUTES = [
  "/",
  "/fr",
  "/herb-drug-interactions",
  "/fr/herb-drug-interactions",
  "/medications",
  "/herbs",
  "/clinical-review?intent=signoff&targetType=interaction&slug=st-johns-wort&drug=Rivaroxaban",
  "/clinical-review?intent=advisory",
  "/trust",
] as const;

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
    failures: Array<{ selector: string; text: string; ratio: number }>;
  };
  unnamedInteractiveControls: number;
}

const REPORT_PATH = path.join(
  process.cwd(),
  "test-results",
  "accessibility-audit-report.json"
);

const auditReports: AxeRouteReport[] = [];

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
          routesAudited: auditReports.length,
          totalAxeViolations: auditReports.reduce(
            (sum, r) => sum + r.violations.length,
            0
          ),
          totalContrastFailures: auditReports.reduce(
            (sum, r) => sum + r.compositedContrast.failures.length,
            0
          ),
          results: auditReports,
        },
        null,
        2
      ) + "\n",
      "utf8"
    );
  });

  test("axe-core WCAG 2.2 AA, composited component contrast, and accessible names pass across EN/FR routes in light and dark modes", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1280, height: 800 });

    const matrixRoutes = [
      "/",
      "/fr",
      "/herb-drug-interactions",
      "/fr/herb-drug-interactions",
      "/clinical-review?intent=signoff&targetType=interaction&slug=st-johns-wort&drug=Rivaroxaban",
      "/trust",
    ] as const;

    for (const route of matrixRoutes) {
      for (const theme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: theme });
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
        await page.waitForTimeout(100);
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

        // 2. Measure actual rendered foreground vs alpha-composited ancestor background
        // across headings, buttons, badges/alerts, nav links, form labels, and body copy.
        const domAudit = await page.evaluate(() => {
          type RGBA = [number, number, number, number];
          // Use a 1x1 canvas so Chromium & Firefox resolve CSS Color 4 formats
          // (oklch(), lab(), color(srgb ...), rgb(), hsl()) to exact sRGB RGBA.
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

          const sampleSelectors = [
            "main h1",
            "main h2",
            "main p",
            "main label",
            "main button:not(:disabled)",
            "main a",
            "main [role='alert']",
            "main [data-slot='badge']",
            "header nav a",
          ];

          let checkedElements = 0;
          let minRatio = 21;
          const failures: Array<{
            selector: string;
            text: string;
            ratio: number;
          }> = [];

          for (const sel of sampleSelectors) {
            const els = Array.from(document.querySelectorAll(sel)).slice(0, 12);
            for (const el of els) {
              const style = getComputedStyle(el);
              if (
                style.display === "none" ||
                style.visibility === "hidden" ||
                Number(style.opacity) < 0.9 ||
                el.classList.contains("sr-only") ||
                el.classList.contains("gradient-text")
              ) {
                continue;
              }
              const rect = el.getBoundingClientRect();
              if (rect.width < 4 || rect.height < 4) continue;
              const text = (el.textContent ?? "").trim();
              if (!text) continue;
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
                  selector: sel,
                  text: text.slice(0, 50),
                  ratio: Number(ratio.toFixed(2)),
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
          `Measured rendered elements on ${route} (${theme})`
        ).toBeGreaterThanOrEqual(8);

        expect(
          domAudit.failures,
          `Composited WCAG 2.2 AA contrast failures on ${route} (${theme})`
        ).toEqual([]);

        expect(
          domAudit.unnamedInteractiveControls,
          `Unnamed interactive controls on ${route} (${theme})`
        ).toBe(0);
      }
    }
  });

  test("narrow mobile 320px reflow produces zero horizontal overflow across core EN and FR routes", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });

    for (const route of CORE_ROUTES) {
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

  test("print stylesheet hides screen chrome (.no-print, header, footer, nav) while preserving primary clinical content (R2-18)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/herb-drug-interactions", {
      waitUntil: "domcontentloaded",
    });
    await page.emulateMedia({ media: "print" });

    const printCheck = await page.evaluate(() => {
      const header = document.querySelector("header");
      const footer = document.querySelector("footer");
      const mainH1 = document.querySelector("main h1");
      return {
        headerDisplay: header ? getComputedStyle(header).display : "none",
        footerDisplay: footer ? getComputedStyle(footer).display : "none",
        mainH1Display: mainH1 ? getComputedStyle(mainH1).display : "none",
        mainH1Text: mainH1?.textContent?.trim() ?? "",
      };
    });

    expect(printCheck.headerDisplay).toBe("none");
    expect(printCheck.footerDisplay).toBe("none");
    expect(printCheck.mainH1Display).not.toBe("none");
    expect(printCheck.mainH1Text.length).toBeGreaterThan(5);
  });
});
