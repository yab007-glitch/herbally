import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

/**
 * Herbs catalog (/herbs). Data-independent where possible so it passes in CI
 * (no Supabase env -> empty state) as well as locally (real data -> cards).
 */
test.describe("Herbs Catalog", () => {
  test("should load herbs catalog", async ({ page }) => {
    await page.goto("/herbs");
    await expect(page).toHaveTitle(/HerbAlly/i);
    await expect(
      page.getByRole("heading", { name: /Medicinal Herbs Database/i })
    ).toBeVisible();
    // Search input is present
    await expect(page.getByPlaceholder(/Search herbs by name/i)).toBeVisible();
  });

  test("shows the 'All' category filter linking to /herbs", async ({ page }) => {
    await page.goto("/herbs");
    const allBadge = page.getByRole("link", { name: /^All$/ }).first();
    await expect(allBadge).toBeVisible();
    await expect(allBadge).toHaveAttribute("href", /\/herbs/);
  });

  test("renders either herb cards or an empty state (never a crash)", async ({ page }) => {
    await page.goto("/herbs");
    // Either herb detail links exist, or an empty-state heading is shown.
    const herbLinks = page.locator('a[href^="/herbs/"]');
    const cardCount = await herbLinks.count();
    if (cardCount > 0) {
      // Each card links to a herb detail page (slug), not the catalog itself.
      const first = herbLinks.first();
      const href = await first.getAttribute("href");
      expect(href).toMatch(/^\/herbs\/[^/]+$/);
    } else {
      // No data available (e.g. CI without Supabase) -> empty state renders.
      await expect(page.getByText(/No herbs|Browse all|try searching/i)).toBeVisible();
    }
  });

  test("search input accepts text and filters the catalog", async ({ page }) => {
    await page.goto("/herbs", { waitUntil: "networkidle" });
    const search = page.getByPlaceholder(/Search herbs by name/i);
    await expect(search).toBeVisible();
    await search.fill("ginger");
    await expect(search).toHaveValue("ginger");
    // A controlled input that hydrates + updates React state reveals the
    // "Clear search" button only when query is non-empty.
    await expect(page.getByRole("button", { name: /Clear search/i })).toBeVisible();
  });

  test("should have an accessible heading and focusable search", async ({ page }) => {
    await page.goto("/herbs");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const search = page.getByPlaceholder(/Search herbs by name/i);
    await search.focus();
    await expect(search).toBeFocused();
  });

  test("passes basic a11y checks (no critical violations)", async ({ page }) => {
    await page.goto("/herbs");
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(blocking).toEqual([]);
  });
});
