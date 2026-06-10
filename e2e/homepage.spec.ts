import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

test.describe("Marketing landing page (/)", () => {
  test("renders the hero, CTAs, and stats", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/HerbAlly/);
    // Hero copy
    await expect(
      page.getByText(/Your Complete Guide to Medicinal Herbs/i)
    ).toBeVisible();
    // Two CTAs land on real routes
    const exploreBtn = page
      .getByRole("link", { name: /Explore Herbs/i })
      .first();
    const askBtn = page
      .getByRole("link", { name: /Ask AI Herbalist/i })
      .first();
    await expect(exploreBtn).toBeVisible();
    await expect(askBtn).toBeVisible();
    await expect(exploreBtn).toHaveAttribute("href", "/herbs");
    await expect(askBtn).toHaveAttribute("href", "/herbalist");
    // Stats numbers
    await expect(page.getByText(/Herbs Documented/i)).toBeVisible();
  });

  test("preserves deep-link redirects to /herbalist", async ({ page }) => {
    // Old IA: /?herb=ginger used to load the chat pre-filled with ginger.
    // The 308 redirect in next.config.ts should now bounce to /herbalist.
    await page.goto("/?herb=ginger");
    await expect(page).toHaveURL(/\/herbalist/);
  });

  test("redirects /?medications=warfarin to /herbalist", async ({ page }) => {
    await page.goto("/?medications=warfarin");
    await expect(page).toHaveURL(/\/herbalist/);
  });

  test("renders the feature grid with all four feature cards", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByText(/Medicinal Herbs/i).first()
    ).toBeVisible();
    await expect(
      page.getByText(/Dosage Calculator/i).first()
    ).toBeVisible();
    await expect(
      page.getByText(/Interaction Checker/i).first()
    ).toBeVisible();
    await expect(
      page.getByText(/Virtual Herbalist/i).first()
    ).toBeVisible();
  });

  test("has valid meta tags for SEO", async ({ page }) => {
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
  });

  test("passes basic a11y checks (no critical violations)", async ({
    page,
  }) => {
    await page.goto("/");
    const accessibilityScanResults = await new AxeBuilder({ page })
      .disableRules(["color-contrast"])
      .analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
