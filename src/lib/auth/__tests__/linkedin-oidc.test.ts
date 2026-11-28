import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildLinkedInAuthorizeUrl,
  buildLinkedInErrorRedirect,
  createOAuthState,
  createReviewerSessionToken,
  exchangeLinkedInCodeForUser,
  extractNextFromStateCookie,
  getLinkedInOidcConfig,
  sanitizeClinicalReviewNext,
  verifyOAuthState,
  verifyReviewerSessionToken,
} from "../linkedin-oidc";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  process.env.LINKEDIN_CLIENT_ID = "li-client-id-123456";
  process.env.LINKEDIN_CLIENT_SECRET = "li-client-secret-super-secret-value";
  process.env.NEXT_PUBLIC_APP_URL = "https://herbally.app";
  delete process.env.LINKEDIN_SESSION_SECRET;
  delete process.env.LINKEDIN_REDIRECT_URI;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("linkedin-oidc", () => {
  it("fails closed when client credentials are missing or placeholders", () => {
    delete process.env.LINKEDIN_CLIENT_ID;
    expect(getLinkedInOidcConfig()).toBeNull();

    process.env.LINKEDIN_CLIENT_ID = "placeholder";
    expect(getLinkedInOidcConfig()).toBeNull();
  });

  it("issues and verifies CSRF OAuth state while rejecting tampering or wrong nonces", () => {
    const issued = createOAuthState(
      "/clinical-review?targetType=herb&slug=ginger"
    );
    expect(issued).not.toBeNull();
    const ok = verifyOAuthState(issued!.cookieToken, issued!.state);
    expect(ok).not.toBeNull();
    expect(ok?.next).toBe("/clinical-review?targetType=herb&slug=ginger");

    expect(verifyOAuthState(issued!.cookieToken, "wrong-state")).toBeNull();
    const parts = issued!.cookieToken.split(".");
    const tampered = `${parts[0]}.${parts[1]}.deadbeef`;
    expect(verifyOAuthState(tampered, issued!.state)).toBeNull();
  });

  it("prevents open redirects and permits /clinical-review and /herbs/<slug> return paths", () => {
    expect(sanitizeClinicalReviewNext("//evil.com")).toBe("/clinical-review");
    expect(sanitizeClinicalReviewNext("/admin/edit-requests")).toBe(
      "/clinical-review"
    );
    expect(sanitizeClinicalReviewNext("/herbs/bad_slug/extra")).toBe(
      "/clinical-review"
    );
    expect(sanitizeClinicalReviewNext("/herbs/Ginger")).toBe(
      "/herbs/ginger?suggestEdit=1"
    );
    expect(
      sanitizeClinicalReviewNext("/fr/herbs/turmeric?field=dosage_safety&bad=1")
    ).toBe("/fr/herbs/turmeric?suggestEdit=1&field=dosage_safety");
    expect(
      sanitizeClinicalReviewNext(
        "/fr/clinical-review?targetType=interaction&slug=ginger&drug=Warfarin&injected=bad"
      )
    ).toBe(
      "/fr/clinical-review?targetType=interaction&slug=ginger&drug=Warfarin"
    );
    expect(
      sanitizeClinicalReviewNext(
        "/clinical-review?intent=signoff&targetType=interaction&slug=st-johns-wort&drug=Rivaroxaban&injected=bad"
      )
    ).toBe(
      "/clinical-review?targetType=interaction&slug=st-johns-wort&drug=Rivaroxaban&intent=signoff"
    );

    expect(
      buildLinkedInErrorRedirect(
        "https://herbally.app",
        "/herbs/ginger?suggestEdit=1",
        "cancelled"
      )
    ).toBe(
      "https://herbally.app/herbs/ginger?suggestEdit=1&authError=cancelled"
    );
    expect(
      buildLinkedInErrorRedirect(
        "https://herbally.app",
        "/fr/clinical-review",
        "not_configured"
      )
    ).toBe("https://herbally.app/fr/clinical-review?authError=not_configured");

    const issued = createOAuthState("/herbs/ginger?suggestEdit=1")!;
    expect(extractNextFromStateCookie(issued.cookieToken)).toBe(
      "/herbs/ginger?suggestEdit=1"
    );
    expect(extractNextFromStateCookie("tampered")).toBe("/clinical-review");
  });

  it("signs and verifies reviewer session tokens", () => {
    const token = createReviewerSessionToken({
      sub: "sub-999",
      name: "Dr. Jane PharmD",
      email: "jane@hospital.example",
      emailVerified: true,
      picture: "https://media.licdn.com/photo.jpg",
    });
    expect(token).toBeTruthy();

    const parsed = verifyReviewerSessionToken(token);
    expect(parsed).toMatchObject({
      sub: "sub-999",
      name: "Dr. Jane PharmD",
      email: "jane@hospital.example",
      emailVerified: true,
    });

    expect(verifyReviewerSessionToken("invalid")).toBeNull();
  });

  it("builds standard LinkedIn OIDC authorize URL", () => {
    const url = new URL(
      buildLinkedInAuthorizeUrl({
        clientId: "cid-1",
        redirectUri: "https://herbally.app/api/auth/linkedin/callback",
        state: "st-1",
      })
    );
    expect(url.origin).toBe("https://www.linkedin.com");
    expect(url.pathname).toBe("/oauth/v2/authorization");
    expect(url.searchParams.get("scope")).toBe("openid profile email");
    expect(url.searchParams.get("client_id")).toBe("cid-1");
  });

  it("exchanges authorization code for userinfo profile", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "tok-abc" }), {
          status: 200,
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sub: "li-sub-42",
            name: "Dr. Ali Patel",
            email: "ali.patel@clinic.org",
            email_verified: true,
          }),
          { status: 200 }
        )
      );

    const cfg = getLinkedInOidcConfig()!;
    const user = await exchangeLinkedInCodeForUser({
      code: "auth-code-1",
      config: cfg,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(user).toEqual({
      sub: "li-sub-42",
      name: "Dr. Ali Patel",
      email: "ali.patel@clinic.org",
      emailVerified: true,
      picture: null,
    });
  });
});
