import { test, expect, type Page } from "@playwright/test";

/**
 * Regression test for the language-toggle bug where switching French → English
 * on the homepage left the URL on /fr, producing partial translations because
 * the server followed the URL (fr) while the client followed the cookie (en).
 *
 * The URL is now the single source of truth, so both the URL and the rendered
 * language must flip together on every page.
 */

async function openLanguageMenu(page: Page) {
  const trigger = page
    .locator("button:has(svg.lucide-globe)")
    .first();
  await expect(trigger).toBeVisible();
  await trigger.click();
}

async function chooseLanguage(page: Page, nativeName: RegExp) {
  // Wait for the menu item to appear, then click it. The click triggers a
  // hard navigation (window.location.assign), so we race the click against
  // the next navigation settling.
  const item = page.getByRole("menuitem", { name: nativeName });
  await expect(item).toBeVisible();
  await Promise.all([
    // Hard nav lands on a fresh URL; domcontentloaded is enough for assertions.
    page.waitForLoadState("domcontentloaded"),
    item.click(),
  ]);
  // Give the full reload a moment to settle (assign → reload → render).
  await page.waitForLoadState("domcontentloaded");
}

async function expectLocale(page: Page, locale: "en" | "fr") {
  const url = page.url();
  if (locale === "fr") {
    expect(url).toMatch(/\/fr(\b|\/|$)/);
    expect(url).not.toMatch(/\/fr\/fr/); // no double-prefix
  } else {
    expect(url).not.toMatch(/\/fr/);
  }
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
}

test.describe("Language toggle (URL = single source of truth)", () => {
  test.use({
    locale: "en-US",
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
  });

  for (const startPath of ["/", "/herbs"]) {
    test(`round-trips en → fr → en on ${startPath || "home"}`, async ({ page }) => {
      await page.goto(startPath, { waitUntil: "domcontentloaded" });

      // Start in English
      await expectLocale(page, "en");

      // Switch to French
      await openLanguageMenu(page);
      await chooseLanguage(page, /Français/i);
      await expectLocale(page, "fr");
      // French content is actually rendered (not just the URL).
      const frText = (await page.locator("body").innerText()).toLowerCase();
      expect(frText).toMatch(/explorer|herbes|interactions plante/);

      // Switch back to English — the original bug: URL stayed /fr here on "/".
      await openLanguageMenu(page);
      await chooseLanguage(page, /English/i);
      await expectLocale(page, "en");
      // English content is actually rendered.
      const enText = (await page.locator("body").innerText()).toLowerCase();
      expect(enText).toMatch(/explore|herbs|herb-drug interactions/);
      // No French leak after switching back.
      expect(enText).not.toMatch(/explorer les plantes|base de données d'herbes/);
    });
  }
});
