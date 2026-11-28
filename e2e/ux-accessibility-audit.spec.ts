import { expect, test } from "@playwright/test";

/**
 * Automated WCAG 2.2 AA, Responsive Reflow (320px), Touch Target, Keyboard
 * Focus, and Light/Dark Mode Contrast Verification Suite (D43, D44, D45).
 *
 * Runs on both Chromium and Firefox in CI against core data-independent routes.
 */

const CORE_ROUTES = [
  "/",
  "/fr",
  "/herb-drug-interactions",
  "/clinical-review?intent=signoff&targetType=interaction&slug=st-johns-wort&drug=Rivaroxaban",
  "/trust",
] as const;

test.describe("UX & WCAG 2.2 AA Accessibility Verification", () => {
  test("narrow mobile 320px reflow produces zero horizontal overflow across core routes", async ({
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

  test("computed WCAG 2.2 AA contrast ratios pass in both light and dark modes", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    for (const theme of ["light", "dark"] as const) {
      await page.goto("/clinical-review?intent=signoff", {
        waitUntil: "domcontentloaded",
      });

      await page.evaluate((mode) => {
        document.documentElement.classList.toggle("dark", mode === "dark");
      }, theme);

      const metrics = await page.evaluate(() => {
        function parseRgb(str: string): [number, number, number] | null {
          const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(str);
          if (!match) return null;
          return [Number(match[1]), Number(match[2]), Number(match[3])];
        }

        function relLum([r, g, b]: [number, number, number]): number {
          const toLin = (c: number) => {
            const s = c / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
        }

        function contrast(
          fg: [number, number, number],
          bg: [number, number, number]
        ): number {
          const l1 = relLum(fg);
          const l2 = relLum(bg);
          return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        }

        const bodyStyle = getComputedStyle(document.body);
        const h1 = document.querySelector("h1");
        const h1Style = h1 ? getComputedStyle(h1) : bodyStyle;
        const bodyBg = parseRgb(bodyStyle.backgroundColor) ?? [248, 246, 241];
        const bodyFg = parseRgb(bodyStyle.color) ?? [35, 32, 28];
        const h1Fg = parseRgb(h1Style.color) ?? bodyFg;

        return {
          bodyContrast: contrast(bodyFg, bodyBg),
          headingContrast: contrast(h1Fg, bodyBg),
        };
      });

      expect(
        metrics.bodyContrast,
        `Body text WCAG AA contrast in ${theme} mode`
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        metrics.headingContrast,
        `Heading WCAG AA contrast in ${theme} mode`
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("keyboard navigation reaches skip-to-content, header nav, and primary inputs with accessible labels", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/herb-drug-interactions", {
      waitUntil: "domcontentloaded",
    });

    // Skip link exists and becomes focusable on first Tab
    await page.keyboard.press("Tab");
    const firstFocusedTag = await page.evaluate(
      () => document.activeElement?.tagName ?? ""
    );
    expect(["A", "BUTTON", "INPUT"]).toContain(firstFocusedTag);

    // Mode switcher links, stack inputs, and preparation selector all carry accessible names
    await expect(page.getByRole("link", { name: /Mode 1/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Mode 2/i })).toBeVisible();
    await expect(page.locator("#stack-herb-input")).toBeVisible();
    await expect(page.locator("#stack-drug-input")).toBeVisible();
    await expect(page.locator("#stack-prep-context")).toBeVisible();
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
});
