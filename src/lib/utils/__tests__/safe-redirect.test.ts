import { describe, it, expect } from "vitest";
import { safeNextPath } from "../safe-redirect";

describe("safeNextPath — open-redirect defense for auth callback / login returnTo", () => {
  it("returns / for null / undefined / empty input", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("")).toBe("/");
  });

  it("accepts a plain same-origin path", () => {
    expect(safeNextPath("/")).toBe("/");
    expect(safeNextPath("/reset-password")).toBe("/reset-password");
    expect(safeNextPath("/herbs/turmeric?from=login#section")).toBe(
      "/herbs/turmeric?from=login#section"
    );
  });

  it("rejects protocol-relative URLs (//evil.com)", () => {
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("//evil.com/login")).toBe("/");
  });

  it("rejects backslash variants that browsers normalize to /", () => {
    // /\evil.com — Chrome/Firefox/Safari treat \ as / → //evil.com
    expect(safeNextPath("/\\evil.com")).toBe("/");
    // URL-encoded: /%5Cevil.com → server decodes to /\evil.com → reject.
    expect(safeNextPath("/%5Cevil.com")).toBe("/");
    // Note: /%255Cevil.com is NOT an attack — browsers single-decode Location
    // headers, so %25→% and the result is the literal three chars "%5C" in
    // the path. No re-decode happens, so no normalization to //evil.com.
    // Double-encoded forms are safe; the test above for /%5Cevil.com already
    // covers the real attack.
    // /\\evil.com — double backslash (server-side, no encoding)
    expect(safeNextPath("/\\\\evil.com")).toBe("/");
  });

  it("rejects percent-encoded //", () => {
    // /%2F%2Fevil.com decodes to //evil.com
    expect(safeNextPath("/%2F%2Fevil.com")).toBe("/");
    expect(safeNextPath("/%2f%2fevil.com")).toBe("/");
  });

  it("rejects an explicit scheme (javascript:, data:, http:)", () => {
    // /javascript:alert(1) — after decode, regex catches the scheme.
    expect(safeNextPath("/javascript:alert(1)")).toBe("/");
    // /data:text/html,... — same shape.
    expect(safeNextPath("/data:text/html,<script>")).toBe("/");
  });

  it("rejects non-leading-slash inputs that look like absolute URLs", () => {
    // No leading slash at all — relative path
    expect(safeNextPath("reset-password")).toBe("/");
    // Absolute http(s) URL — never an in-app path
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("http://evil.com/login")).toBe("/");
  });

  it("rejects input with leading whitespace + scheme", () => {
    // /   javascript:alert(1) — leading whitespace is allowed by some
    // parsers, then the scheme prefix takes over.
    expect(safeNextPath("  javascript:alert(1)")).toBe("/");
  });

  it("falls back to / on malformed percent-encoding", () => {
    // Lone % is invalid percent-encoding
    expect(safeNextPath("/%")).toBe("/");
    expect(safeNextPath("/%ZZ")).toBe("/");
  });
});
