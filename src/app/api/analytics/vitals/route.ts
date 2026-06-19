import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { logger } from "@/lib/utils/logger";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";
import { getAnonClient } from "@/lib/supabase/anonymous";

// Core Web Vitals endpoint for real user monitoring
// Stores metrics in Supabase for analysis

const webVitalsSchema = z.object({
  name: z.string(),
  value: z.number(),
  rating: z.enum(["good", "needs-improvement", "poor"]),
  delta: z.number(),
  id: z.string(),
  pathname: z.string(),
  effectiveType: z.string().optional(),
  deviceMemory: z.number().optional(),
  timestamp: z.number(),
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

    const parsed = webVitalsSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
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
