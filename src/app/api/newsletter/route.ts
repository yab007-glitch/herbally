import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";
import { logger } from "@/lib/utils/logger";
import { subscribe } from "@/lib/newsletter/subscribe";

const bodySchema = z.object({
  email: z.string().min(3).max(254),
  locale: z.enum(["en", "fr"]).default("en"),
  sourcePath: z.string().max(300).optional(),
});

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  // Generous for a human, hostile to a script: one address per few seconds.
  const limited = await rateLimit(`newsletter:${ip}`, 5, 60_000);
  if (!limited.success) {
    return NextResponse.json({ error: "rate-limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid-email" }, { status: 400 });
  }

  const outcome = await subscribe({
    email: parsed.data.email,
    locale: parsed.data.locale,
    sourcePath: parsed.data.sourcePath ?? null,
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
