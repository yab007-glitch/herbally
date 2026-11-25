import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { logger } from "@/lib/utils/logger";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";
import { createAdminClient } from "@/lib/supabase/admin";
import { readJsonBodyWithLimit } from "@/lib/http/read-json-body";

// Core Web Vitals endpoint for real user monitoring.
//
// Accepts one batched payload per sampled pageview instead of one request per
// metric: the client collects CLS/FCP/INP/LCP/TTFB and sends them together when
// the page is hidden. That is one function invocation and one INSERT statement
// per sampled pageview, down from five of each — a real reduction in load on the
// Free-tier Supabase instance, where write pressure is the binding constraint.

// L3 (audit 2026-06-22): bound every field so a malicious or runaway client
// can't store arbitrary-length strings / non-finite numbers in web_vitals, and
// keep the timestamp within a plausible window (reject future-far / ancient
// epoch values that would corrupt time-bucketed analytics).
const webVitalSchema = z.object({
  name: z.string().min(1).max(64),
  value: z.number().finite(),
  rating: z.enum(["good", "needs-improvement", "poor"]),
  delta: z.number().finite(),
  id: z.string().min(1).max(128),
  pathname: z
    .string()
    .max(200)
    .regex(/^\/[^?#]*$/, "must be a root-relative path without query/hash"),
  effectiveType: z.string().max(32).optional(),
  deviceMemory: z.number().finite().optional(),
  timestamp: z
    .number()
    .finite()
    // Within the last 24h (allow some clock skew) — reject replayed/fabricated
    // timestamps that would corrupt time-bucketed analytics.
    .refine(
      (ts) => ts > Date.now() - 86_400_000 && ts < Date.now() + 300_000,
      "timestamp out of range"
    ),
});

const webVitalsPayloadSchema = z.object({
  // One entry per metric name; the client caps itself at five today. The upper
  // bound keeps a tampered payload from turning one request into a bulk write.
  metrics: z.array(webVitalSchema).min(1).max(10),
});

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function jsonNoStore(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...NO_STORE_HEADERS, ...(init?.headers ?? {}) },
  });
}

export async function POST(request: NextRequest) {
  try {
    const { success } = await rateLimit(
      rateLimitKey("analytics-vitals", getClientIP(request)),
      60,
      60_000
    );
    if (!success) {
      return jsonNoStore(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
    const bodyResult = await readJsonBodyWithLimit(request, 10 * 1024);
    if (!bodyResult.ok) {
      return jsonNoStore(
        { error: "Invalid vitals payload" },
        { status: bodyResult.reason === "too_large" ? 413 : 400 }
      );
    }

    const parsed = webVitalsPayloadSchema.safeParse(bodyResult.data);
    if (!parsed.success) {
      // L3: don't reflect Zod issue details back to the client — they can
      // echo back the malformed payload shape and leak schema internals.
      return jsonNoStore({ error: "Invalid vitals payload" }, { status: 400 });
    }

    // Store in Supabase if configured — uses the server-side service role so
    // direct anonymous PostgREST inserts can remain locked down at RLS/GRANT level.
    // A single insert call for the whole batch: PostgREST sends it as one
    // statement, so the batch costs the database one write, not five.
    const supabase =
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
        ? createAdminClient()
        : null;

    if (supabase) {
      const rows = parsed.data.metrics.map((body) => ({
        metric_name: body.name,
        value: body.value,
        rating: body.rating,
        pathname: body.pathname,
        device_type: body.effectiveType || "unknown",
        device_memory: body.deviceMemory,
        recorded_at: new Date(body.timestamp).toISOString(),
      }));

      const { error } = await supabase.from("web_vitals").insert(rows);

      if (error) {
        logger.error("web_vital_store_failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return jsonNoStore({ success: true });
  } catch (error) {
    logger.error("web_vitals_endpoint_error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonNoStore({ error: "Internal server error" }, { status: 500 });
  }
}
