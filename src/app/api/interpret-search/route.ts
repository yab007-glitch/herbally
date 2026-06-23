import { NextResponse, type NextRequest } from "next/server";
import { openai, MODEL } from "@/lib/ai/openai-client";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";
import { logger } from "@/lib/utils/logger";
import { z } from "zod";

const MAX_BODY_SIZE = 10 * 1024; // 10KB max for search interpretation

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

  const { success } = await rateLimit(getClientIP(request), 20, 60_000);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  let originalQuery = "";
  try {
    const schema = z.object({ query: z.string().min(2).max(200) });
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      // L6 (audit 2026-06-22): don't reflect the unvalidated `body.query` back
      // to the caller — it bypassed the Zod check and could be any type/size.
      // Return an empty keyword set so the client falls back to its own input.
      return NextResponse.json({ keywords: [] });
    }
    originalQuery = parsed.data.query;

    // Max 200 chars to prevent token abuse
    const trimmed = originalQuery.trim().slice(0, 200);
    const words = trimmed.split(/\s+/);
    if (words.length <= 2 && /^[a-zA-Z\s]+$/.test(trimmed)) {
      return NextResponse.json({ keywords: [trimmed.toLowerCase()] });
    }

    const response = await openai.chat.completions.create(
      {
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
      },
      // M12 (audit 2026-06-22): bound upstream latency. A hung OpenRouter
      // response previously stalled the serverless invocation until the
      // platform default timeout. The OpenAI SDK takes the abort signal in
      // the request-options argument (the second param), NOT in the body.
      // 8s is generous for a 50-token completion.
      { signal: AbortSignal.timeout(8000) }
    );

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
    // M12: a timeout abort falls through to the validated-query fallback (not
    // an empty result) so a slow upstream never blanks the search.
    if ((error as Error)?.name === "AbortError") {
      logger.warn("interpret_search_timeout", {
        query: originalQuery.slice(0, 60),
      });
      return NextResponse.json({
        keywords: [originalQuery.trim().slice(0, 200).toLowerCase() || ""],
      });
    }
    logger.error("interpret_search_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({
      keywords: [originalQuery.toLowerCase() || ""],
    });
  }
}
