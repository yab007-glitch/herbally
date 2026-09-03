import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { logger } from "@/lib/utils/logger";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";
import { getAnonClient } from "@/lib/supabase/anonymous";

// Core Web Vitals endpoint for real user monitoring
// Stores metrics in Supabase for analysis

// L3 (audit 2026-06-22): bound every field so a malicious or runaway client
// can't store arbitrary-length strings / non-finite numbers in web_vitals, and
// keep the timestamp within a plausible window (reject future-far / ancient
// epoch values that would corrupt time-bucketed analytics).
const webVitalsSchema = z.object({
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

export async function POST(request: NextRequest) {
  try {
    const { success } = await rateLimit(getClientIP(request), 60, 60_000);
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
    const raw = await request.json();
    if (JSON.stringify(raw).length > 10 * 1024) {
      return NextResponse.json(
        { error: "Invalid vitals payload" },
        { status: 413 }
      );
    }

    const parsed = webVitalsSchema.safeParse(raw);
    if (!parsed.success) {
      // L3: don't reflect Zod issue details back to the client — they can
      // echo back the malformed payload shape and leak schema internals.
      return NextResponse.json(
        { error: "Invalid vitals payload" },
        { status: 400 }
      );
    }

    const body = parsed.data;

    // Store in Supabase if configured — uses anon key (safe for public endpoint)
    const supabase = getAnonClient();

    if (supabase) {
      const { error } = await supabase.from("web_vitals").insert({
        metric_name: body.name,
        value: body.value,
        rating: body.rating,
        pathname: body.pathname,
        device_type: body.effectiveType || "unknown",
        device_memory: body.deviceMemory,
        recorded_at: new Date(body.timestamp).toISOString(),
      });

      if (error) {
        logger.error("web_vital_store_failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("web_vitals_endpoint_error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
