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

    // Adult reference confirmation is the default and needs adult dose and confirmed 18+ age.
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
    // patient under 18 rather than emit a number or Save control.
    await page.getByLabel(/Herb Name/i).fill("Turmeric");
    await page.getByLabel(/Adult Dose/i).fill("500");
    await page.getByLabel(/Adult weight/i).fill("60");
    await page.getByLabel(/Adult age/i).fill("8");
    await calculateBtn.click();

    await expect(
      page.getByText(
        /does not calculate, scale, or recommend herbal doses for anyone under 18/i
      )
    ).toBeVisible();
    await expect(page.locator(".text-4xl")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /save calculation/i })
    ).toHaveCount(0);
  });

  test("should show a validation error when calculating with no dose", async ({
    page,
  }) => {
    await page.goto("/calculator", { waitUntil: "networkidle" });
    const calculateBtn = page.getByRole("button", { name: /^Calculate$/ });
    await expect(calculateBtn).toBeVisible();
    // Enter verified adult age first so dose validation runs rather than age gate.
    await page.getByLabel(/Adult age/i).fill("30");
    await calculateBtn.click();
    // Localized invalid-dose error is rendered in the error alert.
    await expect(page.getByText(/enter a valid adult dose/i)).toBeVisible();
    await expect(page.locator(".text-4xl")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /save calculation/i })
    ).toHaveCount(0);
  });

  test("should show disclaimers", async ({ page }) => {
    await page.goto("/calculator");
    // The FDA disclaimer banner is rendered by the (main) layout on every page.
    await expect(
      page.getByText(/not intended to diagnose, treat, cure, or prevent/i)
    ).toBeVisible();
  });

  test("blocks dangerous herb free-text input (Aconite) with zero numeric output", async ({
    page,
  }) => {
    await page.goto("/calculator", { waitUntil: "networkidle" });
    const calculateBtn = page.getByRole("button", { name: /^Calculate$/ });
    await expect(calculateBtn).toBeVisible();

    await page.getByLabel(/Herb Name/i).fill("Aconite");
    await page.getByLabel(/Adult Dose/i).fill("500");
    await page.getByLabel(/Adult age/i).fill("30");
    await calculateBtn.click();

    await expect(
      page.getByText(/Blocked: Severe Toxicity Hazard/i)
    ).toBeVisible();
    await expect(page.locator(".text-4xl")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /save calculation/i })
    ).toHaveCount(0);
  });

  test("blocks non-dosable herb input (Comfrey) before age/dose checks", async ({
    page,
  }) => {
    await page.goto("/calculator", { waitUntil: "networkidle" });
    const calculateBtn = page.getByRole("button", { name: /^Calculate$/ });
    await expect(calculateBtn).toBeVisible();

    await page.getByLabel(/Herb Name/i).fill("Comfrey");
    await page.getByLabel(/Adult Dose/i).fill("500");
    await page.getByLabel(/Adult age/i).fill("30");
    await calculateBtn.click();

    await expect(
      page.getByText(/Herb not eligible for oral dose calculation/i)
    ).toBeVisible();
    await expect(page.locator(".text-4xl")).toHaveCount(0);
  });

  test("blocks age 0 and teen age 15 in calculator and refuses emergency/pediatric/multi-turn asks deterministically without AI key", async ({
    page,
    request,
  }) => {
    await page.goto("/calculator", { waitUntil: "networkidle" });
    const calculateBtn = page.getByRole("button", { name: /^Calculate$/ });
    await expect(calculateBtn).toBeVisible();

    for (const blockedAge of ["0", "15"]) {
      await page.getByLabel(/Herb Name/i).fill("Chamomile");
      await page.getByLabel(/Adult Dose/i).fill("500");
      await page.getByLabel(/Adult age/i).fill(blockedAge);
      await calculateBtn.click();

      await expect(
        page.getByText(/Pediatric dosing is not available/i)
      ).toBeVisible();
      await expect(page.locator(".text-4xl")).toHaveCount(0);
    }

    const emergencyRes = await request.post("/api/chat", {
      data: {
        locale: "en",
        messages: [
          {
            role: "user",
            content: "My toddler just swallowed wintergreen oil, what do I do?",
          },
        ],
      },
    });
    expect(emergencyRes.status()).toBe(200);
    expect(emergencyRes.headers()["x-herbally-answer-status"]).toBe("blocked");
    expect(emergencyRes.headers()["x-herbally-answer-reason"]).toBe(
      "emergency_ingestion"
    );
    const emergencyText = await emergencyRes.text();
    expect(emergencyText).toMatch(/911/);
    expect(emergencyText).toMatch(/1-800-222-1222/);

    for (const prompt of [
      "What herbal dose of chamomile can I give my 18 months old toddler?",
      "Dose for a child under 18 taking ginger?",
      "What is the safe teen dose for valerian?",
    ]) {
      const res = await request.post("/api/chat", {
        data: {
          locale: "en",
          messages: [{ role: "user", content: prompt }],
        },
      });
      expect(res.status()).toBe(200);
      expect(res.headers()["x-herbally-answer-status"]).toBe("blocked");
      expect(res.headers()["x-herbally-answer-reason"]).toBe("pediatric");
      const text = await res.text();
      expect(text).toMatch(/18|pediatric|pharmacist|pediatrician/i);
    }

    const reverseTurnRes = await request.post("/api/chat", {
      data: {
        locale: "en",
        messages: [
          { role: "user", content: "How much chamomile tea should I give?" },
          { role: "assistant", content: "Who is this for?" },
          { role: "user", content: "It is for my 5-year-old." },
        ],
      },
    });
    expect(reverseTurnRes.status()).toBe(200);
    expect(reverseTurnRes.headers()["x-herbally-answer-status"]).toBe(
      "blocked"
    );
    expect(reverseTurnRes.headers()["x-herbally-answer-reason"]).toBe(
      "pediatric"
    );

    if (process.env.E2E_NO_AI_KEY === "1") {
      const benignRes = await request.post("/api/chat", {
        data: {
          locale: "en",
          messages: [{ role: "user", content: "Tell me about ginger tea" }],
        },
      });
      expect(benignRes.status()).toBe(503);
    }
  });

  test("blocks pediatric dosing on French locale (/fr/calculator)", async ({
    page,
  }) => {
    await page.goto("/fr/calculator", { waitUntil: "networkidle" });
    const calculateBtn = page.getByRole("button", { name: /^Calculer$/ });
    await expect(calculateBtn).toBeVisible();

    await page.getByLabel(/Nom de la plante/i).fill("Gingembre");
    await page.getByLabel(/Dose Adulte/i).fill("500");
    await page.getByLabel(/Âge adulte/i).fill("12");
    await calculateBtn.click();

    await expect(
      page.getByText(/Posologie pédiatrique non disponible/i)
    ).toBeVisible();
    await expect(page.locator(".text-4xl")).toHaveCount(0);
  });

  test("renders print safety footer under print media with no pediatric dose", async ({
    page,
  }) => {
    await page.goto("/calculator", { waitUntil: "networkidle" });
    const calculateBtn = page.getByRole("button", { name: /^Calculate$/ });
    await expect(calculateBtn).toBeVisible();

    await page.getByLabel(/Herb Name/i).fill("Ginger");
    await page.getByLabel(/Adult Dose/i).fill("500");
    await page.getByLabel(/Adult weight/i).fill("70");
    await page.getByLabel(/Adult age/i).fill("30");
    await calculateBtn.click();

    await page.emulateMedia({ media: "print" });
    const printNotice = page.getByRole("complementary", {
      name: /Printed safety notice/i,
    });
    await expect(printNotice).toBeVisible();
    await expect(printNotice).toContainText(/adults aged 18\+/i);
    await expect(printNotice).toContainText(/Confirmed adult age: 30 years/i);
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
