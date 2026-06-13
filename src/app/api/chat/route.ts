import { logger } from "@/lib/utils/logger";
import { createHash } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getAnonClient } from "@/lib/supabase/anonymous";
import { getSystemPrompt } from "@/lib/ai/system-prompt";
import { fetchVerifiedContext } from "@/lib/ai/context-fetcher";

const MAX_BODY_SIZE = 50 * 1024;

const FALLBACK_MODELS = [
  "openrouter/free",
  "google/gemma-3-27b-it:free",
  "meta-llama/llama-3.1-8b-instruct:free",
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
      max_tokens: 2048,
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
    process.env.OPENROUTER_MODEL || "openrouter/free"
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

  const msgArray = messages as Array<{ role: string; content: string }>;

  // ── Pre-fetch verified context from our database ──────────────────
  // Extract the latest user message to analyze for herb/medication names
  const lastUserMessage = [...msgArray].reverse().find(
    (m) => m.role === "user"
  )?.content ?? "";

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

    if (cached) {
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
    logger.error("api_chat_upstream_error", { model, status, error: errorText.substring(0, 200) });
    if (status === 401 || status === 429) break;
    if (status >= 500) continue;
    if (status === 404 || status === 422) continue;
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
              // Persist to cache
              if (supabase && fullContent) {
                supabase
                  .from("ai_response_cache")
                  .insert({ prompt_hash: promptHash, response: fullContent, expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })
                  .then(({ error }) => {
                    if (error) console.error("Failed to cache AI response:", error);
                  });
              }
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
                // Persist to cache
                if (supabase && fullContent) {
                  supabase
                    .from("ai_response_cache")
                    .insert({ prompt_hash: promptHash, response: fullContent })
                    .then(({ error }) => {
                      if (error) console.error("Failed to cache AI response:", error);
                    });
                }
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
            console.error("Stream error:", error);
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
