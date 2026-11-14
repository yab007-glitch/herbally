import { afterEach, describe, expect, it } from "vitest";
import { buildCsp, supabaseApiOrigin } from "../csp";
import { buildContentSecurityPolicy } from "../../ads/csp";

const KEY = "NEXT_PUBLIC_SUPABASE_URL";
const original = process.env[KEY];

/** The tokens of one directive, e.g. ["connect-src", "'self'", …]. */
function tokens(policy: string, name: string): string[] {
  const line = policy
    .split("; ")
    .find((part) => part.startsWith(`${name} `) || part === name);
  return line ? line.split(" ").filter(Boolean) : [];
}

afterEach(() => {
  if (original === undefined) delete process.env[KEY];
  else process.env[KEY] = original;
});

describe("supabaseApiOrigin", () => {
  it("returns the origin without a path, query, fragment or credentials", () => {
    process.env[KEY] = "https://user:pass@api.herbally.app/rest/v1?x=1#f";
    expect(supabaseApiOrigin()).toBe("https://api.herbally.app");
  });

  it("keeps a non-default port", () => {
    process.env[KEY] = "http://127.0.0.1:54321/rest/v1";
    expect(supabaseApiOrigin()).toBe("http://127.0.0.1:54321");
  });

  it("treats a missing value as absent", () => {
    delete process.env[KEY];
    expect(supabaseApiOrigin()).toBe("");
  });

  it("rejects unparseable values", () => {
    process.env[KEY] = "not a url";
    expect(supabaseApiOrigin()).toBe("");
  });

  it("rejects non-http(s) schemes instead of emitting a bogus source", () => {
    // `new URL("data:…").origin` is the literal string "null"; a "null" source
    // in connect-src is meaningless, and javascript:/ftp:/ws: are not
    // transports this app uses, so all of them must be treated as absent.
    for (const value of [
      "javascript:alert(1)",
      "data:text/plain,hello",
      "ftp://example.com",
      "ws://example.com",
    ]) {
      process.env[KEY] = value;
      expect(supabaseApiOrigin(), value).toBe("");
    }
  });

  it("never lets a crafted value inject another directive", () => {
    process.env[KEY] = "https://api.herbally.app; script-src *";
    expect(supabaseApiOrigin()).not.toContain("script-src");
    const policy = buildContentSecurityPolicy({});
    const script = tokens(policy, "script-src");
    expect(script).not.toContain("*");
    expect(policy.match(/script-src/g) ?? []).toHaveLength(1);
  });
});

describe("connect-src includes the configured API origin", () => {
  // A self-hosted backend lives on its own hostname, which 'self' does not
  // cover. Without this, every browser-side auth and REST call is CSP-blocked
  // the moment the backend leaves *.supabase.co.
  const builders = [
    ["buildCsp", () => buildCsp({ isProduction: true })],
    [
      "buildContentSecurityPolicy (the live proxy path)",
      () => buildContentSecurityPolicy({}),
    ],
  ] as const;

  for (const [label, build] of builders) {
    it(`adds the origin as an exact token in ${label}`, () => {
      process.env[KEY] = "https://api.herbally.app";
      const parsed = tokens(build(), "connect-src");
      expect(parsed).toContain("https://api.herbally.app");
      // The Cloud wildcard must survive for the current deployment.
      expect(parsed).toContain("*.supabase.co");
      expect(parsed).toContain("'self'");
    });

    it(`leaves the policy untouched when the variable is absent in ${label}`, () => {
      delete process.env[KEY];
      const connect = tokens(build(), "connect-src");
      expect(connect).toContain("'self'");
      expect(connect).toContain("*.supabase.co");
      expect(connect).toContain("*.stripe.com");
      expect(connect).not.toContain("undefined");
      expect(connect).not.toContain("null");
      expect(connect).toHaveLength(label === "buildCsp" ? 9 : 4);
    });

    it(`does not widen any other directive in ${label}`, () => {
      process.env[KEY] = "https://api.herbally.app";
      const policy = build();
      for (const name of [
        "script-src",
        "img-src",
        "frame-src",
        "default-src",
      ]) {
        expect(tokens(policy, name)).not.toContain("https://api.herbally.app");
      }
    });
  }
});
