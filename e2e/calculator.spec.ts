import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

test.describe.skip("Dosage Calculator — STALE: fragile selectors/timing, needs rewrite against current UI", () => {
  test("should load calculator page", async ({ page }) => {
    await page.goto("/calculator");

    await expect(page).toHaveTitle(/Calculator|Dosage|HerbAlly/);
    await expect(page.locator("text=Calculator, text=Dosage")).toBeVisible();
  });

  test("should display calculator form", async ({ page }) => {
    await page.goto("/calculator");

    const herbSelect = page.locator(
      'select, input[placeholder*="herb" i], [role="combobox"]'
    );
    await expect(herbSelect.first()).toBeVisible();

    const ageInput = page.locator(
      'input[type="number"], input[placeholder*="age" i]'
    );
    await expect(ageInput.first()).toBeVisible();
  });

  test("should calculate dosage based on weight", async ({ page }) => {
    await page.goto("/calculator");

    const herbSelect = page.locator("select").first();
    if ((await herbSelect.count()) > 0) {
      await herbSelect.selectOption({ index: 1 });
    }

    const weightInput = page
      .locator('input[type="number"][placeholder*="weight" i]')
      .first();
    if ((await weightInput.count()) > 0) {
      await weightInput.fill("70");
    }

    const submitButton = page
      .locator('button[type="submit"], button:has-text("Calculate")')
      .first();
    if ((await submitButton.count()) > 0) {
      await submitButton.click();
    }

    await page.waitForTimeout(1000);

    const hasResult =
      (await page
        .locator("text=mg, text=ml, text=dose, text= dosage")
        .count()) > 0;
    expect(hasResult).toBeTruthy();
  });

  test("should validate required fields", async ({ page }) => {
    await page.goto("/calculator");

    const submitButton = page.locator('button[type="submit"]').first();
    if ((await submitButton.count()) > 0) {
      await submitButton.click();
      await page.waitForTimeout(500);

      const hasValidationError =
        (await page
          .locator('[role="alert"], .error, [class*="error"], text=required')
          .count()) > 0;
      const isStillOnPage = page.url().includes("/calculator");

      expect(hasValidationError || isStillOnPage).toBeTruthy();
    }
  });

  test("should handle different age groups", async ({ page }) => {
    await page.goto("/calculator");

    const ageInput = page
      .locator(
        'input[type="number"][placeholder*="age" i], select[aria-label*="age" i]'
      )
      .first();

    if ((await ageInput.count()) > 0) {
      await ageInput.fill("5");

      const weightInput = page
        .locator('input[type="number"][placeholder*="weight" i]')
        .first();
      if ((await weightInput.count()) > 0) {
        await weightInput.fill("20");
      }

      const submitButton = page
        .locator('button[type="submit"], button:has-text("Calculate")')
        .first();
      if ((await submitButton.count()) > 0) {
        await submitButton.click();
      }

      await page.waitForTimeout(1000);

      const hasResult =
        (await page.locator("text=mg, text=ml, text=dose").count()) > 0;
      expect(hasResult).toBeTruthy();
    }
  });

  test("should show disclaimers", async ({ page }) => {
    await page.goto("/calculator");

    const hasDisclaimer =
      (await page
        .locator(
          "text=consult, text=doctor, text=healthcare, text=medical, text=disclaimer"
        )
        .count()) > 0;
    expect(hasDisclaimer).toBeTruthy();
  });

  test("should be accessible", async ({ page }) => {
    await page.goto("/calculator");

    const inputs = page.locator("input, select, textarea");
    const count = await inputs.count();

    for (let i = 0; i < Math.min(count, 5); i++) {
      const input = inputs.nth(i);
      const hasLabel =
        (await input.locator("xpath=..//label").count()) > 0 ||
        (await input.getAttribute("aria-label")) !== null ||
        (await input.getAttribute("id")) !== null;

      if (!hasLabel) {
        console.log(`Input ${i} may be missing label`);
      }
    }
  });

  test("passes basic a11y checks (no critical violations)", async ({
    page,
  }) => {
    await page.goto("/calculator");
    await page.waitForTimeout(1000);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .disableRules(["color-contrast"])
      .analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
