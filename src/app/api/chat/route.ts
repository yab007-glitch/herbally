import { logger } from "@/lib/utils/logger";
import { createHash } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getSystemPrompt } from "@/lib/ai/system-prompt";
import { z } from "zod";
import { fetchVerifiedContext } from "@/lib/ai/context-fetcher";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  evaluateAssistantContent,
  getSafetyRefusal,
} from "@/lib/chat/safety-guard";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIP } from "@/lib/utils/client-ip";
import { withTimeout } from "@/lib/utils/with-timeout";
import {
  isOllamaCloudConfigured,
  getOllamaCloudModel,
  streamChatCompletion,
} from "@/lib/ai/ollama-cloud-client";

const MAX_BODY_SIZE = 50 * 1024;

// Bound the serverless invocation. Answers are buffered for the safety guard
// before delivery and realistically complete in <15s on Ollama Cloud; 60s
// leaves generous headroom under the platform cap.
export const maxDuration = 60;

/**
 * Run the server-side safety guard over a completed response and return the
 * text that should be delivered/cached, plus the verdict. Blocked responses are
 * replaced with the localized refusal; warned responses get the localized
 * warning appended; clean responses pass through unchanged. This guarantees
 * nothing unsafe is served from the shared cache, even if the model emitted a
 * bad line during streaming.
 *
 * Fail closed: if the guard itself throws (a malformed verdict, an unexpected
 * regex failure), the model text is discarded and the refusal is returned.
 * Delivering unguarded medical text on a guard error is never acceptable.
 */
function applyGuard(
  response: string,
  locale: "en" | "fr"
): { text: string; verdict: "ok" | "warn" | "block"; failed: boolean } {
  try {
    const verdict = evaluateAssistantContent(response, locale);
    if (verdict.verdict === "block") {
      return {
        text: verdict.appended ?? getSafetyRefusal(locale),
        verdict: "block",
        failed: false,
      };
    }
    if (verdict.verdict === "warn") {
      return {
        text: response + (verdict.appended ?? ""),
        verdict: "warn",
        failed: false,
      };
    }
    return { text: response, verdict: "ok", failed: false };
  } catch (err) {
    logger.error("api_chat_guard_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { text: getSafetyRefusal(locale), verdict: "block", failed: true };
  }
}

function guardResponse(response: string, locale: "en" | "fr"): string {
  return applyGuard(response, locale).text;
}

/**
 * Service-role client for the shared response cache, or null when the service
 * key is not configured (e.g. CI/local).
 *
 * The cache is server-only: ai_response_cache has no public RLS policy and its
 * anon/authenticated privileges are revoked, so every read and write must use
 * the service role. An unavailable client is a cache MISS — it must never fail
 * the chat request, which can always regenerate the answer from the model.
 */
function getCacheClient() {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

/**
 * Persist an AI response to the shared cache. Writes go through the
 * service-role client because ai_response_cache has no public write policy
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
  // Don't cache empty or suspiciously short/garbage responses (a past
  // upstream incident emitted classifier fragments like "User Safety: safe").
  if (!response.trim() || response.trim().length < 40) return;
  const guarded = guardResponse(response, locale);
  const supabase = getCacheClient();
  // Service key not configured (e.g. CI) -> skip caching.
  if (!supabase) return;
  try {
    const { error } = await supabase.from("ai_response_cache").insert({
      prompt_hash: promptHash,
      response: guarded,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (error) logger.error("api_chat_cache_failed", { error: error.message });
  } catch {
    // Cache writes are best-effort; the answer was already delivered.
  }
}

// Fallback chain: fast, reasoning-clean Ollama Cloud models. The primary
// model comes from OLLAMA_CLOUD_MODEL (default deepseek-v4.1-flash). These
// fallbacks are tried in order when the primary fails with a retryable
// status. glm-5.3-flash is deliberately NOT in the chain — on this endpoint
// it leaks raw reasoning text into the response content.
const FALLBACK_MODELS = ["gemma4:31b", "glm-5.2"];

// ── Stream completeness ────────────────────────────────────────────────
// The upstream is an OpenAI-compatible SSE stream. Some endings are genuine
// completions; everything else is a truncation that must never be shown or
// cached as a finished medical answer.

/** Per-chunk idle allowance. A long but active answer is never cut off. */
const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 30_000;

/** Override for tests/ops: CHAT_STREAM_IDLE_TIMEOUT_MS. */
function getStreamIdleTimeoutMs(): number {
  const raw = Number(process.env.CHAT_STREAM_IDLE_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_STREAM_IDLE_TIMEOUT_MS;
}

/**
 * finish_reason values that mean the model stopped on its own. Anything else
 * (`length`, `content_filter`, …) means the text we hold is not the whole
 * answer. Values from OpenAI-compatible and a few adjacent providers.
 */
const COMPLETE_FINISH_REASONS = new Set([
  "stop",
  "end_turn",
  "eos",
  "stop_sequence",
]);

type AnswerStatus = "complete" | "incomplete" | "blocked";

interface CollectedAnswer {
  text: string;
  complete: boolean;
  /** Machine-readable ending; logged (never the answer text itself). */
  reason: string;
}

/**
 * Appended to a truncated answer. The client renders plain text, so the label
 * has to travel with the answer: without it a fragment that stops mid-sentence
 * is indistinguishable from a finished reply.
 */
const INCOMPLETE_NOTICE: Record<"en" | "fr", string> = {
  en: "\n\n⚠️ This answer was interrupted before it finished and may be incomplete. Please ask again.",
  fr: "\n\n⚠️ Cette réponse a été interrompue avant la fin et peut être incomplète. Veuillez reposer la question.",
};

/** Shown when the upstream produced nothing usable at all. */
const EMPTY_ANSWER_ERROR: Record<"en" | "fr", string> = {
  en: "The AI response could not be completed. Please try again.",
  fr: "La réponse de l'IA n'a pas pu être terminée. Veuillez réessayer.",
};

/**
 * Read an upstream SSE answer to its end and report whether it actually
 * finished.
 *
 * Completion must come from the stream itself: `data: [DONE]` or a terminal
 * `finish_reason`. A socket that merely closes — an upstream error, a proxy
 * cut, an idle hang — leaves a partial answer, and the old code treated every
 * close as success: it labelled the fragment as a finished answer and wrote it
 * to the shared response cache for 7 days. Nothing here throws; the caller gets
 * the text collected so far plus an honest completeness verdict.
 */
async function collectAnswer(
  upstream: Response,
  idleTimeoutMs: number
): Promise<CollectedAnswer> {
  const body = upstream.body;
  if (!body) return { text: "", complete: false, reason: "no-body" };

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let finishReason: string | null = null;
  let sawSentinel = false;

  const consumeLine = (line: string) => {
    const trimmed = line.trim();
    // Blank separators, `event:` lines, and `: keep-alive` comments.
    if (!trimmed.startsWith("data:")) return;
    const payload = trimmed.slice(5).trim();
    if (!payload) return;
    if (payload === "[DONE]") {
      sawSentinel = true;
      return;
    }
    try {
      const data = JSON.parse(payload) as {
        choices?: Array<{
          delta?: { content?: unknown; finish_reason?: unknown };
          message?: { content?: unknown };
          finish_reason?: unknown;
        }>;
      };
      const choice = data.choices?.[0];
      if (!choice) return;
      const content = choice.delta?.content ?? choice.message?.content;
      if (typeof content === "string" && content) text += content;
      const reason = choice.finish_reason ?? choice.delta?.finish_reason;
      if (typeof reason === "string" && reason) finishReason = reason;
    } catch {
      // Non-JSON payload (provider chatter, keep-alive text): not answer text.
    }
  };

  try {
    for (;;) {
      let timedOut = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const idle = new Promise<"idle">((resolve) => {
        timer = setTimeout(() => {
          // Flag first: cancelling resolves the pending read too, and the race
          // may then settle on `{ done: true }` — which must not be mistaken
          // for a clean end of stream.
          timedOut = true;
          void reader.cancel().catch(() => {});
          resolve("idle");
        }, idleTimeoutMs);
      });

      const result = await Promise.race([reader.read(), idle]);
      if (timer !== null) clearTimeout(timer);

      if (timedOut || result === "idle") {
        return { text, complete: false, reason: "idle-timeout" };
      }
      if (result.done) break;

      buffer += decoder.decode(result.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) consumeLine(line);
      // Some servers keep the socket open after [DONE]; don't wait for close.
      if (sawSentinel) {
        void reader.cancel().catch(() => {});
        break;
      }
    }

    // Flush the decoder and a final line that arrived without a trailing
    // newline (e.g. `data: [DONE]` immediately followed by EOF) — the old
    // parser dropped it and saw a normal close instead of the sentinel.
    buffer += decoder.decode();
    if (buffer.trim()) consumeLine(buffer);
  } catch (err) {
    logger.error("api_chat_stream_error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { text, complete: false, reason: "upstream-error" };
  }

  if (finishReason !== null && !COMPLETE_FINISH_REASONS.has(finishReason)) {
    return {
      text,
      complete: false,
      reason:
        finishReason === "length"
          ? "truncated-max-tokens"
          : `finish-reason:${finishReason}`,
    };
  }
  if (finishReason !== null || sawSentinel) {
    return {
      text,
      complete: true,
      reason: finishReason !== null ? "finish-reason" : "done-sentinel",
    };
  }
  return { text, complete: false, reason: "no-completion-signal" };
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

  if (!isOllamaCloudConfigured()) {
    logger.error("api_chat_key_missing");
    return NextResponse.json(
      { error: "AI service is not configured. Please contact support." },
      { status: 503 }
    );
  }
  const primaryModel = getOllamaCloudModel();

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
    // Bounded: a HUNG database would otherwise leave this await unsettled
    // forever — the catch below never fires for a hang, so the route blocked
    // until Vercel's 60s cap (504) instead of answering without DB grounding.
    verifiedContext = await withTimeout(
      fetchVerifiedContext(lastUserMessage, herbContext, medications, locale),
      "chat_context_fetch"
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
  // Cache-key version. Entries written before answer completeness was verified
  // were keyed without this prefix, so they can never be served again: a
  // partial answer cached by the old code must not come back labelled as a
  // finished one. Those rows simply expire (7 days); the cache re-warms with
  // verified-complete answers only.
  const CACHE_KEY_VERSION = "herbally-chat-cache-v2-complete";
  const promptHash = createHash("sha256")
    .update(CACHE_KEY_VERSION)
    .update(JSON.stringify(chatMessages))
    .digest("hex");
  const supabase = getCacheClient();
  if (supabase) {
    // Service-role read: the cache has no public SELECT policy. The cache is an
    // optimization, so a hung DB must neither fail the request
    // nor stall it: bound the lookup and fall through to live generation on
    // timeout, exactly as a miss would.
    const cached = await withTimeout(
      supabase
        .from("ai_response_cache")
        .select("response")
        .eq("prompt_hash", promptHash)
        .gt("expires_at", new Date().toISOString())
        .single(),
      "chat_cache_lookup"
    )
      .then((result) => result.data)
      .catch((err) => {
        logger.error("api_chat_cache_lookup_failed", {
          error: err instanceof Error ? err.message : String(err),
        });
        return null;
      });

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
      // Only answers proven complete at write time live under this key
      // version, so the answer status is honest for cache hits too.
      return new NextResponse(guardResponse(cached.response, locale ?? "en"), {
        status: 200,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "X-HerbAlly-Answer-Status": "complete",
          "X-HerbAlly-Answer-Reason": "cache",
        },
      });
    }
  }
  // ── Call Ollama Cloud with fallback chain ────────────────────────────
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
      response = await streamChatCompletion({
        model,
        messages: chatMessages,
      });
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

  // ── Collect, verify completeness, then deliver ─────────────────────
  // C3 + H2 (audit 2026-06-22 v2): the answer is BUFFERED server-side and run
  // through the safety guard before a single byte reaches the client, so a
  // dangerous line can never stream to the screen.
  //
  // Buffering also makes this route the only party that can tell whether the
  // upstream actually finished. Previously every ending — error, idle hang,
  // socket close — took the same path: the fragment was guarded, delivered as
  // if it were the whole answer, and (for the primary model) cached for 7
  // days, so a truncated medical answer could be served again as finished.
  // Now completion must be proven by an end-of-stream signal (see
  // collectAnswer); anything else is labelled incomplete in-band, keeps its
  // partial text for context, and is NEVER written to the shared cache. The
  // guard still runs for EVERY model in the fallback chain. Cache stores
  // primary-model output only, and only when proven complete.
  const answerLocale: "en" | "fr" = locale ?? "en";
  const collected = await collectAnswer(response, getStreamIdleTimeoutMs());

  if (!collected.text.trim()) {
    // Fail closed: an empty upstream answer is a failure, not a blank "success"
    // the client would render as a finished reply.
    logger.error("api_chat_empty_answer", {
      reason: collected.reason,
      model: servedModel,
    });
    return NextResponse.json(
      { error: EMPTY_ANSWER_ERROR[answerLocale] },
      { status: 502 }
    );
  }

  if (!collected.complete) {
    // Ops signal: the user gets a labelled partial answer, not an error page,
    // so this warning is the only place a truncated answer is visible to
    // monitoring. Reason is machine-readable; answer text is never logged.
    logger.warn("api_chat_incomplete_answer", {
      reason: collected.reason,
      model: servedModel,
    });
  }

  const guarded = applyGuard(collected.text, answerLocale);
  const answerStatus: AnswerStatus =
    guarded.verdict === "block"
      ? "blocked"
      : collected.complete
        ? "complete"
        : "incomplete";

  // A truncated answer carries its own label in-band: the client renders plain
  // text, and a fragment that stops mid-sentence otherwise reads as finished.
  const delivered =
    answerStatus === "incomplete"
      ? guarded.text + INCOMPLETE_NOTICE[answerLocale]
      : guarded.text;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      try {
        controller.enqueue(encoder.encode(delivered));
      } catch {
        // Client already disconnected; the cache write below is still valid.
      }
      // M-13: keep the invocation alive until the cache insert settles, so a
      // serverless freeze can't drop it. The guarded text is already enqueued,
      // so the client receives it immediately; only the close waits. Bounding
      // the write keeps a hung DB from holding the finished stream open.
      void (async () => {
        // Cache only answers proven complete and produced with a working
        // guard. A guard failure is never cached: storing its refusal for 7
        // days would outlive a transient fault. A genuine block keeps the
        // prior behaviour (the refusal, not the model text, is cached).
        if (
          collected.complete &&
          servedModel === primaryModel &&
          !guarded.failed
        ) {
          await withTimeout(
            persistToCache(promptHash, collected.text, answerLocale),
            "chat_cache_persist"
          ).catch((err) => {
            logger.error("api_chat_cache_persist_timeout", {
              error: err instanceof Error ? err.message : String(err),
            });
          });
        }
        try {
          controller.close();
        } catch {
          // Already closed — safe to ignore.
        }
      })();
    },
  });

  const dataSource = verifiedContext?.source ?? "none";
  const herbsFound = verifiedContext?.herbs.length ?? 0;
  const interactionsFound = verifiedContext?.interactions.length ?? 0;

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      // Truthful because the answer was collected before the response was
      // constructed: "complete" means the upstream proved it finished.
      "X-HerbAlly-Answer-Status": answerStatus,
      "X-HerbAlly-Answer-Reason": collected.reason,
      "X-HerbAlly-Data-Source": dataSource,
      "X-HerbAlly-Herbs-Found": String(herbsFound),
      "X-HerbAlly-Interactions-Found": String(interactionsFound),
    },
  });
}
