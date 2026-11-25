import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/utils/logger";
import { siteUrl } from "@/lib/seo/site-url";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";
import { invalidateNewsletterSendLease } from "@/lib/newsletter/subscribe";

const unsubscribeQuerySchema = z.object({
  token: z.string().trim().uuid(),
});

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

function noStoreRedirect(url: string) {
  return NextResponse.redirect(url, { status: 302, headers: NO_STORE_HEADERS });
}

/**
 * One-click unsubscribe, on a GET so it works from a plain link in any mail
 * client — CASL requires the opt-out to be easy, and "reply with a special
 * word" is not easy.
 *
 * The row is kept and marked, not deleted: deleting it would also delete the
 * evidence that consent was withdrawn, which is exactly what an audit asks for.
 */
export async function GET(request: NextRequest) {
  const { success } = await rateLimit(
    rateLimitKey("newsletter-unsubscribe", getClientIP(request)),
    20,
    60_000
  );
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60", ...NO_STORE_HEADERS } }
    );
  }

  const done = `${siteUrl()}/newsletter/unsubscribed`;
  const parsed = unsubscribeQuerySchema.safeParse({
    token: request.nextUrl.searchParams.get("token") ?? "",
  });

  if (!parsed.success) {
    return noStoreRedirect(`${done}?status=invalid`);
  }
  const token = parsed.data.token;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("newsletter_subscribers")
      .update({
        status: "unsubscribed",
        subscribed: false,
        unsubscribed_at: new Date().toISOString(),
        confirmation_send_lease_until: null,
      })
      .eq("unsubscribe_token", token)
      .select("id, email, confirm_token")
      .maybeSingle();

    if (error) {
      logger.error("newsletter: unsubscribe failed", { error: error.message });
      return noStoreRedirect(`${done}?status=error`);
    }
    if (data && typeof data.email === "string") {
      invalidateNewsletterSendLease({
        email: data.email,
        rowId: data.id,
        confirmToken: data.confirm_token,
      });
    }
    return noStoreRedirect(`${done}?status=done`);
  } catch (error) {
    logger.error("newsletter: unsubscribe threw", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return noStoreRedirect(`${done}?status=error`);
  }
}
