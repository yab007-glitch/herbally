import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { migrateGuestData } from "@/lib/actions/guest-migration";
import { safeNextPath } from "@/lib/utils/safe-redirect";
import { siteUrl } from "@/lib/seo/site-url";
import { logger } from "@/lib/utils/logger";

/**
 * Supabase auth callback (PKCE). Email confirmation and password-reset links
 * land here with `?code=...`. We exchange the code for a session, then redirect
 * to a safe in-app path (`next` query param, default `/`).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const configuredOrigin =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.NODE_ENV === "production" ? siteUrl() : "");
  const redirectOrigin = (configuredOrigin || url.origin).replace(/\/+$/, "");
  const code = url.searchParams.get("code");
  // safeNextPath rejects protocol-relative URLs, backslash variants (which
  // browsers normalize to /), percent-encoded backslashes, and explicit
  // scheme prefixes — see src/lib/utils/safe-redirect.ts for the full rules.
  const safeNext = safeNextPath(url.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      logger.warn("auth_callback_exchange_failed", { error: error.message });
      const errRes = NextResponse.redirect(
        `${redirectOrigin}/login?error=${encodeURIComponent("Authentication link is invalid or expired. Please try again.")}`
      );
      errRes.headers.set("Cache-Control", "private, no-store");
      return errRes;
    }

    // FUNC-8: a brand-new signup just established its session. Claim the
    // guest's anonymous garden + chat history into the new account before
    // redirecting. Best-effort — never blocks the redirect. (For password-reset
    // flows the user already exists and has no guest data to claim, so this is
    // a harmless no-op: readGuestId() returns null for a returning user whose
    // cookie was cleared on their first login.)
    await migrateGuestData();
  }

  const res = NextResponse.redirect(`${redirectOrigin}${safeNext}`);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
