import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod/v4";
import { logger } from "@/lib/utils/logger";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";

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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
