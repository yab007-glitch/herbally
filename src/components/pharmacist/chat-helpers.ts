import type { ChatMessage } from "@/lib/actions/chat";

export type Message = ChatMessage;

export const SESSION_STORAGE_KEY = "herbally-chat-session-id";
export const SAVE_DEBOUNCE_MS = 1500;

export function makeId() {
  return Math.random().toString(36).slice(2);
}

export function readStoredSessionId(): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeStoredSessionId(id: string | null) {
  try {
    if (typeof window === "undefined") return;
    if (id) window.localStorage.setItem(SESSION_STORAGE_KEY, id);
    else window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Non-fatal: the conversation is still saved server-side; only the reload
    // pointer is lost.
  }
}

/**
 * An emergency answer ends by sending the reader to poison control or the
 * emergency services. Suppress follow-up dosage chips when the last answer
 * looks like one.
 */
export function looksLikeEmergencyAnswer(content: string) {
  return /\b(?:911|811|poison control|centre antipoison|emergency (?:room|number|services|department)|salle d'urgence|services d'urgence|urgence vitale)\b/i.test(
    content
  );
}

export function parseCommand(text: string): {
  command: string | null;
  args: string | null;
  systemContext: string | null;
} {
  const trimmed = text.trim();

  if (/^\/calculator\b/i.test(trimmed)) {
    const rest = trimmed.replace(/^\/calculator\s*/i, "").trim();
    return {
      command: "calculator",
      args: rest || null,
      systemContext: `The user wants to calculate an herbal dosage.${rest ? ` Details: ${rest}` : " Guide them through the dosage calculation by asking about the herb name, patient age, weight, and adult dose."}`,
    };
  }

  if (/^\/compare\s+(.+)/i.test(trimmed)) {
    const args = trimmed.replace(/^\/compare\s+/i, "").trim();
    return {
      command: "compare",
      args,
      systemContext: `The user wants a comparison between herbs: ${args}. Provide a structured comparison.`,
    };
  }

  if (/^\/herb\s+(.+)/i.test(trimmed)) {
    const args = trimmed.replace(/^\/herb\s+/i, "").trim();
    return {
      command: "herb",
      args,
      systemContext: `The user wants a comprehensive overview of: ${args}. Provide: scientific name, active compounds, uses, dosage, contraindications, side effects, and drug interactions.`,
    };
  }

  return { command: null, args: null, systemContext: null };
}

export function generateFollowUpKeys(herbContext?: string | null): string[] {
  const hasHerb = herbContext && herbContext.length > 20;
  const base = [
    "pharmacist.followUpQuestions.sideEffects",
    "pharmacist.followUpQuestions.dosage",
    "pharmacist.followUpQuestions.pregnancy",
  ];
  if (hasHerb) {
    base.push("pharmacist.followUpQuestions.interactions");
    base.push("pharmacist.followUpQuestions.research");
  }
  return base.slice(0, 4);
}
