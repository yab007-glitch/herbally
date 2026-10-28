import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

for (const [name, headers] of [
  ["default", {}],
  ["French language", { "Accept-Language": "fr" }],
  ["French cookie", { Cookie: "herbally-locale=fr" }],
] as const) {
  test(`serves llms.txt without localization: ${name}`, async ({ request }) => {
    const response = await request.get("/llms.txt", {
      headers,
      maxRedirects: 0,
    });
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/plain");
    expect(await response.text()).toBe(
      await readFile("public/llms.txt", "utf8")
    );
  });
}
