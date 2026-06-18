import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

/**
 * Marketing landing page (/). Asserts the current (post-redesign) hero:
 * a server-rendered herb+medication interaction checker, not the old
 * feature-grid marketing page.
 */
test.describe("Marketing landing page (/)", () => {
  test("renders the hero, search, and browse-herbs link", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/HerbAlly/i);

    // Server-rendered hero (LCP)
    await expect(
      page.getByRole("heading", { name: /Check herb-drug interactions/i })
    ).toBeVisible();
    await expect(
      page.getByText(/Type any herb and medication to see if they/i)
    ).toBeVisible();

    // Interaction-checker inputs + button
    await expect(page.getByPlaceholder(/Herb name/i)).toBeVisible();
    await expect(page.getByPlaceholder(/Medication/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Check interaction/i })
    ).toBeVisible();

    // "Browse all herbs" link lands on the catalog
    const browse = page.getByRole("link", { name: /Browse all herbs/i });
    await expect(browse).toBeVisible();
    await expect(browse).toHaveAttribute("href", "/herbs");
  });

  test("preserves deep-link redirects to /herbalist (?herb=)", async ({
    page,
  }) => {
    await page.goto("/?herb=ginger");
    await expect(page).toHaveURL(/\/herbalist/);
  });

  test("redirects /?medications=warfarin to /herbalist", async ({ page }) => {
    await page.goto("/?medications=warfarin");
    await expect(page).toHaveURL(/\/herbalist/);
  });

  test("passes basic a11y checks (no critical violations)", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(blocking).toEqual([]);
  });
});
