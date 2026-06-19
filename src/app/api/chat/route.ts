import { logger } from "@/lib/utils/logger";
import { createHash } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getAnonClient } from "@/lib/supabase/anonymous";
import { getSystemPrompt } from "@/lib/ai/system-prompt";
import { z } from "zod";
import { fetchVerifiedContext } from "@/lib/ai/context-fetcher";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_BODY_SIZE = 50 * 1024;

/**
 * Persist an AI response to the shared cache. Writes go through the
 * service-role client because ai_response_cache RLS allows anon reads only
 * (prevents cache poisoning via the public anon key). Fire-and-forget.
 */
function persistToCache(promptHash: string, response: string) {
  // Don't cache empty or suspiciously short/garbage responses (the free pool
  // occasionally emits things like "User Safety: safe" for trivial inputs).
  if (!response.trim() || response.trim().length < 40) return;
  try {
    createAdminClient()
      .from("ai_response_cache")
      .insert({
        prompt_hash: promptHash,
        response,
        expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString(),
      })
      .then(({ error }) => {
        if (error)
          logger.error("api_chat_cache_failed", { error: error.message });
      });
  } catch {
    // Service key not configured (e.g. CI) -> skip caching.
  }
}

// Fallback chain: capable FREE models (the OpenRouter free tier is now mostly
// restricted to these). gpt-4o-mini remains the recommended primary when the
// account has credits; without credits it 402s and we fall back here.
// Order matters — we try each in turn if the previous 5xx/404s.
const FALLBACK_MODELS = [
  "openrouter/free",
  "meta-llama/llama-3.3-70b-instruct:free",
];

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
      max_tokens: 4096,
      temperature: 0.3, // Lower temperature for more factual responses
    }),
    signal: AbortSignal.timeout(20000),
  });
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const baseUrl = (
    process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1"
  ).trim();
  const primaryModel = (
    process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini"
  ).trim();

  if (!apiKey) {
    logger.error("api_chat_key_missing");
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

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const chatSchema = z.object({
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant", "system"]),
          content: z.string().min(1).max(8000),
        })
      )
      .min(1)
      .max(50),
    herbContext: z.string().max(2000).optional(),
    medications: z.array(z.string().max(200)).max(20).optional(),
    locale: z.enum(["en", "fr"]).optional(),
  });

  const parsed = chatSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Messages array is required" },
      { status: 400 }
    );
  }

  const { messages, herbContext, medications, locale } = parsed.data;
  const msgArray = messages;

  // ── Pre-fetch verified context from our database ──────────────────
  // Extract the latest user message to analyze for herb/medication names
  const lastUserMessage =
    [...msgArray].reverse().find((m) => m.role === "user")?.content ?? "";

  let verifiedContext = null;
  try {
    verifiedContext = await fetchVerifiedContext(
      lastUserMessage,
      herbContext,
      medications
    );
  } catch (err) {
    logger.error("api_chat_context_fetch_failed", { error: err });
  }

  // ── Build system prompt with verified data ────────────────────────
  const systemPrompt = getSystemPrompt(
    herbContext,
    medications,
    locale,
    verifiedContext
  );

  const chatMessages = [
    { role: "system" as const, content: systemPrompt },
    ...msgArray.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  // ── AI Response Caching ──────────────────────────────────────────
  const promptHash = createHash("sha256")
    .update(JSON.stringify(chatMessages))
    .digest("hex");
  const supabase = getAnonClient();
  if (supabase) {
    const { data: cached } = await supabase
      .from("ai_response_cache")
      .select("response")
      .eq("prompt_hash", promptHash)
      .gt("expires_at", new Date().toISOString())
      .single();

    // Skip empty/whitespace-only cached entries (e.g. from a past failed
    // stream) — treat them as a miss and regenerate live.
    if (
      cached &&
      typeof cached.response === "string" &&
      cached.response.trim()
    ) {
      return new NextResponse(cached.response, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    }
  }
  // ── Call OpenRouter with fallback chain ────────────────────────────
  const modelsToTry = [
    primaryModel,
    ...FALLBACK_MODELS.filter((m) => m !== primaryModel),
  ];
  let response: Response | null = null;
  let lastError: { status: number; text: string } | null = null;
  // The model that actually produced the streamed response. We only cache
  // primary-model responses — fallback (free) models can emit low-quality
  // output that we don't want to serve from cache for 7 days.
  let servedModel: string | null = null;

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

    if (response && response.ok) {
      servedModel = model;
      if (model !== primaryModel) {
        logger.warn("api_chat_primary_model_failed", {
          primaryModel,
          fallbackModel: model,
        });
      }
      break;
    }

    if (!response) continue;

    const status = response.status;
    const errorText = await response.text().catch(() => "Unknown error");
    lastError = { status, text: errorText };
    logger.error("api_chat_upstream_error", {
      model,
      status,
      error: errorText.substring(0, 200),
    });
    // 401/429 = API-key level problems (bad key, or account rate-limited).
    // Falling back to another model with the same key won't help -> stop.
    if (status === 401 || status === 429) break;
    // 402 (no credits for this paid model), 403 (access denied), 404/422
    // (model not found / bad request), and any 5xx -> try the next model.
    if (status === 402 || status === 403 || status === 404 || status === 422)
      continue;
    if (status >= 500) continue;
    // Any other 4xx is unexpected -> stop.
    break;
  }

  if (!response || !response.ok) {
    let userMessage = "AI service is temporarily unavailable.";
    const status = lastError?.status ?? 500;
    if (status === 401) {
      userMessage =
        "AI service is not configured. Please set a valid OPENROUTER_API_KEY.";
    } else if (status === 402) {
      userMessage =
        "AI service is temporarily unavailable. Please try again later.";
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

  // ── Stream the response ───────────────────────────────────────────
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

      let fullContent = "";
      function pump() {
        reader
          .read()
          .then(({ done, value }) => {
            if (done) {
              cancelTimeout();
              // Cache only primary-model responses (avoid caching
              // low-quality fallback output for 7 days).
              if (servedModel === primaryModel)
                persistToCache(promptHash, fullContent);
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
                if (servedModel === primaryModel)
                  persistToCache(promptHash, fullContent);
                controller.close();
                return;
              }
              if (!trimmed.startsWith("data: ")) continue;
              try {
                const data = JSON.parse(trimmed.slice(6));
                const content = data.choices?.[0]?.delta?.content;
                if (content) {
                  fullContent += content;
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
            logger.error("api_chat_stream_error", {
              error: error instanceof Error ? error.message : String(error),
            });
            controller.close();
          });
      }

      pump();
    },
  });

  const dataSource = verifiedContext?.source ?? "none";
  const herbsFound = verifiedContext?.herbs.length ?? 0;
  const interactionsFound = verifiedContext?.interactions.length ?? 0;

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-HerbAlly-Data-Source": dataSource,
      "X-HerbAlly-Herbs-Found": String(herbsFound),
      "X-HerbAlly-Interactions-Found": String(interactionsFound),
    },
  });
}
