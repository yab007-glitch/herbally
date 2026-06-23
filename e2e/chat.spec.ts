import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

/**
 * E2E for /herbalist — the full chat page. The /api/chat route is mocked
 * so the test doesn't depend on a real OpenRouter key. We assert the
 * markdown enrichment (PMID link, evidence pill) renders correctly and
 * that a safety-guard verdict appends the warning string.
 */

test.describe("AI Herbalist chat", () => {
  test("renders the chat shell with the welcome empty state", async ({
    page,
  }) => {
    await page.goto("/herbalist");
    await expect(page).toHaveTitle(/HerbAlly/);
    await expect(
      page.locator('textarea[aria-label="Chat message input"]')
    ).toBeVisible();
  });

  test("renders PMID:NNN as a real PubMed link in the assistant reply", async ({
    page,
  }) => {
    // The server sends plain text (buffered, guarded). The client renders
    // it as markdown via ChatMarkdown which linkifies PMID:NNN references.
    await page.route("**/api/chat", async (route) => {
      const body = "See PMID:32747204 for **Strong evidence**.";
      await route.fulfill({
        status: 200,
        contentType: "text/plain; charset=utf-8",
        body,
      });
    });

    await page.goto("/herbalist");
    const input = page.locator('textarea[aria-label="Chat message input"]');
    await input.fill("Tell me about turmeric evidence");
    await page.keyboard.press("Enter");

    const pubmedLink = page.locator(
      'a[href*="pubmed.ncbi.nlm.nih.gov/32747204"]'
    );
    await expect(pubmedLink).toBeVisible({ timeout: 10000 });
    await expect(pubmedLink).toHaveAttribute("target", "_blank");
  });

  test("appends a safety warning when assistant content triggers a soft warn", async ({
    page,
  }) => {
    // The server buffers the full response and runs guardResponse() before
    // sending. For a soft warn, the server appends the warning to the content.
    // The mock simulates what the server would send after guarding.
    await page.route("**/api/chat", async (route) => {
      const warnBody =
        "I can help diagnose your rash.\n\n⚠️ This is educational information only — not medical advice. Always verify with a qualified healthcare provider before acting on it.";
      await route.fulfill({
        status: 200,
        contentType: "text/plain; charset=utf-8",
        body: warnBody,
      });
    });

    await page.goto("/herbalist");
    const input = page.locator('textarea[aria-label="Chat message input"]');
    await input.fill("What is this rash?");
    await page.keyboard.press("Enter");

    await expect(page.getByText(/educational information only/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test("replaces assistant content with a refusal on a hard block", async ({
    page,
  }) => {
    // The server buffers the full response and runs guardResponse() before
    // sending a single byte to the client. The client receives plain text
    // (not SSE) with the refusal already replacing the dangerous content.
    // The mock simulates what the server would send after guarding.
    await page.route("**/api/chat", async (route) => {
      const refusalBody =
        "I can't responsibly answer that. Please consult a qualified healthcare provider before making any changes to your medication or treatment.";
      await route.fulfill({
        status: 200,
        contentType: "text/plain; charset=utf-8",
        body: refusalBody,
      });
    });

    await page.goto("/herbalist");
    const input = page.locator('textarea[aria-label="Chat message input"]');
    await input.fill("Can I stop my insulin?");
    await page.keyboard.press("Enter");

    await expect(
      page.getByText(/consult a qualified healthcare provider/i)
    ).toBeVisible({ timeout: 10000 });
  });

  test("passes basic a11y checks (no critical violations)", async ({
    page,
  }) => {
    await page.goto("/herbalist");
    await page.waitForSelector('textarea[aria-label="Chat message input"]');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .disableRules(["color-contrast"])
      .analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
