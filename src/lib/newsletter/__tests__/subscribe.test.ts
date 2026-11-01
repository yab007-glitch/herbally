import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CONSENT_TEXT,
  normalizeEmail,
  subscribe,
} from "@/lib/newsletter/subscribe";
import { resetMailTransport } from "@/lib/email/mailer";

describe("normalizeEmail", () => {
  it("lowercases and trims a normal address", () => {
    expect(normalizeEmail("  Someone@Example.COM ")).toBe(
      "someone@example.com"
    );
  });

  it("rejects addresses without a usable domain", () => {
    for (const bad of [
      "",
      "a@b",
      "no-at-sign.com",
      "two@@example.com",
      "x@y.z",
    ]) {
      expect(normalizeEmail(bad), bad).toBeNull();
    }
  });

  it("rejects absurdly long input rather than passing it downstream", () => {
    expect(normalizeEmail(`${"a".repeat(250)}@example.com`)).toBeNull();
  });
});

describe("consent wording", () => {
  it("states the purpose and the opt-out in both languages", () => {
    for (const locale of ["en", "fr"] as const) {
      const text = CONSENT_TEXT[locale];
      expect(text.length).toBeGreaterThan(60);
      expect(text.toLowerCase()).toMatch(/unsubscrib|désabonn/);
    }
  });
});

describe("subscribe without a configured mailbox", () => {
  const saved = {
    user: process.env.ZOHO_SMTP_USER,
    pass: process.env.ZOHO_SMTP_PASSWORD,
  };

  beforeEach(() => {
    delete process.env.ZOHO_SMTP_USER;
    delete process.env.ZOHO_SMTP_PASSWORD;
    resetMailTransport();
  });

  afterEach(() => {
    if (saved.user !== undefined) process.env.ZOHO_SMTP_USER = saved.user;
    if (saved.pass !== undefined) process.env.ZOHO_SMTP_PASSWORD = saved.pass;
    resetMailTransport();
  });

  it("refuses instead of storing an address it could never confirm", async () => {
    const outcome = await subscribe({
      email: "person@example.com",
      locale: "en",
    });
    expect(outcome).toEqual({ ok: false, reason: "mail-not-configured" });
  });

  it("still rejects malformed addresses before checking mail", async () => {
    const outcome = await subscribe({ email: "nope", locale: "en" });
    expect(outcome).toEqual({ ok: false, reason: "invalid-email" });
  });
});
