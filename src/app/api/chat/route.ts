import { logger } from "@/lib/utils/logger";
import { createHash } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getAnonClient } from "@/lib/supabase/anonymous";
import { getSystemPrompt } from "@/lib/ai/system-prompt";
import { z } from "zod";
import { fetchVerifiedContext } from "@/lib/ai/context-fetcher";
import { createAdminClient } from "@/lib/supabase/admin";
import { evaluateAssistantContent } from "@/lib/chat/safety-guard";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";

const MAX_BODY_SIZE = 50 * 1024;

/**
 * Run the server-side safety guard over a completed response and return the
 * text that should be cached. Blocked responses are replaced with the localized
 * refusal; warned responses get the localized warning appended; clean responses
 * pass through unchanged. This guarantees nothing unsafe is served from the
 * shared cache, even if the model emitted a bad line during streaming.
 */
function guardResponse(response: string, locale: "en" | "fr"): string {
  const verdict = evaluateAssistantContent(response, locale);
  if (verdict.verdict === "block") return verdict.appended ?? response;
  if (verdict.verdict === "warn") return response + (verdict.appended ?? "");
  return response;
}

/**
 * Persist an AI response to the shared cache. Writes go through the
 * service-role client because ai_response_cache RLS allows anon reads only
 * (prevents cache poisoning via the public anon key). Returns a promise the
 * stream awaits before closing (M-13) so the serverless invocation isn't
 * frozen/killed before the fire-and-forget DB insert resolves.
 *
 * The response is run through the server-side safety guard BEFORE caching so
 * that blocked content is replaced with a refusal and warned content gets the
 * disclaimer appended — unsafe output must never be served from cache. The
 * live response is guarded separately and sent to the client; passing the RAW
 * `fullContent` here (not the pre-guarded text) means the guard runs exactly
 * once — never double-appending the warn disclaimer.
 */
async function persistToCache(
  promptHash: string,
  response: string,
  locale: "en" | "fr"
): Promise<void> {
  // Don't cache empty or suspiciously short/garbage responses (the free pool
  // occasionally emits things like "User Safety: safe" for trivial inputs).
  if (!response.trim() || response.trim().length < 40) return;
  const guarded = guardResponse(response, locale);
  try {
    const { error } = await createAdminClient()
      .from("ai_response_cache")
      .insert({
        prompt_hash: promptHash,
        response: guarded,
        expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString(),
      });
    if (error) logger.error("api_chat_cache_failed", { error: error.message });
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
  // In-route rate limiting as a defense-in-depth fallback in case the
  // proxy-level rate limiter is bypassed (e.g. misconfigured matcher).
  const ip = getClientIP(request);
  const perMinute = await rateLimit(`${ip}:chat:minute`, 20, 60_000);
  if (!perMinute.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" },
      }
    );
  }
  const perDay = await rateLimit(`${ip}:chat:day`, 200, 86_400_000);
  if (!perDay.success) {
    return NextResponse.json(
      { error: "Daily message limit reached. Please come back tomorrow." },
      {
        status: 429,
        headers: { "Retry-After": "3600", "X-RateLimit-Remaining": "0" },
      }
    );
  }

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

  // Chunked-encoding bypass guard: content-length may be missing, so
  // enforce a post-parse size cap before Zod validation.
  if (JSON.stringify(raw).length > MAX_BODY_SIZE * 10) {
    return NextResponse.json(
      { error: "Request body too large" },
      { status: 413 }
    );
  }

  const chatSchema = z.object({
    messages: z
      .array(
        z.object({
          // "system" is intentionally excluded — clients must not be able to
          // inject or override the system prompt. The server owns it.
          role: z.enum(["user", "assistant"]),
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
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { messages, herbContext, medications, locale } = parsed.data;
  // The Zod schema already rejects role:"system", so messages here are
  // user/assistant only — clients cannot inject or override the system prompt.
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
      medications,
      locale
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
      // Re-guard on read in case this entry predates the server-side guard.
      // The cached body is the fully-assembled assistant text (not SSE
      // chunks), so mirror the live stream's content-type — a mismatch here
      // breaks clients that sniff the header to decide how to decode.
      return new NextResponse(guardResponse(cached.response, locale ?? "en"), {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
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
      logger.error("api_chat_fetch_failed", {
        model,
        error:
          fetchError instanceof Error ? fetchError.message : String(fetchError),
      });
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
      // Don't leak the upstream env-var name to the client.
      userMessage = "AI service is not configured. Please contact support.";
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
  // C3 + H2 (audit 2026-06-22 v2): the response is BUFFERED server-side and run
  // through guardResponse before a single byte reaches the client. Previously
  // chunks were enqueued verbatim, so a dangerous line ("stop taking your
  // insulin") streamed to the user's screen unfiltered and the client-side
  // guard (post-stream, bypassable) was the only defense. Buffering sacrifices
  // token-by-token streaming UX but is the only way to fully prevent unsafe
  // medical output from being displayed. The guard runs for EVERY model in the
  // fallback chain — fallback (free) models are the least aligned and most
  // prompt-injection-vulnerable, so guarding only the primary was an inverted
  // safety priority. Cache still stores primary-model output only (guarded).
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const rawReader = response?.body?.getReader();
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
          finish("timeout");
        }, 30_000);
      };
      const cancelTimeout = () => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      };

      let fullContent = "";
      // M-23: a single finalize guard so the timeout, done, and error paths
      // can't double-close the controller (which throws TypeError). `finalized`
      // is set synchronously so concurrent entries (e.g. timeout firing while
      // the done promise is mid-await) no-op.
      let finalized = false;
      const finish = async (source: string) => {
        if (finalized) return;
        finalized = true;
        cancelTimeout();
        try {
          // Guard the buffered content and send the safe text to the client.
          const guarded = guardResponse(fullContent, locale ?? "en");
          controller.enqueue(encoder.encode(guarded));
          // M-13: await the cache write before closing so the serverless
          // invocation isn't frozen/killed before the DB insert resolves. The
          // guarded text is already enqueued, so the client receives it
          // immediately; only the stream close waits on the cache write.
          if (servedModel === primaryModel)
            await persistToCache(promptHash, fullContent, locale ?? "en");
        } catch (err) {
          logger.error("api_chat_finalize_failed", {
            source,
            error: err instanceof Error ? err.message : String(err),
          });
        } finally {
          try {
            controller.close();
          } catch {
            // Already closed — safe to ignore.
          }
        }
      };

      scheduleTimeout();

      function pump() {
        reader
          .read()
          .then(({ done, value }) => {
            if (done) {
              finish("done");
              return;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              if (trimmed === "data: [DONE]") {
                finish("done");
                return;
              }
              if (!trimmed.startsWith("data: ")) continue;
              try {
                const data = JSON.parse(trimmed.slice(6));
                const content = data.choices?.[0]?.delta?.content;
                if (content) {
                  // Buffer only — do NOT enqueue per-chunk (see C3+H2 above).
                  fullContent += content;
                }
              } catch {
                // Skip invalid JSON lines
              }
            }
            pump();
          })
          .catch((error) => {
            // reader.cancel() from the timeout/done path rejects the pending
            // read — that's not an error, finalization already happened.
            if (finalized) return;
            logger.error("api_chat_stream_error", {
              error: error instanceof Error ? error.message : String(error),
            });
            finish("error");
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
