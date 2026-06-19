/**
 * Shared chat type definitions.
 *
 * This file previously held server actions for *authenticated* chat session
 * persistence (getChatSessions / createChatSession / updateChatSession /
 * deleteChatSession). They were never wired into the UI — the chat interface
 * uses the guest persistence path in `chat-persist.ts` and the local in-memory
 * helpers in `chat-local.ts` — so they were dead code and have been removed
 * along with their test (chat.test.ts). Only the shared types remain, since
 * chat-interface, chat-local, and chat-persist all import `ChatMessage`.
 *
 * If authenticated server-side chat history is added later, it should live
 * beside the guest path (chat-persist.ts) so both share the same RLS-scoped
 * storage and safety-guard behavior, rather than reintroducing a parallel,
 * untested action surface. (No "use server" directive here because this module
 * exports types only — Next.js 16 requires async function exports in a
 * "use server" file.)
 */

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  id: string;
  timestamp: string;
};

export type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  herb_context: string | null;
  created_at: string;
  updated_at: string;
};
