/**
 * Rate limiting with configurable backend.
 *
 * Backends:
 * - memory: Default, works locally but doesn't scale (per-instance)
 * - upstash: Production-ready, requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 */

import { logger } from "@/lib/utils/logger";

type RateLimitResult = { success: boolean; remaining: number };

// Memory-based rate limiter (default)
const requestLog = new Map<string, number[]>();
const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, timestamps] of requestLog) {
    const valid = timestamps.filter((t) => now - t < windowMs);
    if (valid.length === 0) {
      requestLog.delete(key);
    } else {
      requestLog.set(key, valid);
    }
  }
}

function memoryRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  cleanup(windowMs);
  const now = Date.now();
  const timestamps = requestLog.get(key) ?? [];
  const valid = timestamps.filter((t) => now - t < windowMs);

  if (valid.length >= limit) {
    return { success: false, remaining: 0 };
  }

  valid.push(now);
  requestLog.set(key, valid);
  return { success: true, remaining: limit - valid.length };
}

// Upstash Redis rate limiter
async function upstashRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    logger.warn("rate_limit_upstash_missing_credentials", {
      backend: "upstash",
    });
    return memoryRateLimit(key, limit, windowMs);
  }

  const redisKey = `ratelimit:${key}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  try {
    // Use Upstash REST API
    const response = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["ZREMRANGEBYSCORE", redisKey, "-inf", windowStart.toString()],
        ["ZCARD", redisKey],
        [
          "ZADD",
          redisKey,
          now.toString(),
          `${now}-${Math.random().toString(36).slice(2)}`,
        ],
        ["PEXPIRE", redisKey, windowMs.toString()],
      ]),
    });

    if (!response.ok) {
      logger.error("rate_limit_upstash_error", {
        status: response.status,
      });
      return memoryRateLimit(key, limit, windowMs);
    }

    const results = (await response.json()) as [null, number, null, null][];
    const count = results[1]?.[1] ?? 0;

    if (count >= limit) {
      return { success: false, remaining: 0 };
    }

    return { success: true, remaining: limit - count - 1 };
  } catch (error) {
    logger.error("rate_limit_upstash_exception", {
      error: error instanceof Error ? error.message : String(error),
    });
    return memoryRateLimit(key, limit, windowMs);
  }
}

/**
 * Rate limit by key (IP, user ID, etc.)
 *
 * @param key - Unique identifier (IP address, user ID, etc.)
 * @param limit - Maximum requests per window
 * @param windowMs - Time window in milliseconds
 * @returns { success, remaining }
 */
export async function rateLimit(
  key: string,
  limit: number = 20,
  windowMs: number = 60_000
): Promise<RateLimitResult> {
  const backend = process.env.RATE_LIMIT_BACKEND || "memory";

  if (backend === "upstash") {
    return upstashRateLimit(key, limit, windowMs);
  }

  // In production, warn that memory rate limiting doesn't scale
  if (process.env.NODE_ENV === "production" && backend === "memory") {
    logger.error("rate_limit_memory_in_production", {
      message:
        "Memory rate limiter is active in production. Deployments with multiple instances will not share rate limit state. Set RATE_LIMIT_BACKEND=upstash with UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
    });
  }

  return memoryRateLimit(key, limit, windowMs);
}

// Synchronous version for backwards compatibility (uses memory only)
export function rateLimitSync(
  ip: string,
  limit: number = 20,
  windowMs: number = 60_000
): RateLimitResult {
  return memoryRateLimit(ip, limit, windowMs);
}
