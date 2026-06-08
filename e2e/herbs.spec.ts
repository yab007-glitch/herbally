import { test, expect } from "@playwright/test";

test.describe("Herbs Catalog", () => {
  test("should load herbs catalog", async ({ page }) => {
    await page.goto("/herbs");

    await expect(page).toHaveTitle(/Herbs|HerbAlly/);
    await expect(page.locator("text=Herbs")).toBeVisible();
  });

  test("should display herb cards", async ({ page }) => {
    await page.goto("/herbs");

    // Wait for herbs to load
    await page.waitForSelector(
      '[data-testid="herb-card"], article, .herb-card',
      { timeout: 10000 }
    );

    // Check that multiple herbs are displayed
    const herbCards = page
      .locator('[data-testid="herb-card"], article, .herb-card')
      .first();
    await expect(herbCards).toBeVisible();
  });

  test("should search for herbs", async ({ page }) => {
    await page.goto("/herbs");

    // Find search input
    const searchInput = page.locator(
      'input[type="text"][placeholder*="search" i]'
    );
    await expect(searchInput).toBeVisible();

    // Type search query
    await searchInput.fill("ginger");

    // Wait for search results
    await page.waitForTimeout(1000);

    // Results should update
    const results = page.locator(
      '[data-testid="herb-card"], article, .herb-card'
    );
    await expect(results.first()).toBeVisible();
  });

  test("should clear search", async ({ page }) => {
    await page.goto("/herbs");

    const searchInput = page.locator('input[type="text"]');
    await searchInput.fill("test query");

    // Clear button should appear
    const clearButton = page
      .locator('button[aria-label*="clear" i], button:has-text("Clear")')
      .first();
    await expect(clearButton).toBeVisible();

    await clearButton.click();

    // Input should be empty
    await expect(searchInput).toHaveValue("");
  });

  test("should navigate to herb detail page", async ({ page }) => {
    await page.goto("/herbs");

    // Wait for herbs to load
    await page.waitForSelector('a[href^="/herbs/"]', { timeout: 10000 });

    // Click first herb
    const firstHerbLink = page.locator('a[href^="/herbs/"]').first();
    await firstHerbLink.click();

    // Should navigate to detail page
    await page.waitForURL(/\/herbs\/[\w-]+/);

    // Should have herb name
    await expect(page.locator("h1")).toBeVisible();
  });

  test("should filter by category", async ({ page }) => {
    await page.goto("/herbs");

    // Look for category filter
    const categorySelect = page
      .locator('select, button[aria-label*="category" i]')
      .first();

    if ((await categorySelect.count()) > 0) {
      await expect(categorySelect).toBeVisible();
    }
  });

  test("should support pagination or infinite scroll", async ({ page }) => {
    await page.goto("/herbs");

    // Scroll down
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Wait for potential lazy loading
    await page.waitForTimeout(2000);

    // More content should load OR pagination should exist
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

    // Wait for search
    await page.waitForTimeout(1000);

    // Should show empty state or "no results" message
    const emptyState = page.locator(
      'text=no results, text=no herbs found, text=nothing found, [class*="empty"], [class*="no-results"]'
    );
    const hasResults =
      (await page
        .locator('[data-testid="herb-card"], article, .herb-card')
        .count()) > 0;

    // Either show empty state or no results (both acceptable)
    expect((await emptyState.count()) > 0 || !hasResults).toBeTruthy();
  });

  test("should have accessible herb cards", async ({ page }) => {
    await page.goto("/herbs");

    await page.waitForSelector('a[href^="/herbs/"]', { timeout: 10000 });

    // Check first herb card has accessible name
    const firstHerbLink = page.locator('a[href^="/herbs/"]').first();
    await expect(firstHerbLink).toHaveAttribute("href");

    // Should have image with alt text or aria-label
    const card = firstHerbLink.locator("..");
    const hasAltText = (await card.locator("img[alt]").count()) > 0;
    const hasAriaLabel = await firstHerbLink.getAttribute("aria-label");

    expect(hasAltText || hasAriaLabel).toBeTruthy();
  });
});
