/**
 * Validate a user-supplied redirect target so it can only be a same-origin
 * in-app path. Use this anywhere a query param or form field (e.g. `next`,
 * `returnTo`) is reflected into a Location header.
 *
 * Defends against the open-redirect pattern where an attacker crafts a
 * link like `/auth/callback?next=/%5Cevil.com` and browsers normalize the
 * backslash to a slash, treating the result as a protocol-relative URL
 * `//evil.com` and navigating to an attacker-controlled origin.
 *
 * Rules (in order):
 *   1. Reject null / undefined / empty.
 *   2. URL-decode the input (malformed encoding → "/").
 *   3. Reject any backslash (raw or decoded) — browsers treat \ as / in
 *      the path component, so a backslash is a path-traversal-equivalent
 *      escape hatch for protocol-relative URLs.
 *   4. Require a single leading "/" and reject "//" / "\\" — the
 *      protocol-relative prefix.
 *   5. Reject any explicit scheme prefix (javascript:, data:, http(s):,
 *      vbscript:, etc.) after optional leading whitespace.
 *   6. Fall back to "/" on any failure.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return "/";

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return "/";
  }

  if (decoded.includes("\\")) return "/";
  if (!decoded.startsWith("/") || decoded.startsWith("//")) return "/";
  // Reject percent-encoded backslashes and slashes too — browsers perform
  // their own URL decoding on the Location path, so a single server-side
  // decode isn't enough. /%5Cevil.com → server returns it unchanged →
  // browser decodes to /\evil.com → normalizes to //evil.com. Same for
  // /%2F%2Fevil.com.
  if (/%(5[cC]|2[fF])/i.test(raw)) return "/";
  // Reject an explicit scheme (javascript:, data:, http(s):, vbscript:, etc.)
  // appearing anywhere in the path. The leading "/" is stripped before the
  // regex so /javascript:alert(1) is caught: after the slash, "javascript:"
  // is a scheme. Legitimate path segments don't contain a colon followed by
  // a non-port character, so this is safe for in-app paths.
  const pathPart = decoded.slice(1);
  if (/^\s*[a-z][a-z0-9+.-]*:/i.test(pathPart)) return "/";

  return decoded;
}
