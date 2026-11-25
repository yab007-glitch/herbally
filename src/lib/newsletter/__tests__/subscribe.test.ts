import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  sendMailMock,
  maybeSingleMock,
  insertMock,
  insertSingleMock,
  updateMock,
  updateResultMock,
} = vi.hoisted(() => ({
  sendMailMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  insertMock: vi.fn(),
  insertSingleMock: vi.fn(),
  updateMock: vi.fn(),
  updateResultMock: vi.fn(),
}));

vi.mock("@/lib/email/mailer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email/mailer")>();
  return {
    ...actual,
    isMailConfigured: () =>
      Boolean(process.env.ZOHO_SMTP_USER && process.env.ZOHO_SMTP_PASSWORD),
    sendMail: (args: unknown) => sendMailMock(args),
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => maybeSingleMock(),
        }),
      }),
      insert: (payload: unknown) => {
        insertMock(payload);
        return {
          select: () => ({
            single: () => insertSingleMock(),
          }),
        };
      },
      update: (payload: unknown) => {
        updateMock(payload);
        const filters: Array<[string, unknown]> = [];
        let orExpr: string | null = null;
        const builder = {
          eq: (col: string, val: unknown) => {
            filters.push([col, val]);
            return builder;
          },
          is: (col: string, val: unknown) => {
            filters.push([col, val]);
            return builder;
          },
          or: (expr: string) => {
            orExpr = expr;
            return builder;
          },
          select: () => ({
            maybeSingle: () =>
              updateResultMock("select", payload, { filters, orExpr }),
          }),
          then: (
            resolve: (v: unknown) => unknown,
            reject?: (e: unknown) => unknown
          ) =>
            Promise.resolve(
              updateResultMock("then", payload, { filters, orExpr })
            ).then(resolve, reject),
        };
        return builder;
      },
    }),
  }),
}));

import {
  CONSENT_TEXT,
  SEND_DEADLINE_MS,
  SEND_LEASE_MS,
  normalizeEmail,
  resetNewsletterSendLeases,
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

  it("rejects herbally.app domain addresses to prevent MTA bounces", () => {
    expect(normalizeEmail("user@herbally.app")).toBeNull();
    expect(normalizeEmail("yasser.verification.test@herbally.app")).toBeNull();
    expect(normalizeEmail("sub@test.herbally.app")).toBeNull();
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

  it("silently drops honeypot submissions with uniform accepted status", async () => {
    const outcome = await subscribe({
      email: "bot@example.com",
      locale: "en",
      hp: "spambot-filled-this",
    });
    expect(outcome).toEqual({ ok: true, status: "accepted" });
  });
});

describe("subscribe uniform response & per-address cooldown", () => {
  const saved = {
    user: process.env.ZOHO_SMTP_USER,
    pass: process.env.ZOHO_SMTP_PASSWORD,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetNewsletterSendLeases();
    process.env.ZOHO_SMTP_USER = "digest@herbally.app";
    process.env.ZOHO_SMTP_PASSWORD = "app-password";
    sendMailMock.mockResolvedValue({ sent: true });
    updateResultMock.mockImplementation((kind: string) =>
      kind === "select"
        ? { data: { id: "row-updated" }, error: null }
        : { error: null }
    );
  });

  afterEach(() => {
    if (saved.user !== undefined) process.env.ZOHO_SMTP_USER = saved.user;
    else delete process.env.ZOHO_SMTP_USER;
    if (saved.pass !== undefined) process.env.ZOHO_SMTP_PASSWORD = saved.pass;
    else delete process.env.ZOHO_SMTP_PASSWORD;
  });

  it("returns identical status 'accepted' for new, confirmed, and pending addresses", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null });
    insertSingleMock.mockResolvedValueOnce({
      data: { confirm_token: "tok-new" },
      error: null,
    });
    const newOut = await subscribe({
      email: "fresh1@example.com",
      locale: "en",
    });

    maybeSingleMock.mockResolvedValueOnce({
      data: { id: "id-2", status: "confirmed", confirm_token: "tok-conf" },
    });
    const confOut = await subscribe({
      email: "confirmed@example.com",
      locale: "en",
    });

    maybeSingleMock.mockResolvedValueOnce({
      data: {
        id: "id-3",
        status: "pending",
        confirm_token: "tok-pend",
        consented_at: new Date(Date.now() - 60 * 60_000).toISOString(),
      },
    });
    const pendOut = await subscribe({
      email: "pending-old@example.com",
      locale: "en",
    });

    expect(newOut).toEqual({ ok: true, status: "accepted" });
    expect(confOut).toEqual({ ok: true, status: "accepted" });
    expect(pendOut).toEqual({ ok: true, status: "accepted" });
  });

  it("enforces per-address resend cooldown using last_confirmation_sent_at and sends at most 1 confirmation email within 15 minutes", async () => {
    let sentAt: string | null = new Date(
      Date.now() - 60 * 60_000
    ).toISOString();
    maybeSingleMock.mockImplementation(async () => ({
      data: {
        id: "id-cool",
        status: "pending",
        confirm_token: "tok-cool",
        consented_at: new Date(Date.now() - 60 * 60_000).toISOString(),
        last_confirmation_sent_at: sentAt,
      },
      error: null,
    }));
    updateMock.mockImplementation((payload: Record<string, unknown>) => {
      if (typeof payload.last_confirmation_sent_at === "string") {
        sentAt = payload.last_confirmation_sent_at;
      }
    });

    const first = await subscribe({
      email: "cooldown-user@example.com",
      locale: "en",
    });
    const second = await subscribe({
      email: "cooldown-user@example.com",
      locale: "en",
    });

    expect(first).toEqual({ ok: true, status: "accepted" });
    expect(second).toEqual({ ok: true, status: "accepted" });
    expect(sendMailMock).toHaveBeenCalledTimes(1);
  });

  it("checks DB update errors on resubscribe without calling sendMail", async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        id: "id-unsub-err",
        status: "unsubscribed",
        confirm_token: "tok-old",
        consented_at: new Date(Date.now() - 60 * 60_000).toISOString(),
        last_confirmation_sent_at: new Date(
          Date.now() - 60 * 60_000
        ).toISOString(),
      },
      error: null,
    });
    updateResultMock.mockResolvedValueOnce({
      data: null,
      error: { message: "write failed" },
    });

    const out = await subscribe({
      email: "unsub-err@example.com",
      locale: "en",
    });

    expect(out).toEqual({ ok: false, reason: "error" });
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("does not record cooldown on SMTP failure, releases send lease for immediate retry, and keeps failure response uniform with confirmed addresses", async () => {
    const row = {
      id: "id-smtp",
      status: "pending",
      confirm_token: "tok-smtp",
      consented_at: new Date().toISOString(),
      last_confirmation_sent_at: null as string | null,
      confirmation_send_lease_until: null as string | null,
    };
    maybeSingleMock.mockImplementation(async () => ({
      data: { ...row },
      error: null,
    }));
    updateResultMock.mockImplementation(
      (kind: string, payload: Record<string, unknown>) => {
        if ("confirmation_send_lease_until" in payload) {
          row.confirmation_send_lease_until =
            (payload.confirmation_send_lease_until as string | null) ?? null;
        }
        if ("last_confirmation_sent_at" in payload) {
          row.last_confirmation_sent_at =
            (payload.last_confirmation_sent_at as string | null) ?? null;
        }
        return kind === "select"
          ? { data: { id: row.id }, error: null }
          : { error: null };
      }
    );
    sendMailMock.mockResolvedValueOnce({ sent: false, reason: "smtp-down" });

    const failedAttempt = await subscribe({
      email: "smtp-fail@example.com",
      locale: "en",
    });
    // Uniform with confirmed addresses so SMTP failure cannot be used to enumerate states
    expect(failedAttempt).toEqual({ ok: true, status: "accepted" });
    expect(updateMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        last_confirmation_sent_at: expect.anything(),
      })
    );
    expect(row.last_confirmation_sent_at).toBeNull();
    expect(row.confirmation_send_lease_until).toBeNull();

    // Retry immediately succeeds because failed send released its lease and did not consume cooldown
    sendMailMock.mockResolvedValueOnce({ sent: true });
    const retryAttempt = await subscribe({
      email: "smtp-fail@example.com",
      locale: "en",
    });
    expect(retryAttempt).toEqual({ ok: true, status: "accepted" });
    expect(sendMailMock).toHaveBeenCalledTimes(2);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        last_confirmation_sent_at: expect.any(String),
        confirmation_send_lease_until: null,
      })
    );
  });

  it("does not extend cooldown when suppressed attempts arrive inside the 15-minute window", async () => {
    vi.useFakeTimers();
    try {
      const baseTime = new Date("2026-11-24T12:00:00.000Z");
      vi.setSystemTime(baseTime);

      const originalSentAt = new Date(
        baseTime.getTime() - 10 * 60_000
      ).toISOString();
      maybeSingleMock.mockResolvedValue({
        data: {
          id: "id-no-extend",
          status: "pending",
          confirm_token: "tok-no-extend",
          consented_at: originalSentAt,
          last_confirmation_sent_at: originalSentAt,
        },
        error: null,
      });

      // Attempt at +0m (10m since original send): suppressed, NO DB update
      await subscribe({ email: "noextend@example.com", locale: "en" });
      expect(sendMailMock).not.toHaveBeenCalled();
      expect(updateMock).not.toHaveBeenCalled();

      // Advance 6 minutes (now 16m since original send): resend must succeed!
      vi.setSystemTime(new Date(baseTime.getTime() + 6 * 60_000));
      await subscribe({ email: "noextend@example.com", locale: "en" });
      expect(sendMailMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("deduplicates concurrent in-flight submits for the same address and releases reservation afterward", async () => {
    let resolveMail!: (v: { sent: boolean }) => void;
    sendMailMock.mockImplementationOnce(
      () =>
        new Promise((res) => {
          resolveMail = res;
        })
    );
    maybeSingleMock.mockResolvedValue({
      data: {
        id: "id-conc",
        status: "pending",
        confirm_token: "tok-conc",
        consented_at: new Date(Date.now() - 60 * 60_000).toISOString(),
        last_confirmation_sent_at: null,
      },
      error: null,
    });

    const p1 = subscribe({ email: "race@example.com", locale: "en" });
    const p2 = subscribe({ email: "race@example.com", locale: "en" });
    await Promise.resolve();
    await Promise.resolve();

    resolveMail({ sent: true });
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual({ ok: true, status: "accepted" });
    expect(r2).toEqual({ ok: true, status: "accepted" });
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    // Reservation released -> subsequent submit after cooldown can still run
    updateMock.mockClear();
    sendMailMock.mockResolvedValueOnce({ sent: true });
    const r3 = await subscribe({ email: "race@example.com", locale: "en" });
    expect(r3).toEqual({ ok: true, status: "accepted" });
    expect(sendMailMock).toHaveBeenCalledTimes(2);
  });

  it("blocks immediate retry after post-send stamp failure (both in-memory and across restart via DB lease)", async () => {
    vi.useFakeTimers();
    try {
      const baseTime = new Date("2026-11-24T12:00:00.000Z");
      vi.setSystemTime(baseTime);

      const row = {
        id: "id-stamp-fail",
        status: "pending",
        confirm_token: "tok-stamp-fail",
        consented_at: baseTime.toISOString(),
        last_confirmation_sent_at: null as string | null,
        confirmation_send_lease_until: null as string | null,
      };

      maybeSingleMock.mockImplementation(async () => ({
        data: { ...row },
        error: null,
      }));

      updateResultMock.mockImplementation(
        (kind: string, payload: Record<string, unknown>) => {
          if (kind === "select") {
            row.confirmation_send_lease_until =
              (payload.confirmation_send_lease_until as string | null) ?? null;
            return { data: { id: row.id }, error: null };
          }
          if ("last_confirmation_sent_at" in payload) {
            return { error: { message: "db write timeout" } };
          }
          return { error: null };
        }
      );

      sendMailMock.mockResolvedValueOnce({ sent: true });

      const first = await subscribe({
        email: "stamp-fail@example.com",
        locale: "en",
      });
      expect(first).toEqual({ ok: true, status: "accepted" });
      expect(sendMailMock).toHaveBeenCalledTimes(1);
      expect(row.confirmation_send_lease_until).not.toBeNull();
      expect(row.last_confirmation_sent_at).toBeNull();

      // Immediate retry on same instance must NOT send a duplicate email
      const second = await subscribe({
        email: "stamp-fail@example.com",
        locale: "en",
      });
      expect(second).toEqual({ ok: true, status: "accepted" });
      expect(sendMailMock).toHaveBeenCalledTimes(1);

      // Simulate restart / different replica by clearing in-memory lease cache
      resetNewsletterSendLeases();
      const third = await subscribe({
        email: "stamp-fail@example.com",
        locale: "en",
      });
      expect(third).toEqual({ ok: true, status: "accepted" });
      expect(sendMailMock).toHaveBeenCalledTimes(1);

      // Once lease expires, retry can proceed safely
      vi.setSystemTime(new Date(baseTime.getTime() + SEND_LEASE_MS + 1000));
      updateResultMock.mockImplementation(
        (kind: string, payload: Record<string, unknown>) => {
          if (kind === "select") {
            row.confirmation_send_lease_until =
              (payload.confirmation_send_lease_until as string | null) ?? null;
            return { data: { id: row.id }, error: null };
          }
          if ("last_confirmation_sent_at" in payload) {
            row.last_confirmation_sent_at =
              (payload.last_confirmation_sent_at as string | null) ?? null;
            row.confirmation_send_lease_until = null;
          }
          return { error: null };
        }
      );
      sendMailMock.mockResolvedValueOnce({ sent: true });

      const fourth = await subscribe({
        email: "stamp-fail@example.com",
        locale: "en",
      });
      expect(fourth).toEqual({ ok: true, status: "accepted" });
      expect(sendMailMock).toHaveBeenCalledTimes(2);
      expect(row.last_confirmation_sent_at).not.toBeNull();
      expect(row.confirmation_send_lease_until).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("blocks immediate retry when post-send stamp update throws", async () => {
    const row = {
      id: "id-stamp-throw",
      status: "pending",
      confirm_token: "tok-stamp-throw",
      consented_at: new Date().toISOString(),
      last_confirmation_sent_at: null as string | null,
      confirmation_send_lease_until: null as string | null,
    };

    maybeSingleMock.mockImplementation(async () => ({
      data: { ...row },
      error: null,
    }));
    updateResultMock.mockImplementation(
      (kind: string, payload: Record<string, unknown>) => {
        if (kind === "select") {
          row.confirmation_send_lease_until =
            (payload.confirmation_send_lease_until as string | null) ?? null;
          return { data: { id: row.id }, error: null };
        }
        if ("last_confirmation_sent_at" in payload) {
          return Promise.reject(new Error("connection reset"));
        }
        return { error: null };
      }
    );
    sendMailMock.mockResolvedValueOnce({ sent: true });

    const first = await subscribe({
      email: "stamp-throw@example.com",
      locale: "en",
    });
    expect(first).toEqual({ ok: true, status: "accepted" });
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    resetNewsletterSendLeases();
    const second = await subscribe({
      email: "stamp-throw@example.com",
      locale: "en",
    });
    expect(second).toEqual({ ok: true, status: "accepted" });
    expect(sendMailMock).toHaveBeenCalledTimes(1);
  });

  it("releases DB and local lease immediately when sendMail returns sent:false or throws", async () => {
    const row = {
      id: "id-release",
      status: "pending",
      confirm_token: "tok-release",
      consented_at: new Date().toISOString(),
      last_confirmation_sent_at: null as string | null,
      confirmation_send_lease_until: null as string | null,
    };

    maybeSingleMock.mockImplementation(async () => ({
      data: { ...row },
      error: null,
    }));
    updateResultMock.mockImplementation(
      (kind: string, payload: Record<string, unknown>) => {
        if ("confirmation_send_lease_until" in payload) {
          row.confirmation_send_lease_until =
            (payload.confirmation_send_lease_until as string | null) ?? null;
        }
        if ("last_confirmation_sent_at" in payload) {
          row.last_confirmation_sent_at =
            (payload.last_confirmation_sent_at as string | null) ?? null;
        }
        return kind === "select"
          ? { data: { id: row.id }, error: null }
          : { error: null };
      }
    );

    // 1. sendMail throws -> lease released immediately
    sendMailMock.mockRejectedValueOnce(new Error("socket hang up"));
    const threwOut = await subscribe({
      email: "release@example.com",
      locale: "en",
    });
    expect(threwOut).toEqual({ ok: true, status: "accepted" });
    expect(row.confirmation_send_lease_until).toBeNull();
    expect(row.last_confirmation_sent_at).toBeNull();

    // 2. Immediate retry succeeds
    sendMailMock.mockResolvedValueOnce({ sent: true });
    const okOut = await subscribe({
      email: "release@example.com",
      locale: "en",
    });
    expect(okOut).toEqual({ ok: true, status: "accepted" });
    expect(sendMailMock).toHaveBeenCalledTimes(2);
    expect(row.last_confirmation_sent_at).not.toBeNull();
    expect(row.confirmation_send_lease_until).toBeNull();
  });

  it("enforces DB lease expiry after an ungraceful worker crash and suppresses cross-instance races", async () => {
    vi.useFakeTimers();
    try {
      const baseTime = new Date("2026-11-24T12:00:00.000Z");
      vi.setSystemTime(baseTime);

      const crashedLeaseUntil = new Date(
        baseTime.getTime() + SEND_LEASE_MS
      ).toISOString();
      const row = {
        id: "id-crash",
        status: "pending",
        confirm_token: "tok-crash",
        consented_at: baseTime.toISOString(),
        last_confirmation_sent_at: null as string | null,
        confirmation_send_lease_until: crashedLeaseUntil as string | null,
      };

      maybeSingleMock.mockImplementation(async () => ({
        data: { ...row },
        error: null,
      }));
      updateResultMock.mockImplementation(
        (kind: string, payload: Record<string, unknown>) => {
          if ("confirmation_send_lease_until" in payload) {
            row.confirmation_send_lease_until =
              (payload.confirmation_send_lease_until as string | null) ?? null;
          }
          if ("last_confirmation_sent_at" in payload) {
            row.last_confirmation_sent_at =
              (payload.last_confirmation_sent_at as string | null) ?? null;
          }
          return kind === "select"
            ? { data: { id: row.id }, error: null }
            : { error: null };
        }
      );

      // Before lease expiry -> suppressed without DB writes or email
      const blocked = await subscribe({
        email: "crashed@example.com",
        locale: "en",
      });
      expect(blocked).toEqual({ ok: true, status: "accepted" });
      expect(sendMailMock).not.toHaveBeenCalled();
      expect(updateMock).not.toHaveBeenCalled();

      // Advance past lease expiry -> new lease claimed and email sent
      vi.setSystemTime(new Date(baseTime.getTime() + SEND_LEASE_MS + 1000));
      sendMailMock.mockResolvedValueOnce({ sent: true });
      const recovered = await subscribe({
        email: "crashed@example.com",
        locale: "en",
      });
      expect(recovered).toEqual({ ok: true, status: "accepted" });
      expect(sendMailMock).toHaveBeenCalledTimes(1);
      expect(row.last_confirmation_sent_at).not.toBeNull();

      // Cross-instance atomic CAS failure (0 rows claimed) -> no email sent
      row.last_confirmation_sent_at = null;
      row.confirmation_send_lease_until = null;
      updateResultMock.mockResolvedValueOnce({ data: null, error: null });
      const lostRace = await subscribe({
        email: "crashed@example.com",
        locale: "en",
      });
      expect(lostRace).toEqual({ ok: true, status: "accepted" });
      expect(sendMailMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("subscribe lease expiry bounding & DB fencing", () => {
  const saved = {
    user: process.env.ZOHO_SMTP_USER,
    pass: process.env.ZOHO_SMTP_PASSWORD,
  };

  interface UpdateMeta {
    filters: Array<[string, unknown]>;
    orExpr: string | null;
  }

  function setupFencedRow(initial: {
    id: string;
    email: string;
    confirm_token: string;
  }) {
    const row = {
      id: initial.id,
      email: initial.email,
      status: "pending",
      confirm_token: initial.confirm_token,
      consented_at: new Date().toISOString(),
      last_confirmation_sent_at: null as string | null,
      confirmation_send_lease_until: null as string | null,
    };

    maybeSingleMock.mockImplementation(async () => ({
      data: { ...row },
      error: null,
    }));

    updateResultMock.mockImplementation(
      (kind: string, payload: Record<string, unknown>, meta?: UpdateMeta) => {
        const record = row as unknown as Record<string, unknown>;
        const matchesFilters = (meta?.filters ?? []).every(
          ([col, val]) => record[col] === val
        );
        let matchesOr = true;
        if (meta?.orExpr?.includes("confirmation_send_lease_until")) {
          const cur = row.confirmation_send_lease_until;
          matchesOr = cur === null || Date.parse(cur) <= Date.now();
        }
        if (matchesFilters && matchesOr) {
          Object.assign(row, payload);
          return kind === "select"
            ? { data: { id: row.id }, error: null }
            : { error: null };
        }
        return kind === "select"
          ? { data: null, error: null }
          : { error: null };
      }
    );

    return row;
  }

  async function flushMicrotasks() {
    for (let i = 0; i < 8; i++) {
      await Promise.resolve();
    }
  }

  beforeEach(() => {
    vi.clearAllMocks();
    resetNewsletterSendLeases();
    process.env.ZOHO_SMTP_USER = "digest@herbally.app";
    process.env.ZOHO_SMTP_PASSWORD = "app-password";
  });

  afterEach(() => {
    vi.useRealTimers();
    if (saved.user !== undefined) process.env.ZOHO_SMTP_USER = saved.user;
    else delete process.env.ZOHO_SMTP_USER;
    if (saved.pass !== undefined) process.env.ZOHO_SMTP_PASSWORD = saved.pass;
    else delete process.env.ZOHO_SMTP_PASSWORD;
  });

  it("aborts a hung send strictly below SEND_LEASE_MS and releases lease for successor", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-24T12:00:00.000Z"));
    const row = setupFencedRow({
      id: "id-hung",
      email: "hung@example.com",
      confirm_token: "tok-hung",
    });

    expect(typeof SEND_DEADLINE_MS).toBe("number");
    expect(SEND_DEADLINE_MS).toBeGreaterThan(0);
    expect(SEND_DEADLINE_MS).toBeLessThan(SEND_LEASE_MS);

    let capturedArgs: { signal?: AbortSignal; timeoutMs?: number } | undefined;
    sendMailMock
      .mockImplementationOnce(
        (args: { signal?: AbortSignal; timeoutMs?: number }) => {
          capturedArgs = args;
          return new Promise((resolve) => {
            args.signal?.addEventListener(
              "abort",
              () =>
                resolve({
                  sent: false,
                  reason: "error",
                  detail: "aborted by send deadline",
                }),
              { once: true }
            );
          });
        }
      )
      .mockResolvedValueOnce({ sent: true, id: "msg-recovered" });

    const pA = subscribe({ email: "hung@example.com", locale: "en" });
    await flushMicrotasks();

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(capturedArgs?.signal).toBeInstanceOf(AbortSignal);
    expect(capturedArgs?.timeoutMs).toBe(SEND_DEADLINE_MS);
    expect(capturedArgs?.signal?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(SEND_DEADLINE_MS);
    expect(await pA).toEqual({ ok: true, status: "accepted" });
    expect(capturedArgs?.signal?.aborted).toBe(true);
    expect(row.last_confirmation_sent_at).toBeNull();
    expect(row.confirmation_send_lease_until).toBeNull();

    const pB = await subscribe({ email: "hung@example.com", locale: "en" });
    expect(pB).toEqual({ ok: true, status: "accepted" });
    expect(sendMailMock).toHaveBeenCalledTimes(2);
    expect(row.last_confirmation_sent_at).not.toBeNull();
  });

  it("fences post-send stamping: expired A succeeding after B acquires cannot clear B's lease, stamp B's row, or delete B's local lease", async () => {
    vi.useFakeTimers();
    const baseTime = new Date("2026-11-24T12:00:00.000Z");
    vi.setSystemTime(baseTime);

    const row = setupFencedRow({
      id: "id-fence-stamp",
      email: "fence-stamp@example.com",
      confirm_token: "tok-fence-stamp",
    });

    let resolveA!: (v: { sent: boolean; id?: string }) => void;
    let resolveB!: (v: { sent: boolean; id?: string }) => void;
    sendMailMock
      .mockImplementationOnce(
        () =>
          new Promise((res) => {
            resolveA = res;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((res) => {
            resolveB = res;
          })
      );

    const pA = subscribe({ email: "fence-stamp@example.com", locale: "en" });
    await flushMicrotasks();
    const leaseUntilA = row.confirmation_send_lease_until;
    expect(leaseUntilA).not.toBeNull();

    // Wall clock passes lease expiry -> B acquires a fresh lease
    vi.setSystemTime(new Date(baseTime.getTime() + SEND_LEASE_MS + 1000));
    const pB = subscribe({ email: "fence-stamp@example.com", locale: "en" });
    await flushMicrotasks();
    expect(sendMailMock).toHaveBeenCalledTimes(2);
    const leaseUntilB = row.confirmation_send_lease_until;
    expect(leaseUntilB).not.toBeNull();
    expect(leaseUntilB).not.toBe(leaseUntilA);

    // Expired A resolves late with sent:true -> must NOT stamp row, clear B's lease, or delete B's local lease
    resolveA({ sent: true, id: "msg-expired-a" });
    expect(await pA).toEqual({ ok: true, status: "accepted" });
    expect(row.confirmation_send_lease_until).toBe(leaseUntilB);
    expect(row.last_confirmation_sent_at).toBeNull();

    // Concurrent C while B is still in-flight remains suppressed (local lease still owned by B)
    const pC = await subscribe({
      email: "fence-stamp@example.com",
      locale: "en",
    });
    expect(pC).toEqual({ ok: true, status: "accepted" });
    expect(sendMailMock).toHaveBeenCalledTimes(2);

    // Current owner B finishes -> stamps row and clears its own lease
    resolveB({ sent: true, id: "msg-owner-b" });
    expect(await pB).toEqual({ ok: true, status: "accepted" });
    expect(row.last_confirmation_sent_at).not.toBeNull();
    expect(row.confirmation_send_lease_until).toBeNull();
  });

  it("enforces owner-only lease release on failure: expired A failure cannot clear B's active lease, while B failure releases its own lease", async () => {
    vi.useFakeTimers();
    const baseTime = new Date("2026-11-24T12:00:00.000Z");
    vi.setSystemTime(baseTime);

    const row = setupFencedRow({
      id: "id-fence-rel",
      email: "fence-rel@example.com",
      confirm_token: "tok-fence-rel",
    });

    let resolveA!: (v: { sent: boolean; reason?: string }) => void;
    let resolveB!: (v: { sent: boolean; reason?: string }) => void;
    sendMailMock
      .mockImplementationOnce(
        () =>
          new Promise((res) => {
            resolveA = res;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((res) => {
            resolveB = res;
          })
      )
      .mockResolvedValueOnce({ sent: true, id: "msg-retry-d" });

    const pA = subscribe({ email: "fence-rel@example.com", locale: "en" });
    await flushMicrotasks();
    const leaseUntilA = row.confirmation_send_lease_until;

    vi.setSystemTime(new Date(baseTime.getTime() + SEND_LEASE_MS + 1000));
    const pB = subscribe({ email: "fence-rel@example.com", locale: "en" });
    await flushMicrotasks();
    const leaseUntilB = row.confirmation_send_lease_until;
    expect(leaseUntilB).not.toBe(leaseUntilA);

    // Expired A fails -> must NOT release B's DB or local lease
    resolveA({ sent: false, reason: "error" });
    expect(await pA).toEqual({ ok: true, status: "accepted" });
    expect(row.confirmation_send_lease_until).toBe(leaseUntilB);

    const pC = await subscribe({
      email: "fence-rel@example.com",
      locale: "en",
    });
    expect(pC).toEqual({ ok: true, status: "accepted" });
    expect(sendMailMock).toHaveBeenCalledTimes(2);

    // Current owner B fails -> releases its own DB & local lease so D can immediately retry
    resolveB({ sent: false, reason: "error" });
    expect(await pB).toEqual({ ok: true, status: "accepted" });
    expect(row.confirmation_send_lease_until).toBeNull();

    const pD = await subscribe({
      email: "fence-rel@example.com",
      locale: "en",
    });
    expect(pD).toEqual({ ok: true, status: "accepted" });
    expect(sendMailMock).toHaveBeenCalledTimes(3);
    expect(row.last_confirmation_sent_at).not.toBeNull();
  });
});
