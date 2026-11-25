import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { exchangeCodeForSessionMock, migrateGuestDataMock, warnMock } =
  vi.hoisted(() => ({
    exchangeCodeForSessionMock: vi.fn(),
    migrateGuestDataMock: vi.fn(),
    warnMock: vi.fn(),
  }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { exchangeCodeForSession: exchangeCodeForSessionMock },
  }),
}));

vi.mock("@/lib/actions/guest-migration", () => ({
  migrateGuestData: migrateGuestDataMock,
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: { info: vi.fn(), warn: warnMock, error: vi.fn() },
}));

import { GET } from "../route";

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://herbally.app";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("exchanges code, migrates guest data, and redirects to safeNext with private no-store", async () => {
    exchangeCodeForSessionMock.mockResolvedValueOnce({ error: null });
    migrateGuestDataMock.mockResolvedValueOnce({ status: "skipped" });

    const res = await GET(
      new Request(
        "http://0.0.0.0:3000/auth/callback?code=pkce-123&next=%2Fprofile%3Ftab%3Dgarden"
      )
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://herbally.app/profile?tab=garden"
    );
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(migrateGuestDataMock).toHaveBeenCalledTimes(1);
  });

  it("neutralizes open-redirect attempts in next parameter", async () => {
    exchangeCodeForSessionMock.mockResolvedValueOnce({ error: null });

    const res = await GET(
      new Request(
        "http://localhost:3000/auth/callback?code=pkce-123&next=//evil.com"
      )
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://herbally.app/");
  });

  it("sanitizes exchange errors from redirect URL and logs a warning", async () => {
    exchangeCodeForSessionMock.mockResolvedValueOnce({
      error: { message: "internal db token secret leak" },
    });

    const res = await GET(
      new Request("http://0.0.0.0:3000/auth/callback?code=bad-code")
    );

    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toMatch(/^https:\/\/herbally\.app\/login\?error=/);
    expect(location).not.toContain("secret");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(warnMock).toHaveBeenCalled();
    expect(migrateGuestDataMock).not.toHaveBeenCalled();
  });
});
