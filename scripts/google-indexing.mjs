#!/usr/bin/env node
/**
 * Google Search Console Setup Automation
 * Uses Playwright with Chrome profile to leverage existing Google login
 *
 * Run: node scripts/google-indexing.mjs
 */

import { chromium } from "playwright";

const DOMAIN = "herbally.app";
const SITEMAP_URL = `https://${DOMAIN}/sitemap.xml`;

// Key pages to request indexing for
const KEY_PAGES = [
  `https://${DOMAIN}`,
  `https://${DOMAIN}/herbs`,
  `https://${DOMAIN}/calculator`,
  `https://${DOMAIN}/herbalist`,
  `https://${DOMAIN}/herbs/turmeric`,
  `https://${DOMAIN}/herbs/chamomile`,
  `https://${DOMAIN}/herbs/ginger`,
  `https://${DOMAIN}/herbs/lavender`,
  `https://${DOMAIN}/herbs/echinacea`,
];

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForUserInput(prompt) {
  console.log(`\n⏸️  ${prompt}`);
  console.log("   Press Enter to continue...\n");
  return new Promise((resolve) => process.stdin.once("data", resolve));
}

async function setupGoogleSearchConsole(page) {
  console.log("\n📍 Step 1: Google Search Console Setup\n");

  try {
    // Navigate to Search Console
    console.log("Opening Google Search Console...");
    await page.goto("https://search.google.com/search-console", {
      waitUntil: "networkidle",
    });
    await sleep(3000);

    // Check if we need to log in
    const url = page.url();
    if (url.includes("accounts.google.com") || url.includes("signin")) {
      console.log(
        "\n⚠️  Please log in to your Google account in the browser window."
      );
      await waitForUserInput(
        "Complete login in the browser, then come back here"
      );
    }

    // Try to add property
    await sleep(2000);

    const addPropertyBtn = await page
      .locator(
        'button:has-text("Add property"), button:has-text("Add a resource")'
      )
      .first();
    const addBtnVisible = await addPropertyBtn
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (addBtnVisible) {
      console.log('Clicking "Add property"...');
      await addPropertyBtn.click();
      await sleep(1500);

      // Enter domain
      console.log(`Entering domain: ${DOMAIN}`);
      const domainInput = await page
        .locator('input[type="text"], input[type="url"]')
        .first();
      await domainInput.click();
      await domainInput.fill(DOMAIN);
      await sleep(500);

      // Click Continue/Submit
      const continueBtn = await page
        .locator('button:has-text("Continue"), button:has-text("Submit")')
        .first();
      await continueBtn.click();
      await sleep(2000);

      await waitForUserInput(
        "Complete verification in the browser (DNS or HTML file method)"
      );
    }

    // Navigate to the property
    console.log("Navigating to property...");
    await page.goto(
      `https://search.google.com/search-console?resource_id=sc-domain%3A${DOMAIN}`,
      { waitUntil: "networkidle" }
    );
    await sleep(3000);

    // Submit sitemap
    console.log("\n📍 Submitting sitemap...");

    // Look for sitemaps in sidebar
    const sitemapsSidebar = await page
      .locator('div:has-text("Sitemaps"), [data-testid="sitemaps"]')
      .first();
    if (await sitemapsSidebar.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sitemapsSidebar.click();
      await sleep(2000);
    } else {
      // Direct URL to sitemaps
      await page.goto(
        `https://search.google.com/search-console/sitemaps?resource_id=sc-domain%3A${DOMAIN}`,
        { waitUntil: "networkidle" }
      );
    }

    await sleep(2000);

    // Try to submit sitemap
    const sitemapInput = await page.locator("input").first();
    const sitemapInputVisible = await sitemapInput
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (sitemapInputVisible) {
      await sitemapInput.fill("sitemap.xml");
      await sleep(500);

      const submitBtn = await page.locator('button:has-text("Submit")').first();
      await submitBtn.click();
      console.log("✅ Sitemap submitted!");
      await sleep(2000);
    } else {
      console.log("⚠️  Could not find sitemap input automatically.");
      await waitForUserInput(
        'Please submit sitemap manually: enter "sitemap.xml" and click Submit'
      );
    }

    // Request indexing for key pages
    console.log("\n📍 Requesting indexing for key pages...\n");

    for (const pageUrl of KEY_PAGES) {
      const shortUrl = pageUrl.replace(`https://${DOMAIN}`, "") || "/";
      console.log(`  Checking: ${shortUrl}`);

      // Go to main Search Console page
      await page.goto(
        `https://search.google.com/search-console?resource_id=sc-domain%3A${DOMAIN}`,
        { waitUntil: "networkidle" }
      );
      await sleep(2000);

      // Find URL inspection search bar
      const searchInput = await page
        .locator(
          'input[aria-label*="URL"], input[placeholder*="URL"], input[type="text"]'
        )
        .first();
      if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchInput.click();
        await sleep(300);
        await searchInput.fill(pageUrl);
        await sleep(300);
        await page.keyboard.press("Enter");
        await sleep(4000);

        // Look for "Request indexing" button
        const requestBtn = await page
          .locator('button:has-text("Request indexing")')
          .first();
        if (await requestBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await requestBtn.click();
          console.log(`    ✅ Requested indexing`);
          await sleep(3000);
        } else {
          console.log(`    ℹ️  Already indexed or rate limited`);
        }
      }

      await sleep(1500);
    }

    console.log("\n✅ Google Search Console setup complete!");
  } catch (error) {
    console.error("Error:", error.message);
    await waitForUserInput(
      "Something went wrong. Check the browser and continue manually if needed"
    );
  }
}

async function setupBingWebmaster(page) {
  console.log("\n📍 Step 2: Bing Webmaster Tools Setup\n");

  try {
    console.log("Opening Bing Webmaster Tools...");
    await page.goto("https://www.bing.com/webmasters", {
      waitUntil: "networkidle",
    });
    await sleep(3000);

    // Check if logged in
    if (page.url().includes("login") || page.url().includes("signin")) {
      console.log('\n⚠️  Please log in (use "Sign in with Google" option).');
      await waitForUserInput("Complete login in the browser");
    }

    // Try to add site
    console.log("Adding site...");

    const addSiteBtn = await page
      .locator('button:has-text("Add a site"), a:has-text("Add a site")')
      .first();
    if (await addSiteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addSiteBtn.click();
      await sleep(1500);

      const siteInput = await page
        .locator('input[type="url"], input[name="url"], input[type="text"]')
        .first();
      await siteInput.fill(`https://${DOMAIN}`);

      const addBtn = await page
        .locator('button:has-text("Add"), button:has-text("Submit")')
        .first();
      await addBtn.click();

      await waitForUserInput(
        'Complete verification in the browser (choose "Meta tag" method)'
      );
    }

    // Submit sitemap
    console.log("Submitting sitemap to Bing...");

    const sitemapsLink = await page
      .locator('a:has-text("Sitemaps"), div:has-text("Sitemaps")')
      .first();
    if (await sitemapsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sitemapsLink.click();
      await sleep(2000);

      const sitemapInput = await page.locator('input[type="text"]').first();
      await sitemapInput.fill(SITEMAP_URL);

      const submitBtn = await page.locator('button:has-text("Submit")').first();
      await submitBtn.click();
      console.log("✅ Sitemap submitted to Bing!");
    } else {
      await waitForUserInput(
        "Please submit sitemap manually: navigate to Sitemaps and add " +
          SITEMAP_URL
      );
    }

    console.log("\n✅ Bing Webmaster Tools setup complete!");
  } catch (error) {
    console.error("Error:", error.message);
    await waitForUserInput(
      "Something went wrong. Check the browser and continue manually if needed"
    );
  }
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  🌐 Google Indexing Setup for HerbAlly");
  console.log("═══════════════════════════════════════════════════════════\n");

  const profilePath = `${process.env.HOME}/.chrome-automation-profile`;

  console.log("Launching Chrome with persistent profile...");
  console.log(`Profile path: ${profilePath}\n`);

  // Launch browser with Chrome profile to use existing logins
  const browser = await chromium.launchPersistentContext(profilePath, {
    headless: false,
    channel: "chrome",
    viewport: { width: 1400, height: 900 },
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const page = await browser.newPage();

  try {
    await setupGoogleSearchConsole(page);
    await setupBingWebmaster(page);

    console.log(
      "\n═══════════════════════════════════════════════════════════"
    );
    console.log(
      "  ✅ All Done! Your site should start indexing within 24-48h."
    );
    console.log(
      "═══════════════════════════════════════════════════════════\n"
    );
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
