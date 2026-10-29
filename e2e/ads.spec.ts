import { expect, test, type Page } from "@playwright/test";

/**
 * Advertising safety at the network boundary.
 *
 * These tests run against a production build with the hard launch gate OFF
 * (the shipped value). They are deliberately data-independent: every
 * assertion must hold whether or not Supabase is configured and whether or not
 * the requested slug exists, because the promise being tested is "the browser
 * never contacts an ad network", not "this herb page has content".
 */

const AD_REQUEST =
  /(pagead2\.googlesyndication\.com|googlesyndication\.com|doubleclick\.net|adservice\.google\.com|googleadservices\.com)/i;

/** Collect every request that reached an advertising origin. */
function watchAdRequests(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (request) => {
    if (AD_REQUEST.test(request.url())) seen.push(request.url());
  });
  return seen;
}

async function expectNoAdSurface(page: Page) {
  await expect(page.locator('script[src*="adsbygoogle"]')).toHaveCount(0);
  await expect(page.locator("ins.adsbygoogle")).toHaveCount(0);
  await expect(page.locator('[data-ad-container="herbally"]')).toHaveCount(0);
  await expect(page.locator("[data-ad-container]")).toHaveCount(0);
}

test.describe("advertising safety — launch gate off", () => {
  test("a direct herb page load contacts no ad network", async ({ page }) => {
    const adRequests = watchAdRequests(page);

    const response = await page.goto("/herbs/ginger");
    await page.waitForTimeout(1500);

    expect(response?.status()).toBeLessThan(500);
    expect(adRequests).toEqual([]);
    await expectNoAdSurface(page);
  });

  test("the herb document's CSP forbids every ad origin", async ({
    page,
    request,
  }) => {
    const response = await request.get("/herbs/ginger");
    const csp = response.headers()["content-security-policy"] ?? "";

    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toMatch(/googlesyndication|doubleclick|adservice/i);
  });

  test("a health-tool page contacts no ad network", async ({ page }) => {
    const adRequests = watchAdRequests(page);

    const response = await page.goto("/herbalist");
    await page.waitForTimeout(1500);

    expect(response?.status()).toBeLessThan(500);
    expect(adRequests).toEqual([]);
    await expectNoAdSurface(page);
  });

  test("no consent banner is rendered anywhere while the gate is off", async ({
    page,
  }) => {
    await page.goto("/herbalist");
    await expect(
      page.getByRole("dialog", { name: /advertising|publicité/i })
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: /ad settings|paramètres publicitaires/i,
      })
    ).toHaveCount(0);
  });

  test("navigation from a tool into a herb page and back contacts no ad network", async ({
    page,
  }) => {
    const adRequests = watchAdRequests(page);

    await page.goto("/herbs");

    const herbLinks = page.locator('a[href^="/herbs/"]');
    const count = await herbLinks.count();
    if (count > 0) {
      await herbLinks.first().click();
      await page.waitForTimeout(800);
      await page.goBack();
      await page.waitForTimeout(800);
      await page.goForward();
      await page.waitForTimeout(800);
    }

    expect(adRequests).toEqual([]);
    await expectNoAdSurface(page);
  });
});
