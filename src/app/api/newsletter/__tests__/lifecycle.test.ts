import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

interface SubscriberRow {
  id: string;
  email: string;
  locale: string;
  source_path: string | null;
  consent_text: string | null;
  consented_at: string;
  status: "pending" | "confirmed" | "unsubscribed";
  subscribed: boolean;
  confirm_token: string;
  unsubscribe_token: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  last_confirmation_sent_at: string | null;
  confirmation_send_lease_until: string | null;
}

const { sendMailMock, rows } = vi.hoisted(() => ({
  sendMailMock: vi.fn(),
  rows: new Map<string, SubscriberRow>(),
}));

vi.mock("@/lib/email/mailer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email/mailer")>();
  return {
    ...actual,
    isMailConfigured: () => true,
    sendMail: (args: unknown) => sendMailMock(args),
  };
});

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: async () => ({ success: true, remaining: 19 }),
  rateLimitKey: (route: string, ip: string) => `${route}:${ip}`,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: (col: string, val: unknown) => ({
          maybeSingle: async () => {
            for (const row of rows.values()) {
              if ((row as unknown as Record<string, unknown>)[col] === val) {
                return { data: { ...row }, error: null };
              }
            }
            return { data: null, error: null };
          },
        }),
      }),
      insert: (payload: Record<string, unknown>) => {
        const id = `row-${rows.size + 1}`;
        const row: SubscriberRow = {
          id,
          email: String(payload.email),
          locale: String(payload.locale ?? "en"),
          source_path: (payload.source_path as string | null) ?? null,
          consent_text: (payload.consent_text as string | null) ?? null,
          consented_at:
            String(payload.consented_at ?? "") || new Date().toISOString(),
          status: (payload.status as SubscriberRow["status"]) ?? "pending",
          subscribed: Boolean(payload.subscribed ?? false),
          confirm_token:
            (payload.confirm_token as string) || crypto.randomUUID(),
          unsubscribe_token:
            (payload.unsubscribe_token as string) || crypto.randomUUID(),
          confirmed_at: null,
          unsubscribed_at: null,
          last_confirmation_sent_at:
            (payload.last_confirmation_sent_at as string | null) ?? null,
          confirmation_send_lease_until:
            (payload.confirmation_send_lease_until as string | null) ?? null,
        };
        rows.set(id, row);
        return {
          select: () => ({
            single: async () => ({ data: { ...row }, error: null }),
          }),
        };
      },
      update: (patch: Record<string, unknown>) => {
        const filters: Array<[string, unknown]> = [];
        let orExpr: string | null = null;
        const applyUpdate = () => {
          const updated: SubscriberRow[] = [];
          for (const row of rows.values()) {
            const record = row as unknown as Record<string, unknown>;
            const matches = filters.every(([k, v]) => record[k] === v);
            let matchesOr = true;
            if (orExpr && orExpr.includes("confirmation_send_lease_until")) {
              const cur = record.confirmation_send_lease_until as string | null;
              matchesOr = cur === null || Date.parse(cur) <= Date.now();
            }
            if (matches && matchesOr) {
              Object.assign(row, patch);
              updated.push({ ...row });
            }
          }
          return updated;
        };
        const builder = {
          eq: (col: string, val: unknown) => {
            filters.push([col, val]);
            return builder;
          },
          is: (col: string, val: null) => {
            filters.push([col, val]);
            return builder;
          },
          or: (expr: string) => {
            orExpr = expr;
            return builder;
          },
          select: () => ({
            maybeSingle: async () => {
              const updated = applyUpdate();
              return { data: updated[0] ?? null, error: null };
            },
          }),
          then: (
            resolve: (v: { error: null }) => unknown,
            reject?: (e: unknown) => unknown
          ) => {
            applyUpdate();
            return Promise.resolve({ error: null }).then(resolve, reject);
          },
        };
        return builder;
      },
    }),
  }),
}));

import {
  invalidateNewsletterSendLease,
  resetNewsletterSendLeases,
  subscribe,
} from "@/lib/newsletter/subscribe";
import { logger } from "@/lib/utils/logger";
import { GET as confirmGet } from "@/app/api/newsletter/confirm/route";
import { GET as unsubscribeGet } from "@/app/api/newsletter/unsubscribe/route";

function makeGet(url: string): NextRequest {
  return {
    nextUrl: new URL(url),
    headers: new Headers(),
  } as unknown as NextRequest;
}

describe("newsletter full lifecycle (subscribe -> confirm -> unsubscribe -> immediate resubscribe -> confirm)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rows.clear();
    resetNewsletterSendLeases();
    sendMailMock.mockResolvedValue({ sent: true });
    process.env.NEXT_PUBLIC_APP_URL = "https://herbally.app";
    process.env.ZOHO_SMTP_USER = "digest@herbally.app";
    process.env.ZOHO_SMTP_PASSWORD = "app-password";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reconciles status and subscribed flag across unsubscribe and immediate resubscribe even while old cooldown is active", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-24T12:00:00.000Z"));

    // 1. Initial subscribe
    const s1 = await subscribe({
      email: "lifecycle@example.com",
      locale: "en",
    });
    expect(s1).toEqual({ ok: true, status: "accepted" });
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    const rowAfterSub = [...rows.values()][0];
    expect(rowAfterSub.status).toBe("pending");
    expect(rowAfterSub.subscribed).toBe(false);
    expect(rowAfterSub.last_confirmation_sent_at).not.toBeNull();
    const firstToken = rowAfterSub.confirm_token;

    // 2. Confirm
    const confirm1 = await confirmGet(
      makeGet(`https://herbally.app/api/newsletter/confirm?token=${firstToken}`)
    );
    expect(confirm1.headers.get("location")).toContain("status=confirmed");
    expect(rowAfterSub.status).toBe("confirmed");
    expect(rowAfterSub.subscribed).toBe(true);

    // 3. Unsubscribe 1 minute later (still inside 15-min cooldown window)
    vi.setSystemTime(new Date("2026-11-24T12:01:00.000Z"));
    const unsub = await unsubscribeGet(
      makeGet(
        `https://herbally.app/api/newsletter/unsubscribe?token=${rowAfterSub.unsubscribe_token}`
      )
    );
    expect(unsub.headers.get("location")).toContain("status=done");
    expect(rowAfterSub.status).toBe("unsubscribed");
    expect(rowAfterSub.subscribed).toBe(false);

    // 4. Immediate resubscribe at +2 minutes (while old cooldown is still active)
    vi.setSystemTime(new Date("2026-11-24T12:02:00.000Z"));
    const s2 = await subscribe({
      email: "lifecycle@example.com",
      locale: "fr",
    });
    expect(s2).toEqual({ ok: true, status: "accepted" });
    // Must flip back to pending and send a fresh confirmation email (not stay unsubscribed!)
    expect(rowAfterSub.status).toBe("pending");
    expect(rowAfterSub.subscribed).toBe(false);
    expect(rowAfterSub.unsubscribed_at).toBeNull();
    expect(rowAfterSub.confirm_token).not.toBe(firstToken);
    expect(sendMailMock).toHaveBeenCalledTimes(2);

    // 5. Confirm again -> both status and legacy subscribed flag become active
    const confirm2 = await confirmGet(
      makeGet(
        `https://herbally.app/api/newsletter/confirm?token=${rowAfterSub.confirm_token}`
      )
    );
    expect(confirm2.headers.get("location")).toContain("status=confirmed");
    expect(rowAfterSub.status).toBe("confirmed");
    expect(rowAfterSub.subscribed).toBe(true);
  });

  it("handles in-flight send -> confirm -> unsubscribe -> immediate resubscribe -> confirm without losing fresh confirmation", async () => {
    const email = "inflight@example.com";
    let resolveP1!: (v: { sent: boolean; id?: string }) => void;
    let resolveP2!: (v: { sent: boolean; id?: string }) => void;
    sendMailMock
      .mockImplementationOnce(
        () =>
          new Promise((res) => {
            resolveP1 = res;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((res) => {
            resolveP2 = res;
          })
      );

    // 1. Start p1 and wait until it is actively inside sendMail
    const p1 = subscribe({ email, locale: "en" });
    await vi.waitFor(() => {
      expect(sendMailMock).toHaveBeenCalledTimes(1);
    });

    const row = [...rows.values()][0];
    const firstToken = row.confirm_token;
    expect(row.status).toBe("pending");
    expect(row.confirmation_send_lease_until).not.toBeNull();

    // 2. Confirm while p1 is still in-flight
    const c1 = await confirmGet(
      makeGet(`https://herbally.app/api/newsletter/confirm?token=${firstToken}`)
    );
    expect(c1.headers.get("location")).toContain("status=confirmed");
    expect(row.status).toBe("confirmed");
    expect(row.subscribed).toBe(true);
    expect(row.confirmation_send_lease_until).toBeNull();

    // 3. Unsubscribe while p1 is still in-flight
    const u1 = await unsubscribeGet(
      makeGet(
        `https://herbally.app/api/newsletter/unsubscribe?token=${row.unsubscribe_token}`
      )
    );
    expect(u1.headers.get("location")).toContain("status=done");
    expect(row.status).toBe("unsubscribed");
    expect(row.subscribed).toBe(false);

    // 4. Immediate resubscribe while p1 is STILL in-flight
    const p2 = subscribe({ email, locale: "fr" });
    await vi.waitFor(() => {
      expect(sendMailMock).toHaveBeenCalledTimes(2);
    });
    expect(row.status).toBe("pending");
    expect(row.subscribed).toBe(false);
    expect(row.unsubscribed_at).toBeNull();
    const secondToken = row.confirm_token;
    expect(secondToken).not.toBe(firstToken);
    const secondLeaseUntil = row.confirmation_send_lease_until;
    expect(secondLeaseUntil).not.toBeNull();

    // 5. Resolve p1 while p2 is still in-flight: must NOT clobber p2's DB state or local lease
    resolveP1({ sent: true, id: "msg-1" });
    expect(await p1).toEqual({ ok: true, status: "accepted" });
    expect(row.confirm_token).toBe(secondToken);
    expect(row.confirmation_send_lease_until).toBe(secondLeaseUntil);
    expect(row.last_confirmation_sent_at).toBeNull();

    // Concurrent duplicate while p2 is still in-flight must still be suppressed (p1 didn't delete p2's local lease)
    const dupWhileP2 = await subscribe({ email, locale: "fr" });
    expect(dupWhileP2).toEqual({ ok: true, status: "accepted" });
    expect(sendMailMock).toHaveBeenCalledTimes(2);

    // 6. Resolve p2 -> stamps last_confirmation_sent_at and clears lease
    resolveP2({ sent: true, id: "msg-2" });
    expect(await p2).toEqual({ ok: true, status: "accepted" });
    expect(row.last_confirmation_sent_at).not.toBeNull();
    expect(row.confirmation_send_lease_until).toBeNull();

    // 7. Confirm secondToken -> active subscription
    const c2 = await confirmGet(
      makeGet(
        `https://herbally.app/api/newsletter/confirm?token=${secondToken}`
      )
    );
    expect(c2.headers.get("location")).toContain("status=confirmed");
    expect(row.status).toBe("confirmed");
    expect(row.subscribed).toBe(true);
  });

  it("does not allow a retained local pending lease (e.g. cross-instance confirm/unsubscribe) to short-circuit unsubscribed -> pending", async () => {
    const email = "cross-replica@example.com";
    let resolveP1!: (v: { sent: boolean; id?: string }) => void;
    sendMailMock
      .mockImplementationOnce(
        () =>
          new Promise((res) => {
            resolveP1 = res;
          })
      )
      .mockResolvedValueOnce({ sent: true, id: "msg-2" });

    const p1 = subscribe({ email, locale: "en" });
    await vi.waitFor(() => {
      expect(sendMailMock).toHaveBeenCalledTimes(1);
    });

    const row = [...rows.values()][0];
    const firstToken = row.confirm_token;

    // Simulate confirm + unsubscribe executed by another instance (no local invalidation on this process)
    row.status = "unsubscribed";
    row.subscribed = false;
    row.confirmation_send_lease_until = null;
    row.unsubscribed_at = new Date().toISOString();

    const p2 = await subscribe({ email, locale: "fr" });
    expect(p2).toEqual({ ok: true, status: "accepted" });
    expect(sendMailMock).toHaveBeenCalledTimes(2);
    expect(row.status).toBe("pending");
    expect(row.confirm_token).not.toBe(firstToken);
    expect(row.last_confirmation_sent_at).not.toBeNull();

    resolveP1({ sent: true, id: "msg-1" });
    expect(await p1).toEqual({ ok: true, status: "accepted" });
    expect(row.status).toBe("pending");
  });

  it("prevents stale confirm/unsubscribe invalidation from deleting a newer lease and never logs email addresses", async () => {
    const email = "stale-inv@example.com";
    const infoSpy = vi.spyOn(logger, "info");
    const warnSpy = vi.spyOn(logger, "warn");
    const errorSpy = vi.spyOn(logger, "error");

    let resolveP1!: (v: { sent: boolean; id?: string }) => void;
    let resolveP2!: (v: { sent: boolean; id?: string }) => void;
    sendMailMock
      .mockImplementationOnce(
        () =>
          new Promise((res) => {
            resolveP1 = res;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((res) => {
            resolveP2 = res;
          })
      );

    const p1 = subscribe({ email, locale: "en" });
    await vi.waitFor(() => {
      expect(sendMailMock).toHaveBeenCalledTimes(1);
    });
    const row = [...rows.values()][0];
    const firstToken = row.confirm_token;

    await confirmGet(
      makeGet(`https://herbally.app/api/newsletter/confirm?token=${firstToken}`)
    );
    await unsubscribeGet(
      makeGet(
        `https://herbally.app/api/newsletter/unsubscribe?token=${row.unsubscribe_token}`
      )
    );

    const p2 = subscribe({ email, locale: "fr" });
    await vi.waitFor(() => {
      expect(sendMailMock).toHaveBeenCalledTimes(2);
    });

    // Delayed invalidation carrying cycle 1's confirmToken must NOT delete cycle 2's active local lease
    expect(
      invalidateNewsletterSendLease({
        email,
        rowId: row.id,
        confirmToken: firstToken,
      })
    ).toBe(false);

    // Cycle 2's local lease must still suppress a concurrent duplicate
    const dup = await subscribe({ email, locale: "fr" });
    expect(dup).toEqual({ ok: true, status: "accepted" });
    expect(sendMailMock).toHaveBeenCalledTimes(2);

    resolveP1({ sent: true, id: "msg-1" });
    resolveP2({ sent: true, id: "msg-2" });
    await Promise.all([p1, p2]);

    for (const spy of [infoSpy, warnSpy, errorSpy]) {
      for (const call of spy.mock.calls) {
        expect(JSON.stringify(call)).not.toContain(email);
      }
    }
  });
});
