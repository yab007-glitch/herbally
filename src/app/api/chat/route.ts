import { NextResponse, type NextRequest } from "next/server";
import { getSystemPrompt } from "@/lib/ai/system-prompt";
import { rateLimit } from "@/lib/rate-limit";

// Max request body size: 50KB (prevents memory exhaustion and excessive token usage)
const MAX_BODY_SIZE = 50 * 1024;

// OpenRouter fallback model chain (tried in order if primary model fails)
const FALLBACK_MODELS = [
  "openrouter/free",
  "google/gemma-3-27b-it:free",
  "meta-llama/llama-3.1-8b-instruct:free",
];

/**
 * Extract the real client IP from request headers.
 * Handles Vercel (x-vercel-forwarded-for), Cloudflare (cf-connecting-ip),
 * and generic proxies (x-forwarded-for).
 */
function getClientIP(request: NextRequest): string {
  // Vercel: trusted forwarded-for
  const vercelIP = request.headers.get("x-vercel-forwarded-for");
  if (vercelIP) return vercelIP.trim();

  // Cloudflare
  const cfIP = request.headers.get("cf-connecting-ip");
  if (cfIP) return cfIP.trim();

  // Generic proxy: rightmost IP in x-forwarded-for
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ips = forwarded.split(",").map((s) => s.trim());
    return ips[ips.length - 1] || "unknown";
  }

  return "unknown";
}

async function tryOpenRouter(
  baseUrl: string,
  apiKey: string,
  model: string,
  chatMessages: Array<{ role: string; content: string }>
): Promise<Response> {
  return fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://herbally.app",
      "X-Title": "HerbAlly",
    },
    body: JSON.stringify({
      model,
      messages: chatMessages,
      stream: true,
      max_tokens: 2048,
      temperature: 0.7,
    }),
  });
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const baseUrl = (
    process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1"
  ).trim();
  const primaryModel = (
    process.env.OPENROUTER_MODEL || "openrouter/free"
  ).trim();

  if (!apiKey) {
    console.error("OpenRouter API key not configured");
    return NextResponse.json(
      { error: "AI service is not configured. Please contact support." },
      { status: 503 }
    );
  }

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

  // Rate limit using platform-aware IP extraction
  const ip = getClientIP(request);
  const { success } = await rateLimit(ip, 20, 60_000);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" },
      }
    );
  }

  let body: {
    messages?: unknown;
    herbContext?: string;
    medications?: string[];
    locale?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { messages, herbContext, medications, locale } = body;
  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json(
      { error: "Messages array is required" },
      { status: 400 }
    );
  }

  const systemPrompt = getSystemPrompt(herbContext, medications, locale);
  const chatMessages = [
    { role: "system" as const, content: systemPrompt },
    ...(messages as Array<{ role: string; content: string }>).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  // Try primary model first, then fallbacks
  const modelsToTry = [
    primaryModel,
    ...FALLBACK_MODELS.filter((m) => m !== primaryModel),
  ];
  let response: Response | null = null;
  let lastError: { status: number; text: string } | null = null;

  for (const model of modelsToTry) {
    try {
      response = await tryOpenRouter(baseUrl, apiKey, model, chatMessages);
    } catch (fetchError) {
      console.error(
        `Fetch to OpenRouter failed for model ${model}:`,
        fetchError
      );
      continue;
    }

    if (response.ok) {
      if (model !== primaryModel) {
      }
      break;
    }

    // Model not available (404/422) — try next fallback
    const status = response.status;
    const errorText = await response.text().catch(() => "Unknown error");
    lastError = { status, text: errorText };
    console.error(
      `OpenRouter API error for model ${model}:`,
      status,
      errorText.substring(0, 200)
    );

    if (status === 401 || status === 429) {
      // Auth or rate limit — don't retry with other models, same key
      break;
    }
    if (status >= 500) {
      // Server error — try next fallback
      continue;
    }
    if (status === 404 || status === 422) {
      // Model not found or invalid — try next fallback
      continue;
    }
    // Other 4xx — don't retry
    break;
  }

  if (!response || !response.ok) {
    let userMessage = "AI service is temporarily unavailable.";
    const status = lastError?.status ?? 500;
    if (status === 401) {
      userMessage =
        "AI service is not configured. Please set a valid OPENROUTER_API_KEY.";
    } else if (status === 429) {
      userMessage = "AI service is busy. Please try again in a moment.";
    } else if (status >= 500) {
      userMessage =
        "AI service is temporarily overloaded. Please try again in a moment.";
    }
    return NextResponse.json(
      { error: userMessage },
      { status: status === 429 ? 429 : 500 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const rawReader = response!.body?.getReader();
      if (!rawReader) {
        controller.close();
        return;
      }
      const reader = rawReader;

      const decoder = new TextDecoder();
      let buffer = "";
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const scheduleTimeout = () => {
        if (timeoutId !== null) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          reader.cancel();
          controller.close();
        }, 30_000);
      };
      const cancelTimeout = () => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      };

      scheduleTimeout();

      function pump() {
        reader
          .read()
          .then(({ done, value }) => {
            if (done) {
              cancelTimeout();
              controller.close();
              return;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              if (trimmed === "data: [DONE]") {
                cancelTimeout();
                controller.close();
                return;
              }
              if (!trimmed.startsWith("data: ")) continue;
              try {
                const data = JSON.parse(trimmed.slice(6));
                const content = data.choices?.[0]?.delta?.content;
                if (content) {
                  controller.enqueue(encoder.encode(content));
                }
              } catch {
                // Skip invalid JSON lines
              }
            }
            pump();
          })
          .catch((error) => {
            cancelTimeout();
            console.error("Stream error:", error);
            controller.close();
          });
      }

      pump();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
