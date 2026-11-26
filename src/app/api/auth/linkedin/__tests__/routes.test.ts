import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { rateLimitMock } = vi.hoisted(() => ({
  rateLimitMock: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: rateLimitMock,
  rateLimitKey: (ns: string, ip: string) => `${ns}:${ip}`,
}));

vi.mock("@/lib/utils/client-ip", () => ({
  getClientIP: () => "127.0.0.1",
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { GET as startGet } from "../start/route";
import { GET as callbackGet } from "../callback/route";
import { POST as logoutPost } from "../logout/route";
import { GET as sessionGet } from "../session/route";
import {
  LINKEDIN_SESSION_COOKIE,
  LINKEDIN_STATE_COOKIE,
  createOAuthState,
  createReviewerSessionToken,
  verifyReviewerSessionToken,
} from "@/lib/auth/linkedin-oidc";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  rateLimitMock.mockResolvedValue({ success: true, remaining: 19 });
  process.env = { ...ORIGINAL_ENV };
  process.env.LINKEDIN_CLIENT_ID = "li-cid";
  process.env.LINKEDIN_CLIENT_SECRET = "li-secret-value-123456";
  process.env.NEXT_PUBLIC_APP_URL = "https://herbally.app";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("LinkedIn OAuth route handlers", () => {
  it("/start redirects to authError=not_configured when creds are missing", async () => {
    delete process.env.LINKEDIN_CLIENT_ID;
    const res = await startGet(
      new NextRequest(
        "https://herbally.app/api/auth/linkedin/start?next=%2Fclinical-review"
      )
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://herbally.app/clinical-review?authError=not_configured"
    );
  });

  it("/start preserves /herbs/<slug>?suggestEdit=1 on not_configured redirect", async () => {
    delete process.env.LINKEDIN_CLIENT_ID;
    const res = await startGet(
      new NextRequest(
        "https://herbally.app/api/auth/linkedin/start?next=%2Fherbs%2Fginger%3FsuggestEdit%3D1"
      )
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://herbally.app/herbs/ginger?suggestEdit=1&authError=not_configured"
    );
  });

  it("/start sets signed HttpOnly state cookie and redirects to LinkedIn authorize", async () => {
    const res = await startGet(
      new NextRequest(
        "https://herbally.app/api/auth/linkedin/start?next=%2Ffr%2Fclinical-review%3FtargetType%3Dherb%26slug%3Dginger"
      )
    );
    expect(res.status).toBe(302);
    const location = res.headers.get("location") ?? "";
    expect(location).toMatch(
      /^https:\/\/www\.linkedin\.com\/oauth\/v2\/authorization/
    );
    expect(res.cookies.get(LINKEDIN_STATE_COOKIE)?.value).toBeTruthy();
  });

  it("/callback redirects to invalid_state when cookie mismatches state query", async () => {
    const res = await callbackGet(
      new NextRequest(
        "https://herbally.app/api/auth/linkedin/callback?code=c1&state=tampered"
      )
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://herbally.app/clinical-review?authError=invalid_state"
    );
    expect(res.cookies.get(LINKEDIN_STATE_COOKIE)?.value).toBe("");
  });

  it("/callback handles user cancellation cleanly", async () => {
    const res = await callbackGet(
      new NextRequest(
        "https://herbally.app/api/auth/linkedin/callback?error=user_cancelled_login"
      )
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://herbally.app/clinical-review?authError=cancelled"
    );
  });

  it("/callback exchanges code, sets HttpOnly reviewer session cookie, and redirects to next", async () => {
    const issued = createOAuthState(
      "/clinical-review?targetType=herb&slug=ginger"
    )!;
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "acc-1" }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sub: "sub-abc",
            name: "Dr. Samira Lee",
            email: "samira@clinic.ca",
            email_verified: true,
          }),
          { status: 200 }
        )
      );

    const req = new NextRequest(
      `https://herbally.app/api/auth/linkedin/callback?code=ok-code&state=${encodeURIComponent(issued.state)}`,
      {
        headers: {
          cookie: `${LINKEDIN_STATE_COOKIE}=${issued.cookieToken}`,
        },
      }
    );
    const res = await callbackGet(req);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://herbally.app/clinical-review?targetType=herb&slug=ginger"
    );
    const sessionCookie = res.cookies.get(LINKEDIN_SESSION_COOKIE);
    expect(sessionCookie?.value).toBeTruthy();
    const verified = verifyReviewerSessionToken(sessionCookie?.value);
    expect(verified?.sub).toBe("sub-abc");
    expect(verified?.email).toBe("samira@clinic.ca");
  });

  it("/logout clears reviewer session cookie", async () => {
    const res = await logoutPost();
    expect(res.status).toBe(200);
    expect(res.cookies.get(LINKEDIN_SESSION_COOKIE)?.value).toBe("");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("/session returns 200 JSON without leaking 401 for signed-out callers", async () => {
    const res = await sessionGet(
      new NextRequest("https://herbally.app/api/auth/linkedin/session")
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const json = await res.json();
    expect(json).toEqual({
      configured: true,
      authenticated: false,
      reviewer: null,
    });
    expect(createReviewerSessionToken).toBeTypeOf("function");
  });

  it("/callback redirects cancelled herb flows straight back to /herbs/<slug>?suggestEdit=1&authError=cancelled", async () => {
    const issued = createOAuthState("/herbs/ginger?suggestEdit=1")!;
    const res = await callbackGet(
      new NextRequest(
        "https://herbally.app/api/auth/linkedin/callback?error=user_cancelled_login",
        {
          headers: {
            cookie: `${LINKEDIN_STATE_COOKIE}=${issued.cookieToken}`,
          },
        }
      )
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://herbally.app/herbs/ginger?suggestEdit=1&authError=cancelled"
    );
  });
});
