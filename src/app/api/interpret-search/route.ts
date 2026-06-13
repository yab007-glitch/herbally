import { NextResponse, type NextRequest } from "next/server";
import { openai, MODEL } from "@/lib/ai/openai-client";
import { rateLimit } from "@/lib/rate-limit";import { logger } from "@/lib/utils/logger";


const MAX_BODY_SIZE = 10 * 1024; // 10KB max for search interpretation

/**
 * Extract the real client IP from request headers.
 * Handles Vercel (x-vercel-forwarded-for), Render (rightmost x-forwarded-for),
 * and Cloudflare (cf-connecting-ip).
 */
function getClientIP(request: NextRequest): string {
  const vercelIP = request.headers.get("x-vercel-forwarded-for");
  if (vercelIP) return vercelIP.trim();

  const cfIP = request.headers.get("cf-connecting-ip");
  if (cfIP) return cfIP.trim();

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ips = forwarded.split(",").map((s) => s.trim());
    return ips[ips.length - 1] || "unknown";
  }

  return "unknown";
}

export async function POST(request: NextRequest) {
  // Body size guard
  const contentLength = parseInt(
    request.headers.get("content-length") || "0",
    10
  );
  if (contentLength > MAX_BODY_SIZE) {
    return NextResponse.json(
      { error: "Request body too large" },
      { status: 413 }
    );
  }

  const ip = getClientIP(request);
  const { success } = await rateLimit(ip, 20, 60_000);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  let originalQuery = "";
  try {
    const { query } = await request.json();
    originalQuery = query ?? "";

    if (!query || typeof query !== "string" || query.length < 2) {
      return NextResponse.json({ keywords: [query || ""] });
    }

    // Max 200 chars to prevent token abuse
    const trimmed = query.trim().slice(0, 200);
    const words = trimmed.split(/\s+/);
    if (words.length <= 2 && /^[a-zA-Z\s]+$/.test(trimmed)) {
      return NextResponse.json({ keywords: [trimmed.toLowerCase()] });
    }

    const response = await openai.chat.completions.create({
      model: MODEL,
      stream: false,
      messages: [
        {
          role: "system",
          content: `Extract 1-3 medical search keywords from the user's description. Return ONLY a JSON array of lowercase strings like ["keyword1","keyword2"]. No other text.`,
        },
        {
          role: "user",
          content: `Extract search keywords: "${trimmed}"
Examples:
"my stomach hurts after eating" → ["digestive","bloating","stomach pain"]
"I can't sleep and feel anxious" → ["insomnia","anxiety"]
"joints are swollen" → ["arthritis","inflammation"]`,
        },
      ],
      max_tokens: 50,
      temperature: 0,
    });

    const text = response.choices[0]?.message?.content?.trim() ?? "";

    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return NextResponse.json({
          keywords: parsed
            .slice(0, 3)
            .map((k: string) => String(k).toLowerCase()),
        });
      }
    } catch {
      // If AI response isn't valid JSON, fall through to fallback
    }

    return NextResponse.json({ keywords: [trimmed.toLowerCase()] });
  } catch (error) {
    logger.error("interpret_search_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({
      keywords: [originalQuery.toLowerCase() || ""],
    });
  }
}
