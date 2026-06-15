import OpenAI from "openai";
import { logger } from "@/lib/utils/logger";

// OpenRouter API (OpenAI-compatible)
// Base URL: https://openrouter.ai/api/v1
// Model: openrouter/free (free tier)

const getApiKey = () => process.env.OPENROUTER_API_KEY?.trim();

if (typeof window === "undefined" && process.env.NODE_ENV === "production") {
  const key = getApiKey();
  if (!key) {
    logger.error("openai_key_missing");
  }
}

export const openai = new OpenAI({
  baseURL: (
    process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1"
  ).trim(),
  apiKey: getApiKey() || "sk-dummy-key-for-build",
  defaultHeaders: {
    "HTTP-Referer": (process.env.NEXT_PUBLIC_APP_URL ?? "").trim(),
    "X-Title": "HerbAlly",
  },
  dangerouslyAllowBrowser: false,
});

export const MODEL = (process.env.OPENROUTER_MODEL || "openrouter/free").trim();

export const isOpenAIConfigured = () => !!getApiKey();
