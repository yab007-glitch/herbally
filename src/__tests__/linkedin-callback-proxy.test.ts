import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: async () => ({
    supabaseResponse: { cookies: { getAll: () => [] } },
    user: null,
    supabase: null,
  }),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: async () => ({ success: true, remaining: 99 }),
}));

import proxy from "../proxy";

describe("proxy LinkedIn OAuth callback pass-through", () => {
  it("does NOT hijack /api/auth/linkedin/callback?code=... into /auth/callback?next=/reset-password", async () => {
    const req = new NextRequest(
      "https://herbally.app/api/auth/linkedin/callback?code=li-auth-code&state=li-state"
    );
    const res = await proxy(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("still catches bare Supabase password-reset ?code= on non-OAuth pages", async () => {
    const req = new NextRequest("https://herbally.app/?code=supabase-code");
    const res = await proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/callback");
  });
});
