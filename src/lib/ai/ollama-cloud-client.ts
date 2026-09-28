import { logger } from "@/lib/utils/logger";

/**
 * Ollama Cloud client — the AI backend for the Virtual Herbalist (runtime)
 * and for the offline batch-generation scripts in scripts/.
 *
 * Uses the OpenAI-compatible /chat/completions endpoint with Bearer auth.
 *   Base URL: https://ollama.com/v1  (override: OLLAMA_CLOUD_URL)
 *   Model:    deepseek-v4.1-flash    (override: OLLAMA_CLOUD_MODEL)
 *
 * IMPORTANT: deepseek-v4.1-flash is a reasoning model. Without
 * `reasoning_effort: "none"` it consumes the entire token budget on internal
 * reasoning and returns EMPTY content. Every request this client makes sends
 * reasoning_effort: "none" by default.
 *
 * This client replaced the former OpenRouter client (removed 2026-09-28).
 */

export const OLLAMA_CLOUD_DEFAULT_MODEL = "deepseek-v4.1-flash";
export const OLLAMA_CLOUD_DEFAULT_BASE_URL = "https://ollama.com/v1";

const getBaseUrl = () =>
  (process.env.OLLAMA_CLOUD_URL || OLLAMA_CLOUD_DEFAULT_BASE_URL).trim();

const getApiKey = () => process.env.OLLAMA_CLOUD_API_KEY?.trim();

const getModel = () =>
  (process.env.OLLAMA_CLOUD_MODEL || OLLAMA_CLOUD_DEFAULT_MODEL).trim();

export const getOllamaCloudBaseUrl = getBaseUrl;
export const getOllamaCloudApiKey = getApiKey;
export const getOllamaCloudModel = getModel;

export const OLLAMA_CLOUD_MODEL = getModel();

export const isOllamaCloudConfigured = () => !!getApiKey();

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" | "text" };
  reasoning_effort?: "none" | "low" | "medium" | "high";
  retry?: number;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function chatCompletion(
  options: ChatCompletionOptions
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("OLLAMA_CLOUD_API_KEY is not configured");
  }

  const baseUrl = getBaseUrl();
  const model = getModel();
  const maxRetries = options.retry ?? 3;

  let lastErr: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      const res = await fetch(`${baseUrl}/chat/completions`, {
        signal: controller.signal,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: options.messages,
          temperature: options.temperature ?? 0.3,
          max_tokens: options.max_tokens ?? 2000,
          reasoning_effort: options.reasoning_effort ?? "none",
          ...(options.response_format
            ? { response_format: options.response_format }
            : {}),
        }),
      });

      clearTimeout(timeoutId);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        if (res.status === 429 || res.status >= 500) {
          lastErr = new Error(
            `Ollama Cloud HTTP ${res.status} (attempt ${attempt + 1}/${maxRetries + 1}): ${text}`
          );
          const backoff = Math.min(1000 * 2 ** attempt, 30000);
          await delay(backoff);
          continue;
        }
        throw new Error(`Ollama Cloud HTTP ${res.status}: ${text}`);
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string; reasoning?: string } }>;
      };
      const msg = data.choices?.[0]?.message;
      // reasoning_effort: "none" keeps `content` as the primary field; keep
      // the reasoning fallback for script runs against other models.
      const content = msg?.content || msg?.reasoning || "";
      if (!content) {
        throw new Error("Empty response from Ollama Cloud");
      }
      return content;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        const backoff = Math.min(1000 * 2 ** attempt, 30000);
        await delay(backoff);
      }
    }
  }

  logger.error("ollama_cloud_failed", { error: lastErr?.message });
  throw lastErr ?? new Error("Ollama Cloud request failed after retries");
}

/**
 * Streaming variant for the runtime chat route. Returns the raw fetch
 * Response (SSE stream) so the caller owns fallback-chain and safety-guard
 * logic. Always sends reasoning_effort: "none".
 */
export async function streamChatCompletion(options: {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}): Promise<Response> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("OLLAMA_CLOUD_API_KEY is not configured");
  }
  return fetch(`${getBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      stream: true,
      max_tokens: options.max_tokens ?? 4096,
      temperature: options.temperature ?? 0.3,
      reasoning_effort: "none",
    }),
    // Bound the whole request (headers + body). The route additionally
    // enforces a 30s IDLE timeout while reading the stream (rescheduled on
    // every chunk), so a long but active answer is never truncated.
    signal: AbortSignal.timeout(90_000),
  });
}
