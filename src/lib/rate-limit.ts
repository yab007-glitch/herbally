/**
 * Rate limiting with configurable backend.
 *
 * Backends:
 * - memory: Default, works locally but doesn't scale (per-instance)
 * - upstash: Production-ready, requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 */

import { createHmac } from "crypto";
import { logger } from "@/lib/utils/logger";

type RateLimitResult = { success: boolean; remaining: number };

const DEFAULT_UPSTASH_TIMEOUT_MS = 2500;
const MAX_MEMORY_KEYS = 10_000;

/**
 * Namespaced limiter key.
 */
export function rateLimitKey(route: string, ip: string): string {
  return `${route}:${ip}`;
}

function getRateLimitHashSecret(): string | null {
  const secret = (
    process.env.RATE_LIMIT_HASH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  ).trim();
  return secret.length > 0 ? secret : null;
}

/**
 * Keyed HMAC-SHA256 digest of a rate-limit identifier so literal client IPs
 * are not stored in external Redis keys. Requires a configured server secret.
 */
export function hashRateLimitKey(rawKey: string): string {
  const secret = getRateLimitHashSecret();
  if (!secret) {
    throw new Error("Rate limit hash secret is not configured");
  }
  return createHmac("sha256", secret).update(rawKey).digest("hex").slice(0, 32);
}

// Memory-based rate limiter (default)
interface MemoryEntry {
  timestamps: number[];
  windowMs: number;
}

const requestLog = new Map<string, MemoryEntry>();
const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();
let memoryBackendWarned = false;

function cleanup() {
  const now = Date.now();
  if (now < lastCleanup) {
    lastCleanup = now;
  } else if (now - lastCleanup < CLEANUP_INTERVAL) {
    return;
  } else {
    lastCleanup = now;
  }
  for (const [key, entry] of requestLog) {
    const valid = entry.timestamps.filter((t) => now - t < entry.windowMs);
    if (valid.length === 0) {
      requestLog.delete(key);
    } else {
      requestLog.set(key, { timestamps: valid, windowMs: entry.windowMs });
    }
  }
}

function memoryRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  cleanup();
  const now = Date.now();
  const entry = requestLog.get(key);
  const valid = (entry?.timestamps ?? []).filter((t) => now - t < windowMs);

  if (valid.length >= limit) {
    return { success: false, remaining: 0 };
  }

  if (!requestLog.has(key) && requestLog.size >= MAX_MEMORY_KEYS) {
    const oldestKey = requestLog.keys().next().value;
    if (oldestKey !== undefined) requestLog.delete(oldestKey);
  }

  valid.push(now);
  requestLog.set(key, {
    timestamps: valid,
    windowMs: Math.max(entry?.windowMs ?? 0, windowMs),
  });
  return { success: true, remaining: limit - valid.length };
}

// Atomic sliding-window check-and-record in Lua:
// KEYS[1] = redisKey
// ARGV[1] = now (ms), ARGV[2] = windowStart (ms), ARGV[3] = limit, ARGV[4] = windowMs, ARGV[5] = member
const LUA_SLIDING_WINDOW = [
  "redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[2])",
  "local count = redis.call('ZCARD', KEYS[1])",
  "local limit = tonumber(ARGV[3])",
  "if count >= limit then",
  "  redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[4]))",
  "  return {0, 0}",
  "end",
  "redis.call('ZADD', KEYS[1], tonumber(ARGV[1]), ARGV[5])",
  "redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[4]))",
  "return {1, limit - count - 1}",
].join("\n");

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

  if (!getRateLimitHashSecret()) {
    logger.error("rate_limit_upstash_missing_hash_secret", {
      backend: "upstash",
    });
    return memoryRateLimit(key, limit, windowMs);
  }

  const redisKey = `ratelimit:v1:${hashRateLimitKey(key)}`;
  const now = Date.now();
  const windowStart = now - windowMs;
  const member = `${now}-${Math.random().toString(36).slice(2)}`;
  const rawTimeout = Number(process.env.RATE_LIMIT_UPSTASH_TIMEOUT_MS);
  const timeoutMs =
    Number.isFinite(rawTimeout) && rawTimeout > 0
      ? rawTimeout
      : DEFAULT_UPSTASH_TIMEOUT_MS;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        "EVAL",
        LUA_SLIDING_WINDOW,
        "1",
        redisKey,
        now.toString(),
        windowStart.toString(),
        limit.toString(),
        windowMs.toString(),
        member,
      ]),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      logger.error("rate_limit_upstash_error", {
        status: response.status,
      });
      return memoryRateLimit(key, limit, windowMs);
    }

    const payload = (await response.json()) as {
      result?: [number, number] | number[];
      error?: string;
    };
    if (payload.error || !Array.isArray(payload.result)) {
      logger.error("rate_limit_upstash_lua_error", {
        error: payload.error ?? "unexpected_response",
      });
      return memoryRateLimit(key, limit, windowMs);
    }

    const allowed = Number(payload.result[0]) === 1;
    const remaining = Math.max(0, Number(payload.result[1] ?? 0));
    return { success: allowed, remaining };
  } catch (error) {
    logger.error("rate_limit_upstash_exception", {
      error: error instanceof Error ? error.message : String(error),
    });
    return memoryRateLimit(key, limit, windowMs);
  }
}

/**
 * Rate limit by key (IP, user ID, etc.)
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

  if (
    process.env.NODE_ENV === "production" &&
    backend === "memory" &&
    !memoryBackendWarned
  ) {
    memoryBackendWarned = true;
    logger.warn("rate_limit_memory_in_production", {
      message:
        "Memory rate limiter is active in production. Deployments with multiple instances will not share rate limit state. Set RATE_LIMIT_BACKEND=upstash with UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
    });
  }

  return memoryRateLimit(key, limit, windowMs);
}

export function rateLimitSync(
  ip: string,
  limit: number = 20,
  windowMs: number = 60_000
): RateLimitResult {
  return memoryRateLimit(ip, limit, windowMs);
}
