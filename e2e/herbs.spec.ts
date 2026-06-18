import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

test.describe.skip("Herbs Catalog — STALE: overly-broad text selectors (strict-mode violations), needs rewrite against current UI", () => {
  test("should load herbs catalog", async ({ page }) => {
    await page.goto("/herbs");

    await expect(page).toHaveTitle(/Herbs|HerbAlly/);
    await expect(page.locator("text=Herbs")).toBeVisible();
  });

  test("should display herb cards", async ({ page }) => {
    await page.goto("/herbs");

    await page.waitForSelector(
      '[data-testid="herb-card"], article, .herb-card',
      { timeout: 10000 }
    );

    const herbCards = page
      .locator('[data-testid="herb-card"], article, .herb-card')
      .first();
    await expect(herbCards).toBeVisible();
  });

  test("should search for herbs", async ({ page }) => {
    await page.goto("/herbs");

    const searchInput = page.locator(
      'input[type="text"][placeholder*="search" i]'
    );
    await expect(searchInput).toBeVisible();

    await searchInput.fill("ginger");
    await page.waitForTimeout(1000);

    const results = page.locator(
      '[data-testid="herb-card"], article, .herb-card'
    );
    await expect(results.first()).toBeVisible();
  });

  test("should clear search", async ({ page }) => {
    await page.goto("/herbs");

    const searchInput = page.locator('input[type="text"]');
    await searchInput.fill("test query");

    const clearButton = page
      .locator('button[aria-label*="clear" i], button:has-text("Clear")')
      .first();
    await expect(clearButton).toBeVisible();

    await clearButton.click();
    await expect(searchInput).toHaveValue("");
  });

  test("should navigate to herb detail page", async ({ page }) => {
    await page.goto("/herbs");

    await page.waitForSelector('a[href^="/herbs/"]', { timeout: 10000 });

    const firstHerbLink = page.locator('a[href^="/herbs/"]').first();
    await firstHerbLink.click();

    await page.waitForURL(/\/herbs\/[\w-]+/);
    await expect(page.locator("h1")).toBeVisible();
  });

  test("should filter by category", async ({ page }) => {
    await page.goto("/herbs");

    const categorySelect = page
      .locator('select, button[aria-label*="category" i]')
      .first();

    if ((await categorySelect.count()) > 0) {
      await expect(categorySelect).toBeVisible();
    }
  });

  test("should support pagination or infinite scroll", async ({ page }) => {
    await page.goto("/herbs");

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    const pagination = page.locator(
      '[aria-label*="pagination"], .pagination, nav[aria-label*="Page"]'
    );
    const hasMoreContent =
      (await page
        .locator('[data-testid="herb-card"], article, .herb-card')
        .count()) > 0;

    expect(hasMoreContent || (await pagination.count()) > 0).toBeTruthy();
  });

  test("should handle empty search results gracefully", async ({ page }) => {
    await page.goto("/herbs");

    const searchInput = page.locator('input[type="text"]');
    await searchInput.fill("xyznonexistentherb123");
    await page.waitForTimeout(1000);

    const emptyState = page.locator(
      'text=no results, text=no herbs found, text=nothing found, [class*="empty"], [class*="no-results"]'
    );
    const hasResults =
      (await page
        .locator('[data-testid="herb-card"], article, .herb-card')
        .count()) > 0;

    expect((await emptyState.count()) > 0 || !hasResults).toBeTruthy();
  });

  test("should have accessible herb cards", async ({ page }) => {
    await page.goto("/herbs");

    await page.waitForSelector('a[href^="/herbs/"]', { timeout: 10000 });

    const firstHerbLink = page.locator('a[href^="/herbs/"]').first();
    await expect(firstHerbLink).toHaveAttribute("href");

    const card = firstHerbLink.locator("..");
    const hasAltText = (await card.locator("img[alt]").count()) > 0;
    const hasAriaLabel = await firstHerbLink.getAttribute("aria-label");

    expect(hasAltText || hasAriaLabel).toBeTruthy();
  });

  test("passes basic a11y checks (no critical violations)", async ({
    page,
  }) => {
    await page.goto("/herbs");
    await page.waitForSelector('a[href^="/herbs/"]', { timeout: 10000 });

    const accessibilityScanResults = await new AxeBuilder({ page })
      .disableRules(["color-contrast"])
      .analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
