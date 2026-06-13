import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/utils/logger";

export async function GET() {
  const startTime = Date.now();
  const checks: Record<
    string,
    {
      status: string;
      latency?: number;
      error?: string;
    }
  > = {};

  // Check database connection
  try {
    const supabase = await createClient();
    const dbStart = Date.now();
    const { error } = await supabase.from("herbs").select("id").limit(1);
    const dbLatency = Date.now() - dbStart;

    if (error) {
      checks.database = { status: "unhealthy", error: "Database query failed" };
    } else {
      checks.database = { status: "healthy", latency: dbLatency };
    }
  } catch {
    checks.database = {
      status: "unhealthy",
      error: "Database connection failed",
    };
  }

  // Check environment variables (don't leak names publicly)
  const hasRequiredEnv =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !!process.env.OPENROUTER_API_KEY;

  checks.environment = {
    status: hasRequiredEnv ? "healthy" : "degraded",
    error: hasRequiredEnv ? undefined : "One or more required variables are not set",
  };

  // Check OpenRouter API by making a lightweight models request
  try {
    const openrouterKey = process.env.OPENROUTER_API_KEY?.trim();
    const openrouterBaseUrl = (
      process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1"
    ).trim();

    if (!openrouterKey || openrouterKey.startsWith("sk-or-v1-REPLACE")) {
      checks.ai = {
        status: "unconfigured",
        error: "API key not set",
      };
    } else {
      const aiStart = Date.now();
      const aiResponse = await fetch(`${openrouterBaseUrl}/models`, {
        headers: { Authorization: `Bearer ${openrouterKey}` },
        signal: AbortSignal.timeout(5000),
      });
      const aiLatency = Date.now() - aiStart;

      if (aiResponse.ok) {
        checks.ai = { status: "healthy", latency: aiLatency };
      } else {
        checks.ai = {
          status: "unhealthy",
          latency: aiLatency,
          error: `API returned ${aiResponse.status}`,
        };
      }
    }
  } catch {
    checks.ai = {
      status: "unhealthy",
      error: "Connection failed",
    };
  }

  // Check Stripe configuration
  checks.stripe = {
    status: process.env.STRIPE_SECRET_KEY ? "healthy" : "unconfigured",
  };

  // Check rate limiting backend (generic status only)
  const rateLimitBackend = process.env.RATE_LIMIT_BACKEND || "memory";
  const rateLimitConfigured =
    rateLimitBackend === "upstash"
      ? !!(
          process.env.UPSTASH_REDIS_REST_URL &&
          process.env.UPSTASH_REDIS_REST_TOKEN
        )
      : true;

  checks.rateLimit = {
    status: rateLimitConfigured ? "healthy" : "degraded",
    error: rateLimitConfigured ? undefined : "Backend not fully configured",
  };

  // Overall status
  const anyUnhealthy = Object.values(checks).some(
    (c) => c.status === "unhealthy"
  );

  const status = anyUnhealthy ? "unhealthy" : "healthy";
  const totalLatency = Date.now() - startTime;

  if (status === "unhealthy") {
    logger.error("health_check_unhealthy", { checks });
  }

  return NextResponse.json(
    {
      status,
      version: process.env.npm_package_version || "0.1.0",
      timestamp: new Date().toISOString(),
      latency: totalLatency,
      checks,
    },
    { status: status === "unhealthy" ? 503 : 200 }
  );
}
