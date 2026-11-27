import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/**
 * Advertising safety at the network boundary.
 *
 * The first describe runs against a production build with the hard launch gate
 * OFF (the shipped value). Those tests are deliberately data-independent: every
 * assertion must hold whether or not Supabase is configured and whether or not
 * the requested slug exists, because the promise being tested is "the browser
 * never contacts an ad network", not "this herb page has content".
 *
 * The second describe runs only when `E2E_GATE_ON=1`, against the disposable
 * gate-on copy built by `scripts/e2e-gate-on-server.mjs`. It documents what
 * flipping the constant changes — and, just as importantly, everything it must
 * still refuse.
 */

const GATE_ON = process.env.E2E_GATE_ON === "1";
const CLIENT = "ca-pub-1901058826905247";
const CONSENT_COOKIE = "herbally-ads-consent";
const GATE_ON_ORIGIN = "http://localhost:3100";
const CMP_LOADER_URL =
  "https://fundingchoicesmessages.google.com/i/pub-1901058826905247?ers=1";

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

/** Seed the first-party choice before the document loads. */
async function setAdConsent(
  context: BrowserContext,
  value: "granted" | "denied"
) {
  await context.addCookies([
    { name: CONSENT_COOKIE, value: `v1:${value}`, url: GATE_ON_ORIGIN },
  ]);
}

/** True once Consent Mode v2 carries an explicit granted update. */
async function expectGrantedConsentModeUpdate(page: Page) {
  await page.waitForFunction(
    () => {
      const layer = (window as unknown as { dataLayer?: unknown[] }).dataLayer;
      if (!Array.isArray(layer)) return false;
      return layer.some((entry) => {
        if (!entry || typeof entry !== "object") return false;
        const row = entry as ArrayLike<unknown>;
        const params = row[2] as Record<string, unknown> | undefined;
        return (
          row[0] === "consent" &&
          row[1] === "update" &&
          params?.ad_storage === "granted" &&
          params?.ad_user_data === "granted"
        );
      });
    },
    undefined,
    { timeout: 15_000 }
  );
}

test.describe("advertising safety — launch gate off", () => {
  test.skip(GATE_ON, "the gate-on harness runs in a separate describe");

  test("a direct herb page load contacts no ad network", async ({ page }) => {
    const adRequests = watchAdRequests(page);

    const response = await page.goto("/herbs/ginger");
    await page.waitForTimeout(1500);

    expect(response?.status()).toBeLessThan(500);
    expect(adRequests).toEqual([]);
    await expectNoAdSurface(page);
  });

  test("the herb document's CSP forbids every ad origin", async ({
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

  for (const adFreeRoute of [
    "/embed/checker",
    "/fr/embed/checker",
    "/herbs/abrus-precatorius",
    "/calculator",
    "/symptoms",
    "/surgery-planner",
    "/npn-checker",
  ]) {
    test(`A6 runtime zero-ad, zero-marketing-cookie & CSP isolation on ${adFreeRoute}`, async ({
      page,
      context,
      request,
    }) => {
      const adRequests = watchAdRequests(page);
      const response = await page.goto(adFreeRoute);
      await page.waitForTimeout(800);

      expect(response?.status()).toBeLessThan(500);
      expect(adRequests).toEqual([]);
      await expectNoAdSurface(page);

      const marketingCookies = (await context.cookies()).filter((c) =>
        /^(_ga|_gcl|_gid|__gads|__gpi|IDE|NID)$/i.test(c.name)
      );
      expect(marketingCookies).toEqual([]);

      const headerResp = await request.get(adFreeRoute);
      const csp = headerResp.headers()["content-security-policy"] ?? "";
      expect(csp).not.toMatch(/googlesyndication|doubleclick|adservice/i);
      if (adFreeRoute.includes("/embed/")) {
        expect(csp).toContain("frame-ancestors *");
      }
    });
  }
});

interface DocumentIsolationOptions {
  linkHref: string;
  destinationPath: string;
  logLabel: string;
}

type DocumentRequestRecord = { loaderId: string; timestamp: number };
type AdRequestRecord = { url: string; timestamp: number };

/**
 * Assert that following a link out of an ad-bearing herb document produces a
 * new document and that no ad request crosses the navigation boundary.
 *
 * The boundary is the Network.requestWillBeSent event for the destination
 * Document, not a slice of the request list taken when a UI control is
 * clicked: requests from the outgoing document may still land while it is
 * being torn down, but nothing may land after the destination document starts.
 */
async function expectDocumentIsolation(
  page: Page,
  context: BrowserContext,
  options: DocumentIsolationOptions
) {
  const { linkHref, destinationPath, logLabel } = options;

  await setAdConsent(context, "granted");

  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");

  const documentRequests: DocumentRequestRecord[] = [];
  const adRequests: AdRequestRecord[] = [];
  let adScriptLoaderId: string | null = null;

  cdp.on("Network.requestWillBeSent", (event) => {
    const url = event.request.url;
    const timestamp = event.timestamp;

    // Ad iframes load their own googleads documents; only the gate-on origin can be the next top-level document.
    if (event.type === "Document" && url.startsWith(GATE_ON_ORIGIN)) {
      documentRequests.push({ loaderId: event.loaderId, timestamp });
    }

    if (AD_REQUEST.test(url)) {
      adRequests.push({ url, timestamp });
      // A redirect re-emits the request with an empty loaderId and must not
      // overwrite the first good value.
      if (
        url.includes("/adsbygoogle.js") &&
        typeof event.loaderId === "string" &&
        event.loaderId !== "" &&
        adScriptLoaderId === null
      ) {
        adScriptLoaderId = event.loaderId;
      }
    }
  });

  const providerRequest = page.waitForRequest(
    (request) => request.url().includes("/adsbygoogle.js"),
    { timeout: 15_000 }
  );
  await page.goto("/herbs/ginger");
  await providerRequest;
  // Let the provider's own follow-up requests settle before we define the
  // "after the click" boundary.
  await page.waitForTimeout(2000);

  const initialLoaderId = documentRequests[0]?.loaderId ?? null;
  expect(initialLoaderId).not.toBeNull();
  expect(adScriptLoaderId).not.toBeNull();
  expect(adScriptLoaderId).toBe(initialLoaderId);

  const link = page.locator(linkHref).first();
  await expect(link).toBeVisible();
  await Promise.all([
    page.waitForURL((url) => url.pathname === destinationPath, {
      timeout: 15_000,
    }),
    link.click(),
  ]);
  await page.waitForLoadState("load");

  await expect
    .poll(
      () =>
        documentRequests.some(({ loaderId }) => loaderId !== initialLoaderId),
      { timeout: 15_000 }
    )
    .toBe(true);

  const destinationDocument = documentRequests.find(
    ({ loaderId }) => loaderId !== initialLoaderId
  );
  expect(destinationDocument).not.toBeNull();
  expect(destinationDocument?.loaderId).not.toBe(initialLoaderId);

  await page.waitForTimeout(1000);
  await expect(page.locator("ins.adsbygoogle")).toHaveCount(0);
  expect(
    adRequests.filter(
      ({ timestamp }) => timestamp > destinationDocument!.timestamp
    )
  ).toEqual([]);

  console.log(
    `${logLabel} - ad request URLs:`,
    adRequests.map(({ url }) => url)
  );
  console.log(
    `${logLabel} - loader ids:`,
    documentRequests.map(({ loaderId }) => loaderId),
    "destination loader id:",
    destinationDocument?.loaderId
  );
}

test.describe("advertising safety — launch gate on", () => {
  test.skip(!GATE_ON, "set E2E_GATE_ON=1 to run the gate-on harness");

  // The gate uses geo headers forwarded by the hosting layer. Tests that are
  // about the ordinary rest-of-world path pin the visitor to the US; the EEA
  // test overrides this in its own describe.
  test.use({ extraHTTPHeaders: { "x-vercel-ip-country": "US" } });

  test("A. before consent no ad network is contacted and the CMP owns the decision", async ({
    page,
  }) => {
    const adRequests = watchAdRequests(page);

    const response = await page.goto("/herbs/ginger");
    expect(response?.status()).toBeLessThan(500);
    await page.waitForTimeout(3000);

    const csp = response?.headers()["content-security-policy"] ?? "";
    expect(csp).toContain("pagead2.googlesyndication.com");
    expect(csp).toContain("fundingchoicesmessages.google.com");

    const cmpScript = page.locator("script#googlefc-js");
    await expect(cmpScript).toHaveCount(1);
    await expect(cmpScript).toHaveAttribute("src", CMP_LOADER_URL);

    await expect(page.locator("ins.adsbygoogle")).toHaveCount(0);
    await expect(page.locator("[data-ad-container]")).toHaveCount(0);
    expect(adRequests).toEqual([]);

    console.log("A. before consent - ad request URLs:", adRequests);
  });

  test("B. a granted choice loads AdSense and mirrors the grant into Consent Mode", async ({
    page,
    context,
  }) => {
    await setAdConsent(context, "granted");
    const adRequests = watchAdRequests(page);
    const providerRequest = page.waitForRequest(
      (request) =>
        /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/.test(
          request.url()
        ) && request.url().includes(`client=${CLIENT}`),
      { timeout: 15_000 }
    );

    await page.goto("/herbs/ginger");
    const request = await providerRequest;
    expect(request.url()).toContain(`client=${CLIENT}`);
    await expect(page.locator("ins.adsbygoogle")).toHaveCount(1);
    await expectGrantedConsentModeUpdate(page);

    console.log("B. granted choice - ad request URLs:", adRequests);
  });

  test("C. a denied choice contacts no ad network and renders no unit", async ({
    page,
    context,
  }) => {
    await setAdConsent(context, "denied");
    const adRequests = watchAdRequests(page);

    await page.goto("/herbs/ginger");
    await page.waitForTimeout(3000);

    expect(adRequests).toEqual([]);
    await expect(page.locator("ins.adsbygoogle")).toHaveCount(0);

    console.log("C. denied choice - ad request URLs:", adRequests);
  });

  test.describe("EEA/UK/CH", () => {
    test.use({ extraHTTPHeaders: { "x-vercel-ip-country": "DE" } });

    test("D. a granted first-party cookie cannot outrank the Google CMP", async ({
      page,
      context,
    }) => {
      await setAdConsent(context, "granted");
      const adRequests = watchAdRequests(page);

      await page.goto("/herbs/ginger");
      await page.waitForTimeout(3000);

      await expect(page.locator("script#googlefc-js")).toHaveCount(1);
      expect(adRequests).toEqual([]);
      await expect(page.locator("ins.adsbygoogle")).toHaveCount(0);

      console.log("D. EEA with granted cookie - ad request URLs:", adRequests);
    });
  });

  test("E. Global Privacy Control outranks a stored grant", async ({
    page,
    context,
  }) => {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "globalPrivacyControl", {
        get: () => true,
        configurable: true,
      });
    });
    await setAdConsent(context, "granted");
    const adRequests = watchAdRequests(page);

    await page.goto("/herbs/ginger");
    await page.waitForTimeout(3000);

    expect(adRequests).toEqual([]);
    await expect(page.locator("ins.adsbygoogle")).toHaveCount(0);

    console.log("E. GPC opt-out - ad request URLs:", adRequests);
  });

  test("F. the herbalist tool stays ad-free even with a stored grant", async ({
    page,
    context,
  }) => {
    await setAdConsent(context, "granted");
    const adRequests = watchAdRequests(page);

    await page.goto("/herbalist");
    await page.waitForTimeout(2000);

    expect(adRequests).toEqual([]);
    await expectNoAdSurface(page);

    console.log("F. /herbalist - ad request URLs:", adRequests);
  });

  test("G. the calculator stays ad-free even with a stored grant", async ({
    page,
    context,
  }) => {
    await setAdConsent(context, "granted");
    const adRequests = watchAdRequests(page);

    await page.goto("/calculator");
    await page.waitForTimeout(2000);

    expect(adRequests).toEqual([]);
    await expectNoAdSurface(page);

    console.log("G. /calculator - ad request URLs:", adRequests);
  });

  test("H. leaving an ad document replaces it and stops ad requests", async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "CDP sessions are Chromium-only");

    await expectDocumentIsolation(page, context, {
      linkHref: 'a[href="/herbalist"]',
      destinationPath: "/herbalist",
      logLabel: "H. document isolation",
    });
  });

  test("J. the calculator document replaces the ad document and stays ad-free", async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "CDP sessions are Chromium-only");

    await expectDocumentIsolation(page, context, {
      linkHref: 'footer a[href="/calculator"]',
      destinationPath: "/calculator",
      logLabel: "J. calculator isolation",
    });
  });

  test("I. revoking the choice replaces the document and stores the denial", async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "CDP sessions are Chromium-only");

    await setAdConsent(context, "granted");
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");

    const adRequests: AdRequestRecord[] = [];
    const documentRequests: DocumentRequestRecord[] = [];

    cdp.on("Network.requestWillBeSent", (event) => {
      if (
        event.type === "Document" &&
        event.request.url.startsWith(GATE_ON_ORIGIN)
      ) {
        documentRequests.push({
          loaderId: event.loaderId,
          timestamp: event.timestamp,
        });
      }
      if (AD_REQUEST.test(event.request.url)) {
        adRequests.push({
          url: event.request.url,
          timestamp: event.timestamp,
        });
      }
    });

    const providerRequest = page.waitForRequest(
      (request) => request.url().includes("/adsbygoogle.js"),
      { timeout: 15_000 }
    );
    await page.goto("/herbs/ginger");
    await providerRequest;
    await page.waitForTimeout(2000);

    const loaderIdsBeforeRevoke = documentRequests.map(
      ({ loaderId }) => loaderId
    );
    expect(loaderIdsBeforeRevoke.length).toBeGreaterThan(0);

    await page
      .getByRole("button", { name: "Ad settings", exact: true })
      .click();

    await page
      .getByRole("button", { name: "Turn off ads", exact: true })
      .click();

    await expect
      .poll(
        () =>
          documentRequests.some(
            ({ loaderId }) => !loaderIdsBeforeRevoke.includes(loaderId)
          ),
        { timeout: 15_000 }
      )
      .toBe(true);

    const destinationDocument = documentRequests.find(
      ({ loaderId }) => !loaderIdsBeforeRevoke.includes(loaderId)
    );
    expect(destinationDocument).not.toBeNull();

    await page.waitForLoadState("load");
    await page.waitForTimeout(1500);

    expect(
      adRequests.filter(
        ({ timestamp }) => timestamp > destinationDocument!.timestamp
      )
    ).toEqual([]);

    const cookie = await page.evaluate(() => document.cookie);
    expect(decodeURIComponent(cookie)).toContain("v1:denied");

    console.log(
      "I. revocation - ad request URLs:",
      adRequests.map(({ url }) => url)
    );
    console.log(
      "I. revocation - loader ids before:",
      loaderIdsBeforeRevoke,
      "after:",
      documentRequests.map(({ loaderId }) => loaderId)
    );
  });
});
