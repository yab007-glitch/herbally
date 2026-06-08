import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

test.describe("Homepage (Chat-First)", () => {
  test("should load homepage successfully", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/HerbAlly/);
    // Chat input should be visible in the empty state
    await expect(
      page.locator('textarea[aria-label="Chat message input"]')
    ).toBeVisible();
  });

  test("should display navigation links", async ({ page }) => {
    await page.goto("/");

    // Main navigation links (from MainNavbar). Use .first() because both
    // desktop navbar and mobile tab bar contain links with the same href.
    await expect(page.locator('a[href="/symptoms"]').first()).toBeVisible();
    await expect(page.locator('a[href="/herbs"]').first()).toBeVisible();
    await expect(page.locator('a[href="/calculator"]').first()).toBeVisible();
  });

  test("should show AI badge and heading in empty state", async ({ page }) => {
    await page.goto("/");

    // Badge
    await expect(
      page.locator("text=AI-Powered Herbal Assistant")
    ).toBeVisible();

    // Title
    await expect(
      page.locator("text=Ask anything about herbs and natural health")
    ).toBeVisible();
  });

  test("should show suggestion cards", async ({ page }) => {
    await page.goto("/");

    // Should have suggestion buttons to click
    await expect(
      page.locator("text=What herbs help with sleep?")
    ).toBeVisible();
    await expect(
      page.locator("text=Is turmeric safe with blood thinners?")
    ).toBeVisible();
  });

  test("should show command hint", async ({ page }) => {
    await page.goto("/");

    // Should display the /calculator, /compare hint
    await expect(page.locator("text=/calculator")).toBeVisible();
  });

  test("should transition to active chat on message send", async ({ page }) => {
    await page.goto("/");

    const input = page.locator('textarea[aria-label="Chat message input"]');

    // Type a message
    await input.fill("Hello, tell me about chamomile");
    await page.keyboard.press("Enter");

    // The empty-state heading should disappear
    await expect(
      page.locator("text=AI-Powered Herbal Assistant")
    ).not.toBeVisible({ timeout: 5000 });

    // The user message bubble should be visible (use .first() since
    // the same text also appears in the slim conversation title bar)
    await expect(
      page.locator("text=Hello, tell me about chamomile").first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("should show disclaimer", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.locator("text=This AI provides educational information only")
    ).toBeVisible();
  });

  test("should have accessible skip link", async ({ page }) => {
    await page.goto("/");

    const skipLink = page.locator('[href="#main-content"]');
    await expect(skipLink).toBeVisible();
  });

  test("should support dark mode toggle", async ({ page }) => {
    await page.goto("/");

    const themeToggle = page
      .locator('[aria-label*="theme"], button:has-text("Theme")')
      .first();
    await expect(themeToggle).toBeVisible();
  });

  test("should have language selector", async ({ page }) => {
    await page.goto("/");

    const langSelector = page
      .locator('button:has-text("EN"), button:has-text("FR")')
      .first();
    await expect(langSelector).toBeVisible();
  });

  test("should load without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto("/");
    await page.waitForTimeout(2000);

    const unexpectedErrors = errors.filter(
      (error) =>
        !error.includes("Failed to load resource") &&
        !error.includes("favicon") &&
        // Ignore missing browser APIs in test env (SpeechRecognition etc.)
        !error.includes("not defined")
    );

    expect(unexpectedErrors.length).toBe(0);
  });

  test("should have valid meta tags for SEO", async ({ page }) => {
    await page.goto("/");

    const description = await page
      .locator('meta[name="description"]')
      .getAttribute("content");
    expect(description).toBeTruthy();
    expect(description!.length).toBeGreaterThan(50);

    const ogTitle = await page
      .locator('meta[property="og:title"]')
      .getAttribute("content");
    expect(ogTitle).toBeTruthy();

    const ogDescription = await page
      .locator('meta[property="og:description"]')
      .getAttribute("content");
    expect(ogDescription).toBeTruthy();
  });

  test("should have responsive design", async ({ page }) => {
    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    // Mobile menu button should be visible
    const mobileMenu = page
      .locator('[aria-label*="menu"], button:has-text("Menu")')
      .first();
    await expect(mobileMenu).toBeVisible();

    // Mobile tab bar should be visible
    await expect(page.locator("text=Chat")).toBeVisible();
  });

  test("should show stats bar in empty state", async ({ page }) => {
    await page.goto("/");

    // Stats should be visible before any messages are sent
    await expect(page.locator("text=2,700+")).toBeVisible();
    await expect(page.locator("text=500+")).toBeVisible();
    await expect(page.locator("text=100%")).toBeVisible();
  });

  test("should clear chat via clear button", async ({ page }) => {
    await page.goto("/");

    const input = page.locator('textarea[aria-label="Chat message input"]');
    await input.fill("Hello");
    await page.keyboard.press("Enter");

    // Wait for the conversation bar to appear (means chat is active)
    const clearBtn = page.locator('button:has-text("Clear")');
    await expect(clearBtn).toBeVisible({ timeout: 10000 });

    // Click clear
    await clearBtn.click();

    // Should go back to empty state with suggestions
    await expect(page.locator("text=What herbs help with sleep?")).toBeVisible({
      timeout: 5000,
    });
  });

  test("should have no critical accessibility violations", async ({ page }) => {
    await page.goto("/");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === "critical"
    );

    expect(criticalViolations).toHaveLength(0);
  });
});
