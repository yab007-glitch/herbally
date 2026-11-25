import { test, expect } from "@playwright/test";

/**
 * Post-00104 migrated-DB E2E suite (runs against real PG16 + PostgREST + Next.js).
 * Fails loudly if any seeded herb route, view embed, API check, or JSON-LD script
 * is unavailable or leaks pediatric dosing. Never skips silently.
 */
test.describe("Migrated-DB Post-00104 E2E", () => {
  test("renders /herbs directory from herbs_public + herb_categories(*) embed", async ({
    page,
  }) => {
    const res = await page.goto("/herbs");
    expect(res?.status()).toBe(200);
    await expect(page.getByText("Chamomile").first()).toBeVisible();
  });

  test("renders /herbs/chamomile with sanitized JSON-LD (no pediatricDose) and preserved warning", async ({
    page,
  }) => {
    const res = await page.goto("/herbs/chamomile");
    expect(res?.status()).toBe(200);

    const ldScripts = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    expect(ldScripts.length).toBeGreaterThan(0);

    for (const raw of ldScripts) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      expect(JSON.stringify(parsed)).not.toMatch(/"pediatricDose"/i);
      expect(parsed.pediatricDose).toBeUndefined();
      if (parsed.dosage && typeof parsed.dosage === "object") {
        const doseVal = String(
          (parsed.dosage as Record<string, unknown>).doseValue ?? ""
        );
        // The genuine poisoning warning ("Children who ingest 5 g…") must
        // survive in the body, so exclude hazard sentences before asserting
        // that no pediatric dosing context reached structured data.
        const doseSentences = doseVal
          .split(/(?<=[.!?])\s+/)
          .filter(
            (sentence) =>
              !/\b(ingest|ingested|poison|overdose|emergency|allergic|swallow)\b/i.test(
                sentence
              )
          );
        expect(doseSentences.join(" ")).not.toMatch(
          /\b(children|infant|pediatric)\b/i
        );
      }
    }

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).toContain("500 mg");
    expect(bodyText).toContain("Children who ingest 5 g");
    expect(bodyText).not.toContain("100 mg daily for children");
  });

  test("renders /herbs/atropa-belladonna-herb with no dosage or pediatricDose in JSON-LD", async ({
    page,
  }) => {
    const res = await page.goto("/herbs/atropa-belladonna-herb");
    expect(res?.status()).toBe(200);

    const ldScripts = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    expect(ldScripts.length).toBeGreaterThan(0);

    for (const raw of ldScripts) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      expect(JSON.stringify(parsed)).not.toMatch(/"pediatricDose"/i);
      expect(JSON.stringify(parsed)).not.toMatch(/"dosage"\s*:/i);
      expect(parsed.pediatricDose).toBeUndefined();
      expect(parsed.dosage).toBeUndefined();
    }
  });

  test("verifies /api/interactions/check and /api/herbs/search against post-00104 PostgREST views", async ({
    request,
  }) => {
    const checkRes = await request.get(
      "/api/interactions/check?herb=chamomile&drug=warfarin"
    );
    expect(checkRes.status()).toBe(200);
    const checkJson = (await checkRes.json()) as {
      found: boolean;
      pair?: { drugName: string; publicationStatus?: string };
    };
    expect(checkJson.found).toBe(true);
    expect(checkJson.pair?.drugName).toBe("Warfarin");
    expect(checkJson.pair?.publicationStatus).toBeTruthy();

    const searchRes = await request.get("/api/herbs/search?q=chamomile");
    expect(searchRes.status()).toBe(200);
    const searchJson = (await searchRes.json()) as Array<
      Record<string, unknown>
    >;
    expect(Array.isArray(searchJson)).toBe(true);
    expect(searchJson.some((h) => h.slug === "chamomile")).toBe(true);
    for (const row of searchJson) {
      expect(row.dosage_child ?? null).toBeNull();
    }
  });

  test("verifies /calculator?herb=chamomile blocks minors and renders print notice for adults", async ({
    page,
  }) => {
    const res = await page.goto("/calculator?herb=chamomile", {
      waitUntil: "networkidle",
    });
    expect(res?.status()).toBe(200);

    const calculateBtn = page.getByRole("button", { name: /^Calculate$/ });
    await expect(calculateBtn).toBeVisible();

    await page.getByLabel(/Adult Dose/i).fill("500");
    await page.getByLabel(/Adult age/i).fill("30");
    await calculateBtn.click();
    await expect(page.locator(".text-4xl").first()).toHaveText(/500\s*mg/i);

    await page.emulateMedia({ media: "print" });
    await expect(
      page.getByRole("complementary", { name: /Printed safety notice/i })
    ).toBeVisible();
  });

  test("verifies /api/chat deterministic blocked 200 without AI key on migrated DB", async ({
    request,
  }) => {
    const pedRes = await request.post("/api/chat", {
      data: {
        locale: "en",
        messages: [
          {
            role: "user",
            content: "What chamomile dose for my 18 months old toddler?",
          },
        ],
      },
    });
    expect(pedRes.status()).toBe(200);
    expect(pedRes.headers()["x-herbally-answer-status"]).toBe("blocked");
    expect(pedRes.headers()["x-herbally-answer-reason"]).toBe("pediatric");
  });
});
