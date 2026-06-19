/**
 * Pure guest-ID validation helpers. Kept in a non-"use server" module so they
 * can be imported synchronously anywhere (including type-guard positions and
 * the test suite). Next.js 16 requires every export of a "use server" file to
 * be async, so a synchronous type guard cannot live beside the server actions.
 */

// UUID v4 format: 8-4-4-4-12 hex digits (five segments, NOT six).
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate a caller-supplied guest ID against the UUID format before trusting
 * it. Used to harden endpoints that accept a guest id in the request body — a
 * bogus or attacker-crafted value must never be used to scope a query.
 */
export function isValidGuestId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
