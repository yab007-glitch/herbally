import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Guards the proxy's Supabase client. supabase-js sets no request timeout, so
 * a client built here without the shared boundedFetch can stall every
 * middleware invocation on a hung instance — the failure mode that burned the
 * Vercel CPU allowance. Assert on the options actually handed to the SDK.
 */
const createServerClientMock = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => createServerClientMock(...args),
}));

import { updateSession } from "@/lib/supabase/middleware";
import { boundedFetch } from "@/lib/supabase/fetch-with-timeout";

function request(authenticated = true) {
  return new NextRequest("https://herbally.app/herbs/ginger", {
    headers: authenticated
      ? { cookie: "sb-abcdefghijklmnop-auth-token=test-token" }
      : undefined,
  });
}

describe("updateSession", () => {
  beforeEach(() => {
    createServerClientMock.mockReset();
    createServerClientMock.mockReturnValue({
      auth: { getUser: async () => ({ data: { user: null } }) },
    });
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  it("builds the Supabase client with the shared bounded fetch", async () => {
    await updateSession(request());

    expect(createServerClientMock).toHaveBeenCalledTimes(1);
    const options = createServerClientMock.mock.calls[0][2];
    expect(options.global?.fetch).toBe(boundedFetch);
  });

  it("skips the client when there is no auth cookie", async () => {
    const result = await updateSession(request(false));

    expect(createServerClientMock).not.toHaveBeenCalled();
    expect(result.supabase).toBeNull();
    expect(result.user).toBeNull();
  });

  it("does not construct a client when Supabase env is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const result = await updateSession(request());

    expect(createServerClientMock).not.toHaveBeenCalled();
    expect(result.supabase).toBeNull();
  });
});
