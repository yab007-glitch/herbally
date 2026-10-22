import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/utils/logger";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";

// The health check is consumed by uptime monitors and must never be cached:
// a stale "healthy" body would hide an outage, and a cached 503 would outlive
// the recovery. This is an explicit contract, not an accident of dynamic
// rendering.
export const dynamic = "force-dynamic";

const OLLAMA_PROBE_TTL_MS = 5 * 60_000;

type Check = {
  status: string;
  latency?: number;
  error?: string;
};

/**
 * Cached AI-provider probe.
 *
 * Two properties matter here:
 *
 * 1. The result is reused for five minutes. The uptime monitor hits this
 *    endpoint ~1.4k times/day; without caching, every one of those requests
 *    also made an outbound `ollama.com/v1/models` call, which is both slow and
 *    a wasted external dependency in the hot path of a health check.
 * 2. A failure is reported as `degraded`, never `unhealthy`. The AI feature
 *    being unavailable is not site downtime: pages, the herb database and the
 *    calculator all still work, so the endpoint must keep returning 200. It
 *    used to page on an Ollama outage, which is exactly backwards.
 */
let aiProbeCache: { result: Check; expiresAt: number } | null = null;

async function probeAi(): Promise<Check> {
  if (aiProbeCache && aiProbeCache.expiresAt > Date.now()) {
    return aiProbeCache.result;
  }

  let result: Check;
  try {
    const ollamaKey = process.env.OLLAMA_CLOUD_API_KEY?.trim();
    const ollamaBaseUrl = (
      process.env.OLLAMA_CLOUD_URL || "https://ollama.com/v1"
    ).trim();

    if (!ollamaKey) {
      result = { status: "unconfigured", error: "API key not set" };
    } else {
      const aiStart = Date.now();
      const aiResponse = await fetch(`${ollamaBaseUrl}/models`, {
        headers: { Authorization: `Bearer ${ollamaKey}` },
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      });
      const aiLatency = Date.now() - aiStart;

      if (aiResponse.ok) {
        result = { status: "healthy", latency: aiLatency };
      } else {
        result = {
          status: "degraded",
          latency: aiLatency,
          error: `API returned ${aiResponse.status}`,
        };
      }
    }
  } catch {
    result = { status: "degraded", error: "Connection failed" };
  }

  aiProbeCache = { result, expiresAt: Date.now() + OLLAMA_PROBE_TTL_MS };
  return result;
}

export async function GET(request: NextRequest) {
  // Rate limit health endpoint to prevent abuse
  const { success } = await rateLimit(getClientIP(request), 30, 60_000);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": "60", "Cache-Control": "no-store" },
      }
    );
  }
  const checks: Record<string, Check> = {};

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

  // Core environment variables gate the endpoint: without Supabase the site
  // cannot render DB-backed pages at all. The AI key is reported through
  // `checks.ai` instead — an unconfigured AI feature is not site downtime.
  const hasCoreEnv =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  checks.environment = {
    status: hasCoreEnv ? "healthy" : "unhealthy",
    error: hasCoreEnv ? undefined : "Required variables are not set",
  };

  // Informational only — cached for five minutes, never gates the status code.
  checks.ai = await probeAi();

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

  if (status === "unhealthy") {
    logger.error("health_check_unhealthy", { checks });
  }

  // Public response: expose ONLY aggregate status + version. The detailed
  // `checks` (per-service latency, env presence, AI/Stripe config state) are
  // recon gold for an attacker and must not be exposed publicly. They are
  // logged server-side for operators instead.
  return NextResponse.json(
    {
      status,
      version: process.env.npm_package_version || "0.1.0",
      timestamp: new Date().toISOString(),
    },
    {
      status: status === "unhealthy" ? 503 : 200,
      headers: { "Cache-Control": "no-store, max-age=0" },
    }
  );
}
