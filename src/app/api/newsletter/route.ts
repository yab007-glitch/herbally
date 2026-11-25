import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";
import { logger } from "@/lib/utils/logger";
import { subscribe } from "@/lib/newsletter/subscribe";
import { readJsonBodyWithLimit } from "@/lib/http/read-json-body";

const MAX_BODY_SIZE = 4 * 1024;

const bodySchema = z.object({
  email: z.string().min(3).max(254),
  locale: z.enum(["en", "fr"]).default("en"),
  sourcePath: z.string().max(300).optional(),
  hp: z.string().max(200).optional(),
});

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  // Generous for a human, hostile to a script: one address per few seconds.
  const limited = await rateLimit(rateLimitKey("newsletter", ip), 5, 60_000);
  if (!limited.success) {
    return NextResponse.json({ error: "rate-limited" }, { status: 429 });
  }

  const bodyResult = await readJsonBodyWithLimit(request, MAX_BODY_SIZE);
  if (!bodyResult.ok) {
    return NextResponse.json(
      {
        error:
          bodyResult.reason === "too_large"
            ? "Request body too large"
            : "invalid-json",
      },
      { status: bodyResult.reason === "too_large" ? 413 : 400 }
    );
  }

  const parsed = bodySchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid-email" }, { status: 400 });
  }

  const outcome = await subscribe({
    email: parsed.data.email,
    locale: parsed.data.locale,
    sourcePath: parsed.data.sourcePath ?? null,
    hp: parsed.data.hp ?? null,
  });

  if (!outcome.ok) {
    if (outcome.reason === "invalid-email") {
      return NextResponse.json({ error: "invalid-email" }, { status: 400 });
    }
    if (outcome.reason === "mail-not-configured") {
      // Honest, not decorative: nothing was stored, nothing was sent.
      logger.error("newsletter: subscribe attempted while SMTP unconfigured");
      return NextResponse.json({ error: "not-configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: outcome.status });
}
