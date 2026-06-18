import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

/**
 * Dosage calculator (/calculator). The form is dynamically imported on the
 * client, so we wait for the "Calculate" button (and networkidle) before
 * interacting to ensure it has hydrated.
 */
test.describe("Dosage Calculator", () => {
  test("should load calculator page", async ({ page }) => {
    await page.goto("/calculator");
    await expect(page).toHaveTitle(/Dosage|Calculator|HerbAlly/i);
    await expect(
      page.getByRole("heading", { name: /Dosage Calculator/i })
    ).toBeVisible();
  });

  test("should display calculator form", async ({ page }) => {
    await page.goto("/calculator", { waitUntil: "networkidle" });
    const calculateBtn = page.getByRole("button", { name: /^Calculate$/ });
    await expect(calculateBtn).toBeVisible();

    await expect(page.getByLabel(/Herb Name/i)).toBeVisible();
    await expect(page.getByLabel(/Adult Dose/i)).toBeVisible();
    await expect(page.getByLabel(/Child's Weight/i)).toBeVisible();
  });

  test("should calculate a child dose from weight (Clark's rule)", async ({
    page,
  }) => {
    await page.goto("/calculator", { waitUntil: "networkidle" });
    const calculateBtn = page.getByRole("button", { name: /^Calculate$/ });
    await expect(calculateBtn).toBeVisible();

    // Clark's rule is the default and needs adult dose + weight.
    await page.getByLabel(/Herb Name/i).fill("Ginger");
    await page.getByLabel(/Adult Dose/i).fill("500");
    await page.getByLabel(/Child's Weight/i).fill("30");
    await calculateBtn.click();

    // The result renders a numeric dose in the large dose-value container
    // (unique to the result card). toHaveText(regex) matches the full text,
    // e.g. "100mg" or "220.6mg" (dose + unit).
    const doseValue = page.locator(".text-4xl").first();
    await expect(doseValue).toBeVisible();
    await expect(doseValue).toHaveText(/\d+(\.\d+)?\s*(mg|ml|g|drops)/);
  });

  test("should show a validation error when calculating with no dose", async ({
    page,
  }) => {
    await page.goto("/calculator", { waitUntil: "networkidle" });
    const calculateBtn = page.getByRole("button", { name: /^Calculate$/ });
    await expect(calculateBtn).toBeVisible();
    await calculateBtn.click();
    // Localized invalid-dose error is rendered in the error alert.
    await expect(page.getByText(/enter a valid adult dose/i)).toBeVisible();
  });

  test("should show disclaimers", async ({ page }) => {
    await page.goto("/calculator");
    // The FDA disclaimer banner is rendered by the (main) layout on every page.
    await expect(
      page.getByText(/not intended to diagnose, treat, cure, or prevent/i)
    ).toBeVisible();
  });

  test("passes basic a11y checks (no critical violations)", async ({
    page,
  }) => {
    await page.goto("/calculator", { waitUntil: "networkidle" });
    const calculateBtn = page.getByRole("button", { name: /^Calculate$/ });
    await expect(calculateBtn).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(blocking).toEqual([]);
  });
});
