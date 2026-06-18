import { test, expect } from "@playwright/test";

test("Smoke test: Home page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/HerbAlly/);
});

test("Smoke test: Herb search", async ({ page }) => {
  await page.goto("/herbs");
  await expect(page.locator("h1")).toContainText("Herbs");
});

// The chat endpoint needs a real OPENROUTER_API_KEY to stream a 200. In CI
// (no key configured) it returns 503, so skip there rather than fail.
test("Smoke test: API Chat", async ({ request }) => {
  test.skip(!process.env.OPENROUTER_API_KEY, "requires OPENROUTER_API_KEY");
  const response = await request.post("/api/chat", {
    data: { messages: [{ role: "user", content: "hello" }] },
  });
  expect(response.ok()).toBeTruthy();
});
