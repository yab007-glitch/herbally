import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import proxy from "@/proxy";

describe("public llms.txt routing", () => {
  it.each([
    ["default", {}],
    ["French language", { "accept-language": "fr-CA,fr;q=0.9" }],
    ["French cookie", { cookie: "herbally-locale=fr" }],
  ])("passes through without localization for %s", async (_name, headers) => {
    const response = await proxy(
      new NextRequest("https://herbally.app/llms.txt", { headers })
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });
});
