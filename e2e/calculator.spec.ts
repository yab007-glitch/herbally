import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

/**
 * Dosage calculator (/calculator). The form is dynamically imported on the
 * client, so we wait for the "Calculate" button (and networkidle) before
 * interacting to ensure it has hydrated.
 *
 * The calculator is adult-only: it refuses to produce a number for anyone
 * under 18 and its inputs are labelled "Adult age (years)" / "Adult weight
 * (kg)". Do not reintroduce the old pediatric "Patient weight" / "Patient
 * age" selectors — those labels no longer exist and the resulting failures
 * were locator timeouts that looked like flakiness.
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
    await expect(page.getByLabel(/Adult weight/i)).toBeVisible();
    await expect(page.getByLabel(/Adult age/i)).toBeVisible();
  });

  test("should calculate a reference dose for an adult", async ({ page }) => {
    await page.goto("/calculator", { waitUntil: "networkidle" });
    const calculateBtn = page.getByRole("button", { name: /^Calculate$/ });
    await expect(calculateBtn).toBeVisible();

    // Clark's rule is the default and needs adult dose, weight and age.
    await page.getByLabel(/Herb Name/i).fill("Ginger");
    await page.getByLabel(/Adult Dose/i).fill("500");
    await page.getByLabel(/Adult weight/i).fill("70");
    await page.getByLabel(/Adult age/i).fill("30");
    await calculateBtn.click();

    // The result renders a numeric dose in the large dose-value container
    // (unique to the result card). toHaveText(regex) matches the full text,
    // e.g. "100mg" or "220.6mg" (dose + unit).
    const doseValue = page.locator(".text-4xl").first();
    await expect(doseValue).toBeVisible();
    await expect(doseValue).toHaveText(/\d+(\.\d+)?\s*(mg|ml|g|drops)/);
  });

  test("refuses to calculate a dose for a minor", async ({ page }) => {
    await page.goto("/calculator", { waitUntil: "networkidle" });
    const calculateBtn = page.getByRole("button", { name: /^Calculate$/ });
    await expect(calculateBtn).toBeVisible();

    // Regression: 500 mg adult dose, 60 kg, age 8 previously produced
    // "441.2 mg" despite the under-18 block. The calculator must refuse any
    // patient under 18 rather than emit a number.
    await page.getByLabel(/Herb Name/i).fill("Turmeric");
    await page.getByLabel(/Adult Dose/i).fill("500");
    await page.getByLabel(/Adult weight/i).fill("60");
    await page.getByLabel(/Adult age/i).fill("8");
    await calculateBtn.click();

    await expect(
      page.getByText(/does not calculate herbal doses for anyone under 18/i)
    ).toBeVisible();
    await expect(page.locator(".text-4xl")).toHaveCount(0);
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
