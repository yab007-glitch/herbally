import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { rpcMock, fromMock, anonFromMock, rateLimitMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
  anonFromMock: vi.fn(),
  rateLimitMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: rpcMock,
    from: fromMock,
  }),
}));

vi.mock("@/lib/supabase/anonymous", () => ({
  getAnonClient: () => ({
    from: anonFromMock,
  }),
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

import { GET, POST } from "../route";

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("https://herbally.test/api/safety-incidents", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const VALID_PAYLOAD = {
  category: "pediatric_safety",
  severity: "high",
  surfaceUrl: "https://herbally.app/calculator",
  summary: "Minor age check question",
  details: "Detailed non-PHI safety report for review.",
};

describe("POST /api/safety-incidents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitMock.mockResolvedValue({ success: true, remaining: 9 });
  });

  it("calls create_safety_incident_with_audit with the exact 8 SQL parameters (no p_note)", async () => {
    rpcMock.mockResolvedValueOnce({
      data: "11111111-1111-4111-8111-111111111111",
      error: null,
    });

    const res = await POST(makeRequest(VALID_PAYLOAD));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toMatchObject({
      accepted: true,
      id: "11111111-1111-4111-8111-111111111111",
      triageStatus: "open_triage",
    });

    expect(rpcMock).toHaveBeenCalledTimes(1);
    const [fnName, args] = rpcMock.mock.calls[0];
    expect(fnName).toBe("create_safety_incident_with_audit");
    expect(Object.keys(args).sort()).toEqual([
      "p_actor",
      "p_category",
      "p_details",
      "p_severity",
      "p_sla_due_at",
      "p_summary",
      "p_surface_url",
      "p_triage_status",
    ]);
    expect(args).not.toHaveProperty("p_note");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("fails closed with 500 when RPC returns a non-missing error", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: "23514", message: "check constraint failed" },
    });

    const res = await POST(makeRequest(VALID_PAYLOAD));
    expect(res.status).toBe(500);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("falls back when RPC is missing (42883) and runs compensating delete if audit insert fails", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: {
        code: "42883",
        message:
          "function public.create_safety_incident_with_audit does not exist",
      },
    });

    const deleteEqMock = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockImplementation((table: string) => {
      if (table === "safety_incidents") {
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: { id: "inc-fallback-1" },
                error: null,
              }),
            }),
          }),
          delete: () => ({ eq: deleteEqMock }),
        };
      }
      if (table === "safety_incident_audit_log") {
        return {
          insert: async () => ({
            error: { message: "audit log write failed" },
          }),
        };
      }
      return {};
    });

    const res = await POST(makeRequest(VALID_PAYLOAD));
    expect(res.status).toBe(500);
    expect(deleteEqMock).toHaveBeenCalledWith("id", "inc-fallback-1");
  });
});

describe("GET /api/safety-incidents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitMock.mockResolvedValue({ success: true, remaining: 59 });
  });

  it("reads public_corrections_log via anon client (never service_role)", async () => {
    anonFromMock.mockReturnValueOnce({
      select: () => ({
        order: () => ({
          limit: async () => ({
            data: [{ id: "c1", correction_summary: "Updated note" }],
            error: null,
          }),
        }),
      }),
    });

    const res = await GET(
      new NextRequest("https://herbally.test/api/safety-incidents")
    );
    expect(res.status).toBe(200);
    expect(anonFromMock).toHaveBeenCalledWith("public_corrections_log");
    expect(fromMock).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({
      corrections: [{ id: "c1", correction_summary: "Updated note" }],
      available: true,
    });
  });

  it("returns 429 when rate limited", async () => {
    rateLimitMock.mockResolvedValue({ success: false, remaining: 0 });
    const res = await GET(
      new NextRequest("https://herbally.test/api/safety-incidents")
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
