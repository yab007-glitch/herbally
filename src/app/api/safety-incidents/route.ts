import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";
import { readJsonBodyWithLimit } from "@/lib/http/read-json-body";
import { logger } from "@/lib/utils/logger";
import {
  buildIncidentSubmission,
  incidentSubmissionSchema,
} from "@/lib/governance/incidents";

const MAX_BODY_SIZE = 16 * 1024;
const NO_STORE = { "Cache-Control": "no-store" };

function getAdminSafely() {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

export async function GET() {
  const supabase = getAdminSafely();
  if (!supabase) {
    return NextResponse.json(
      { corrections: [], available: false },
      { headers: NO_STORE }
    );
  }

  try {
    const { data, error } = await supabase
      .from("public_corrections_log" as never)
      .select(
        "id, affected_surface, correction_summary, corrected_at, verified_by"
      )
      .order("corrected_at", { ascending: false })
      .limit(25);

    if (error) {
      return NextResponse.json(
        { corrections: [], available: false },
        { headers: NO_STORE }
      );
    }

    return NextResponse.json(
      { corrections: data ?? [], available: true },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch {
    return NextResponse.json(
      { corrections: [], available: false },
      { headers: NO_STORE }
    );
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const rl = await rateLimit(rateLimitKey("safety-incidents", ip), 10, 60_000);
  if (!rl.success) {
    return NextResponse.json(
      {
        accepted: false,
        error: "Too many submissions. Please try again later.",
      },
      { status: 429, headers: NO_STORE }
    );
  }

  const bodyResult = await readJsonBodyWithLimit(request, MAX_BODY_SIZE);
  if (!bodyResult.ok) {
    return NextResponse.json(
      {
        accepted: false,
        error:
          bodyResult.reason === "too_large"
            ? "Request payload too large"
            : "Invalid JSON payload",
      },
      {
        status: bodyResult.reason === "too_large" ? 413 : 400,
        headers: NO_STORE,
      }
    );
  }

  const parsed = incidentSubmissionSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return NextResponse.json(
      { accepted: false, error: "Invalid safety incident payload" },
      { status: 400, headers: NO_STORE }
    );
  }

  const built = buildIncidentSubmission(parsed.data);
  const supabase = getAdminSafely();
  if (!supabase) {
    return NextResponse.json(
      {
        accepted: false,
        error: "Incident intake storage is temporarily unavailable.",
      },
      { status: 503, headers: NO_STORE }
    );
  }

  try {
    const rpcClient = supabase as unknown as {
      rpc?: (
        fn: string,
        args: Record<string, unknown>
      ) => Promise<{
        data: unknown;
        error: { code?: string; message?: string } | null;
      }>;
    };

    if (typeof rpcClient.rpc === "function") {
      const rpcRes = await rpcClient.rpc("create_safety_incident_with_audit", {
        p_category: built.category,
        p_severity: built.severity,
        p_surface_url: built.surfaceUrl,
        p_summary: built.summary,
        p_details: built.details,
        p_triage_status: built.triageStatus,
        p_sla_due_at: built.slaDueAt,
        p_actor: "public_intake",
      });
      if (!rpcRes.error && rpcRes.data) {
        return NextResponse.json(
          {
            accepted: true,
            id: String(rpcRes.data),
            triageStatus: built.triageStatus,
            slaDueAt: built.slaDueAt,
          },
          { status: 201, headers: NO_STORE }
        );
      }
      const isMissingRpc =
        rpcRes.error?.code === "42883" ||
        rpcRes.error?.code === "PGRST202" ||
        /could not find the function|does not exist/i.test(
          rpcRes.error?.message ?? ""
        );
      if (!isMissingRpc) {
        logger.error("safety_incident_rpc_failed", {
          error: rpcRes.error?.message ?? "unknown rpc error",
        });
        return NextResponse.json(
          { accepted: false, error: "Could not record safety incident" },
          { status: 500, headers: NO_STORE }
        );
      }
    }

    const { data, error } = await supabase
      .from("safety_incidents" as never)
      .insert({
        category: built.category,
        severity: built.severity,
        surface_url: built.surfaceUrl,
        summary: built.summary,
        details: built.details,
        triage_status: built.triageStatus,
        sla_due_at: built.slaDueAt,
      } as never)
      .select("id")
      .single();

    if (error || !data) {
      logger.error("safety_incident_insert_failed", {
        error: error?.message ?? "no row returned",
      });
      return NextResponse.json(
        { accepted: false, error: "Could not record safety incident" },
        { status: 500, headers: NO_STORE }
      );
    }

    const incidentId = (data as { id: string }).id;
    const { error: auditError } = await supabase
      .from("safety_incident_audit_log" as never)
      .insert({
        incident_id: incidentId,
        actor: "public_intake",
        action: "created",
        note: `severity=${built.severity}; triage=${built.triageStatus}`,
      } as never);

    if (auditError) {
      logger.error("safety_incident_audit_insert_failed", {
        incidentId,
        error: auditError.message,
      });
      await supabase
        .from("safety_incidents" as never)
        .delete()
        .eq("id", incidentId);
      return NextResponse.json(
        {
          accepted: false,
          error: "Could not record safety incident audit trail",
        },
        { status: 500, headers: NO_STORE }
      );
    }

    return NextResponse.json(
      {
        accepted: true,
        id: incidentId,
        triageStatus: built.triageStatus,
        slaDueAt: built.slaDueAt,
      },
      { status: 201, headers: NO_STORE }
    );
  } catch (err) {
    logger.error("safety_incident_exception", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { accepted: false, error: "Could not record safety incident" },
      { status: 500, headers: NO_STORE }
    );
  }
}
