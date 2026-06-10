import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getChatSessions,
  getChatSession,
  createChatSession,
  updateChatSession,
  deleteChatSession,
} from "./chat-local";

const STORAGE_KEY = "herbally-chat-sessions";

describe("chat-local (client-side)", () => {
  beforeEach(() => {
    // Reset localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe("getChatSessions", () => {
    it("returns empty array when no sessions exist", () => {
      const result = getChatSessions();
      expect(result).toEqual([]);
    });

    it("returns sessions from localStorage", () => {
      const sessions = [
        { id: "s1", title: "Chat 1", messages: [], herb_context: null, created_at: "2024-01-01", updated_at: "2024-01-02" },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
      const result = getChatSessions();
      expect(result).toEqual(sessions);
    });
  });

  describe("getChatSession", () => {
    it("returns null when session not found", () => {
      const result = getChatSession("nonexistent");
      expect(result).toBeNull();
    });

    it("returns the matching session", () => {
      const sessions = [
        { id: "s1", title: "Chat 1", messages: [], herb_context: "ginger", created_at: "2024-01-01", updated_at: "2024-01-02" },
        { id: "s2", title: "Chat 2", messages: [], herb_context: null, created_at: "2024-01-03", updated_at: "2024-01-04" },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
      const result = getChatSession("s2");
      expect(result?.title).toBe("Chat 2");
    });
  });

  describe("createChatSession", () => {
    it("creates a new session and stores it", () => {
      const result = createChatSession("turmeric");
      expect(result.title).toBe("New Chat");
      expect(result.herb_context).toBe("turmeric");
      expect(result.messages).toEqual([]);

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe(result.id);
    });

    it("prepends new sessions to existing ones", () => {
      createChatSession();
      createChatSession("ginger");
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      expect(stored).toHaveLength(2);
      expect(stored[0].herb_context).toBe("ginger");
    });
  });

  describe("updateChatSession", () => {
    it("returns null when session does not exist", () => {
      const result = updateChatSession("s1", [{ role: "user", content: "hi", id: "m1", timestamp: "2024-01-01" }]);
      expect(result).toBeNull();
    });

    it("updates messages and auto-generates title", () => {
      const session = createChatSession();
      const messages = [
        { role: "user" as const, content: "Tell me about ginger benefits", id: "m1", timestamp: "2024-01-01" },
        { role: "assistant" as const, content: "Ginger is great!", id: "m2", timestamp: "2024-01-01" },
      ];
      const result = updateChatSession(session.id, messages);
      expect(result?.title).toBe("Tell me about ginger benefits");
      expect(result?.messages).toHaveLength(2);
    });

    it("keeps existing title if not auto-generated", () => {
      const session = createChatSession();
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      stored[0].title = "Custom Title";
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

      const messages = [
        { role: "user" as const, content: "hi", id: "m1", timestamp: "2024-01-01" },
      ];
      const result = updateChatSession(session.id, messages);
      expect(result?.title).toBe("Custom Title");
    });
  });

  describe("deleteChatSession", () => {
    it("returns false when session does not exist", () => {
      const result = deleteChatSession("nonexistent");
      expect(result).toBe(false);
    });

    it("removes the session and returns true", () => {
      const session = createChatSession();
      const result = deleteChatSession(session.id);
      expect(result).toBe(true);
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      expect(stored).toHaveLength(0);
    });
  });
});
