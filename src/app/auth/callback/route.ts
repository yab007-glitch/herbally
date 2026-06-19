import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { migrateGuestData } from "@/lib/actions/guest-migration";

/**
 * Supabase auth callback (PKCE). Email confirmation and password-reset links
 * land here with `?code=...`. We exchange the code for a session, then redirect
 * to a safe in-app path (`next` query param, default `/`).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const nextRaw = url.searchParams.get("next") ?? "/";

  // Only allow same-origin absolute-less paths to prevent open redirect.
  const safeNext =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(error.message)}`
      );
    }

    // FUNC-8: a brand-new signup just established its session. Claim the
    // guest's anonymous garden + chat history into the new account before
    // redirecting. Best-effort — never blocks the redirect. (For password-reset
    // flows the user already exists and has no guest data to claim, so this is
    // a harmless no-op: readGuestId() returns null for a returning user whose
    // cookie was cleared on their first login.)
    await migrateGuestData();
  }

  return NextResponse.redirect(`${origin}${safeNext}`);
}
