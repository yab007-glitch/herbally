import { logger } from "@/lib/utils/logger";

/**
 * Ollama Cloud Pro API client
 *
 * Uses the OpenAI-compatible /chat/completions endpoint
 * with Bearer auth for Ollama Cloud Pro subscriptions.
 */

const getBaseUrl = () =>
  (process.env.OLLAMA_CLOUD_URL || "https://ollama.com/v1").trim();

const getApiKey = () => process.env.OLLAMA_CLOUD_API_KEY?.trim();

const getModel = () =>
  (process.env.OLLAMA_CLOUD_MODEL || "glm-5").trim();

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
      const timeoutId = setTimeout(() => controller.abort(), 30000);
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
        throw new Error(
          `Ollama Cloud HTTP ${res.status}: ${text}`
        );
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const msg = data.choices?.[0]?.message;
      const content = msg?.content || (msg as any)?.reasoning || "";
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
