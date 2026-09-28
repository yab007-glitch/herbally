import { NextResponse, type NextRequest } from "next/server";
import {
  getOllamaCloudApiKey,
  getOllamaCloudBaseUrl,
  getOllamaCloudModel,
} from "@/lib/ai/ollama-cloud-client";
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

  const ip = getClientIP(request);
  const perMinute = await rateLimit(`${ip}:interpret:minute`, 20, 60_000);
  if (!perMinute.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }
  // Daily cap so a single IP cannot burn free-tier AI costs all day
  // (20/min alone allows ~28k/day). Matches /api/chat two-tier pattern.
  const perDay = await rateLimit(`${ip}:interpret:day`, 200, 86_400_000);
  if (!perDay.success) {
    return NextResponse.json(
      { error: "Daily limit reached. Please come back tomorrow." },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  let originalQuery = "";
  try {
    const schema = z.object({ query: z.string().min(2).max(200) });
    const body = await request.json();
    // Chunked-encoding bypass guard: content-length may be missing, so
    // enforce a post-parse size cap before Zod validation.
    if (JSON.stringify(body).length > MAX_BODY_SIZE) {
      return NextResponse.json(
        { error: "Request body too large" },
        { status: 413 }
      );
    }
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

    const apiKey = getOllamaCloudApiKey();
    if (!apiKey) {
      return NextResponse.json({ keywords: [trimmed.toLowerCase()] });
    }

    const response = await fetch(
      `${getOllamaCloudBaseUrl()}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: getOllamaCloudModel(),
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
          max_tokens: 100,
          temperature: 0,
          // deepseek-v4.1-flash is a reasoning model; without this it spends
          // the entire budget on internal reasoning and returns empty content.
          reasoning_effort: "none",
        }),
        // M12 (audit 2026-06-22): bound upstream latency. A hung AI response
        // previously stalled the serverless invocation until the platform
        // default timeout. 8s is generous for a ~15-token completion.
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!response.ok) {
      throw new Error(`Ollama Cloud HTTP ${response.status}`);
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = (data.choices?.[0]?.message?.content ?? "").trim();

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
    // M12: a timeout abort (AbortError/TimeoutError) falls through to the
    // validated-query fallback (not
    // an empty result) so a slow upstream never blanks the search.
    if (["AbortError", "TimeoutError"].includes((error as Error)?.name ?? "")) {
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
