import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { buildContentSecurityPolicy } from "@/lib/ads/csp";

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  rateLimitKey: vi.fn((prefix: string, ip: string) => `${prefix}:${ip}`),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: () => ({
      select: () => ({
        limit: vi.fn().mockResolvedValue({ data: [{ id: "1" }], error: null }),
      }),
    }),
  }),
}));

import { GET as getHealth } from "@/app/api/health/route";

describe("Security Controls & RFC 9116 Disclosure", () => {
  it("publishes valid RFC 9116 security.txt with future expiration", () => {
    const securityTxtPath = path.join(
      process.cwd(),
      "public/.well-known/security.txt"
    );
    const content = fs.readFileSync(securityTxtPath, "utf8");
    expect(content).toContain("Contact: mailto:info@herbally.app");
    expect(content).toContain("Preferred-Languages: en, fr");
    expect(content).toContain(
      "Canonical: https://herbally.app/.well-known/security.txt"
    );
    expect(content).toContain(
      "Policy: https://herbally.app/trust#security-disclosure"
    );
    const expiresMatch = /^Expires:\s*(.+)$/m.exec(content);
    expect(expiresMatch).not.toBeNull();
    const expiresMs = Date.parse(expiresMatch?.[1].trim() ?? "");
    expect(Number.isFinite(expiresMs)).toBe(true);
    expect(expiresMs).toBeGreaterThan(Date.now());
  });

  it("enforces fail-closed frame-ancestors and zero ad hosts in default CSP", () => {
    const standardCsp = buildContentSecurityPolicy({
      adHosts: [],
      frameable: false,
      dev: false,
    });
    expect(standardCsp).toContain("frame-ancestors 'none'");
    expect(standardCsp).toContain("object-src 'none'");
    expect(standardCsp).not.toContain("googlesyndication");

    const embedCsp = buildContentSecurityPolicy({
      adHosts: [],
      frameable: true,
      dev: false,
    });
    expect(embedCsp).toContain("frame-ancestors *");
    expect(embedCsp).not.toContain("frame-ancestors 'none'");
  });

  it("/api/health returns only sanitized public status, version, and timestamp without internal leakage", async () => {
    const req = new NextRequest("https://herbally.app/api/health");
    const res = await getHealth(req);
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
      "status",
      "timestamp",
      "version",
    ]);
    expect(body).not.toHaveProperty("checks");
    expect(body).not.toHaveProperty("database");
    expect(body).not.toHaveProperty("stripe");
    expect(res.headers.get("cache-control")).toBe("no-store, max-age=0");
  });
});
