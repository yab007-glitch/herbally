import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/utils/logger";
import { siteUrl } from "@/lib/seo/site-url";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Double opt-in landing. The token is the consent: only the person holding the
 * mailbox can click it, which is what makes the confirmation meaningful.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const done = `${siteUrl()}/newsletter/confirmed`;

  if (!UUID_RE.test(token)) {
    return NextResponse.redirect(`${done}?status=invalid`, 302);
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("newsletter_subscribers")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("confirm_token", token)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (error) {
      logger.error("newsletter: confirm failed", { error: error.message });
      return NextResponse.redirect(`${done}?status=error`, 302);
    }
    // No row updated: already confirmed, already unsubscribed, or a stale
    // token. All three are "already settled" from the visitor's point of view.
    return NextResponse.redirect(
      `${done}?status=${data ? "confirmed" : "already"}`,
      302
    );
  } catch (error) {
    logger.error("newsletter: confirm threw", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.redirect(`${done}?status=error`, 302);
  }
}
