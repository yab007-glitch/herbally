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
  // Each toggle is a full document navigation. In the DB-less e2e build every
  // failed Supabase query costs ~7 s of client retry backoff, so a three-load
  // round-trip can exceed the 30 s default. This is a property of the test
  // environment, not of the product; production talks to a real database.
  test.slow();

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
    // Do not wait for domcontentloaded here. Each navigation re-renders the
    // whole page, and in the DB-less e2e environment every failed Supabase
    // query costs ~7 s of retry backoff, so three page loads exceed the 30 s
    // test budget. The contract under test is the URL and <html lang>, and
    // both are asserted (with auto-waiting) by expectLocale below.
    await item.click();
  }

  async function expectLocale(page: Page, locale: "en" | "fr") {
    await expect(page).toHaveURL(
      locale === "fr" ? /\/fr(\/|$)/ : (url) => !url.pathname.startsWith("/fr"),
      { timeout: 30_000 }
    );
    const url = page.url();
    if (locale === "fr") {
      expect(url).not.toMatch(/\/fr\/fr/); // no double-prefix
    }
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
  }

  for (const startPath of ["/", "/herbs"]) {
    test(`round-trips en → fr → en on ${startPath || "home"}`, async ({
      page,
    }) => {
      await page.goto(startPath, { waitUntil: "domcontentloaded" });
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
