import { afterEach, describe, expect, it } from "vitest";
import { buildCsp, supabaseApiOrigin } from "../csp";
import { buildContentSecurityPolicy } from "../../ads/csp";

const KEY = "NEXT_PUBLIC_SUPABASE_URL";
const original = process.env[KEY];

/** The value of one directive, e.g. "connect-src 'self' ...". */
function directive(policy: string, name: string): string {
  return policy.split("; ").find((part) => part.startsWith(`${name} `)) ?? "";
}

afterEach(() => {
  if (original === undefined) delete process.env[KEY];
  else process.env[KEY] = original;
});

describe("supabaseApiOrigin", () => {
  it("returns the origin without a path, query or trailing slash", () => {
    process.env[KEY] = "https://api.herbally.app/rest/v1?x=1";
    expect(supabaseApiOrigin()).toBe("https://api.herbally.app");
  });

  it("returns an empty string for a missing or unparseable value", () => {
    delete process.env[KEY];
    expect(supabaseApiOrigin()).toBe("");
    process.env[KEY] = "not a url";
    expect(supabaseApiOrigin()).toBe("");
  });
});

describe("connect-src includes the configured API origin", () => {
  // A self-hosted backend lives on its own hostname, which 'self' does not
  // cover. Without this, every browser-side auth and REST call is CSP-blocked
  // the moment the backend leaves *.supabase.co.
  it("adds the origin in buildCsp", () => {
    process.env[KEY] = "https://api.herbally.app";
    const policy = buildCsp({ isProduction: true });
    expect(directive(policy, "connect-src")).toContain(
      "https://api.herbally.app"
    );
    // The Cloud wildcard must survive for the current deployment.
    expect(directive(policy, "connect-src")).toContain("*.supabase.co");
  });

  it("adds the origin in buildContentSecurityPolicy", () => {
    process.env[KEY] = "https://api.herbally.app";
    const policy = buildContentSecurityPolicy({});
    expect(directive(policy, "connect-src")).toContain(
      "https://api.herbally.app"
    );
  });

  it("leaves the policy untouched when the variable is absent", () => {
    delete process.env[KEY];
    for (const policy of [
      buildCsp({ isProduction: true }),
      buildContentSecurityPolicy({}),
    ]) {
      const connect = directive(policy, "connect-src");
      expect(
        connect.startsWith("connect-src 'self' *.supabase.co *.stripe.com")
      ).toBe(true);
      expect(connect).not.toContain("undefined");
      expect(connect).not.toContain("null");
    }
  });

  it("does not widen any other directive", () => {
    process.env[KEY] = "https://api.herbally.app";
    const policy = buildCsp({ isProduction: true });
    for (const name of ["script-src", "img-src", "frame-src", "default-src"]) {
      expect(directive(policy, name)).not.toContain("api.herbally.app");
    }
  });
});
