import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/utils/logger";
import { siteUrl } from "@/lib/seo/site-url";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";
import { invalidateNewsletterSendLease } from "@/lib/newsletter/subscribe";

const confirmQuerySchema = z.object({
  token: z.string().trim().uuid(),
});

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

function noStoreRedirect(url: string) {
  return NextResponse.redirect(url, { status: 302, headers: NO_STORE_HEADERS });
}

/**
 * Double opt-in landing. The token is the consent: only the person holding the
 * mailbox can click it, which is what makes the confirmation meaningful.
 */
export async function GET(request: NextRequest) {
  const { success } = await rateLimit(
    rateLimitKey("newsletter-confirm", getClientIP(request)),
    20,
    60_000
  );
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60", ...NO_STORE_HEADERS } }
    );
  }

  const done = `${siteUrl()}/newsletter/confirmed`;
  const parsed = confirmQuerySchema.safeParse({
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
        status: "confirmed",
        subscribed: true,
        confirmed_at: new Date().toISOString(),
        confirmation_send_lease_until: null,
      })
      .eq("confirm_token", token)
      .eq("status", "pending")
      .select("id, email, confirm_token")
      .maybeSingle();

    if (error) {
      logger.error("newsletter: confirm failed", { error: error.message });
      return noStoreRedirect(`${done}?status=error`);
    }
    if (data && typeof data.email === "string") {
      invalidateNewsletterSendLease({
        email: data.email,
        rowId: data.id,
        confirmToken: data.confirm_token ?? token,
      });
    }
    // No row updated: already confirmed, already unsubscribed, or a stale
    // token. All three are "already settled" from the visitor's point of view.
    return noStoreRedirect(`${done}?status=${data ? "confirmed" : "already"}`);
  } catch (error) {
    logger.error("newsletter: confirm threw", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return noStoreRedirect(`${done}?status=error`);
  }
}
