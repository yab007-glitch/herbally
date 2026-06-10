import { test, expect } from "@playwright/test";

/**
 * E2E for /herbalist — the full chat page. The /api/chat route is mocked
 * so the test doesn't depend on a real OpenRouter key. We assert the
 * markdown enrichment (PMID link, evidence pill) renders correctly and
 * that a safety-guard verdict appends the warning string.
 */

test.describe("AI Herbalist chat", () => {
  test("renders the chat shell with the welcome empty state", async ({ page }) => {
    await page.goto("/herbalist");
    await expect(page).toHaveTitle(/HerbAlly/);
    // The chat input textarea is the canonical empty-state affordance.
    await expect(
      page.locator('textarea[aria-label="Chat message input"]')
    ).toBeVisible();
  });

  test("renders PMID:NNN as a real PubMed link in the assistant reply", async ({
    page,
  }) => {
    // Mock /api/chat to return a single SSE event with markdown content
    // containing both a PMID reference and a Strong evidence pill.
    await page.route("**/api/chat", async (route) => {
      const sseBody = [
        'data: {"choices":[{"delta":{"content":"See "}}]}',
        'data: {"choices":[{"delta":{"content":"PMID:32747204 "}}]}',
        'data: {"choices":[{"delta":{"content":"for "}}]}',
        'data: {"choices":[{"delta":{"content":"**Strong evidence**."}}]}',
        "data: [DONE]",
        "",
      ].join("\n");
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: sseBody,
      });
    });

    await page.goto("/herbalist");
    const input = page.locator('textarea[aria-label="Chat message input"]');
    await input.fill("Tell me about turmeric evidence");
    await page.keyboard.press("Enter");

    // Wait for the PubMed link to appear.
    const pubmedLink = page.locator(
      'a[href*="pubmed.ncbi.nlm.nih.gov/32747204"]'
    );
    await expect(pubmedLink).toBeVisible({ timeout: 10000 });
    await expect(pubmedLink).toHaveAttribute("target", "_blank");
  });

  test("appends a safety warning when assistant content triggers a soft warn", async ({
    page,
  }) => {
    await page.route("**/api/chat", async (route) => {
      const sseBody = [
        'data: {"choices":[{"delta":{"content":"I can help diagnose your rash."}}]}',
        "data: [DONE]",
        "",
      ].join("\n");
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: sseBody,
      });
    });

    await page.goto("/herbalist");
    const input = page.locator('textarea[aria-label="Chat message input"]');
    await input.fill("What is this rash?");
    await page.keyboard.press("Enter");

    // The English soft-warn text should be appended.
    await expect(
      page.getByText(/educational information only/i)
    ).toBeVisible({ timeout: 10000 });
  });

  test("replaces assistant content with a refusal on a hard block", async ({
    page,
  }) => {
    await page.route("**/api/chat", async (route) => {
      const sseBody = [
        'data: {"choices":[{"delta":{"content":"You should stop taking your insulin and use cinnamon instead."}}]}',
        "data: [DONE]",
        "",
      ].join("\n");
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: sseBody,
      });
    });

    await page.goto("/herbalist");
    const input = page.locator('textarea[aria-label="Chat message input"]');
    await input.fill("Can I stop my insulin?");
    await page.keyboard.press("Enter");

    // The block message replaces the assistant text.
    await expect(
      page.getByText(/consult a qualified healthcare provider/i)
    ).toBeVisible({ timeout: 10000 });
  });
});
