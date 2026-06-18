import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Accessibility regression guard. Runs axe-core on the key public pages and
 * fails on critical/serious violations only (minor/best-practice are reported
 * but non-blocking, to avoid flaky failures from third-party widgets).
 */
const PAGES = ["/", "/herbs", "/herbalist", "/calculator", "/about", "/faq"];

for (const path of PAGES) {
  test(`${path} has no critical/serious a11y violations`, async ({ page }) => {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    // Allow the hero/animations to settle.
    await page.waitForTimeout(500);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    if (blocking.length > 0) {
      const summary = blocking
        .map(
          (v) =>
            `${v.id} (${v.impact}): ${v.nodes.length} node(s) — ${v.helpUrl}`
        )
        .join("\n");
      throw new Error(`Accessibility violations on ${path}:\n${summary}`);
    }
    expect(blocking).toEqual([]);
  });
}
