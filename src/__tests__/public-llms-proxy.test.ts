import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import proxy from "@/proxy";

describe("public llms.txt & llms-full.txt routing", () => {
  it.each([
    ["/llms.txt default", "/llms.txt", {}],
    [
      "/llms.txt French language",
      "/llms.txt",
      { "accept-language": "fr-CA,fr;q=0.9" },
    ],
    ["/llms.txt French cookie", "/llms.txt", { cookie: "herbally-locale=fr" }],
    ["/llms-full.txt default", "/llms-full.txt", {}],
    [
      "/llms-full.txt French cookie",
      "/llms-full.txt",
      { cookie: "herbally-locale=fr" },
    ],
  ])(
    "passes through without localization for %s",
    async (_name, path, headers) => {
      const response = await proxy(
        new NextRequest(`https://herbally.app${path}`, { headers })
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    }
  );
});
