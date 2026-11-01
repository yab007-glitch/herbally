import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/utils/logger";
import { siteUrl } from "@/lib/seo/site-url";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One-click unsubscribe, on a GET so it works from a plain link in any mail
 * client — CASL requires the opt-out to be easy, and "reply with a special
 * word" is not easy.
 *
 * The row is kept and marked, not deleted: deleting it would also delete the
 * evidence that consent was withdrawn, which is exactly what an audit asks for.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const done = `${siteUrl()}/newsletter/unsubscribed`;

  if (!UUID_RE.test(token)) {
    return NextResponse.redirect(`${done}?status=invalid`, 302);
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("newsletter_subscribers")
      .update({
        status: "unsubscribed",
        subscribed: false,
        unsubscribed_at: new Date().toISOString(),
      })
      .eq("unsubscribe_token", token);

    if (error) {
      logger.error("newsletter: unsubscribe failed", { error: error.message });
      return NextResponse.redirect(`${done}?status=error`, 302);
    }
    return NextResponse.redirect(`${done}?status=done`, 302);
  } catch (error) {
    logger.error("newsletter: unsubscribe threw", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.redirect(`${done}?status=error`, 302);
  }
}
