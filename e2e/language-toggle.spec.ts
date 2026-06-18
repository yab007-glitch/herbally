import {
  test,
  expect,
  request as requestCtx,
  type Page,
} from "@playwright/test";

/**
 * Regression test for the language-toggle bug where switching French → English
 * on the homepage left the URL on /fr, producing partial translations because
 * the server followed the URL (fr) while the client followed the cookie (en).
 *
 * The URL is the single source of truth, so both the URL and the rendered
 * language must flip together on every page.
 *
 * This behaviour depends on the proxy forwarding the `x-locale` request header
 * to server components. That works on Vercel but NOT on the local
 * `output: standalone` server used by the default e2e webServer, so the suite
 * auto-skips when that forwarding is unavailable (local / CI) and runs for
 * real when pointed at a deployed environment (E2E_BASE_URL=https://herbally.app).
 */

const TARGET = process.env.E2E_BASE_URL ?? "http://localhost:3000";

test.describe("Language toggle (URL = single source of truth)", () => {
  test.use({
    locale: "en-US",
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
    ...(process.env.E2E_BASE_URL ? { baseURL: process.env.E2E_BASE_URL } : {}),
  });

  let supported = false;
  test.beforeAll(async () => {
    const ctx = await requestCtx.newContext({ baseURL: TARGET });
    const res = await ctx.get("/fr");
    const html = (await res.text()).slice(0, 2000);
    await ctx.dispose();
    supported = /<html[^>]*lang="fr"/i.test(html);
  });
  test.beforeEach(() => {
    test.skip(!supported, "x-locale forwarding not available on this server");
  });

  async function openLanguageMenu(page: Page) {
    const trigger = page.locator("button:has(svg.lucide-globe)").first();
    await expect(trigger).toBeVisible();
    await trigger.click();
  }

  async function chooseLanguage(page: Page, nativeName: RegExp) {
    const item = page.getByRole("menuitem", { name: nativeName });
    await expect(item).toBeVisible();
    await Promise.all([
      page.waitForLoadState("domcontentloaded"),
      item.click(),
    ]);
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

  for (const startPath of ["/", "/herbs"]) {
    test(`round-trips en → fr → en on ${startPath || "home"}`, async ({
      page,
    }) => {
      await page.goto(startPath, { waitUntil: "networkidle" });
      await expectLocale(page, "en");

      await openLanguageMenu(page);
      await chooseLanguage(page, /Français/i);
      await expectLocale(page, "fr");
      const frText = (await page.locator("body").innerText()).toLowerCase();
      expect(frText).toMatch(/explorer|herbes|interactions plante/);

      await openLanguageMenu(page);
      await chooseLanguage(page, /English/i);
      await expectLocale(page, "en");
      const enText = (await page.locator("body").innerText()).toLowerCase();
      expect(enText).toMatch(/explore|herbs|herb-drug interactions/);
      expect(enText).not.toMatch(
        /explorer les plantes|base de données d'herbes/
      );
    });
  }
});
