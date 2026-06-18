import { describe, it, expect, vi, beforeEach } from "vitest";
import * as actions from "./chat";

const fromMock = vi.fn();
const selectMock = vi.fn();
const eqMock = vi.fn();
const orderMock = vi.fn();
const limitMock = vi.fn();
const insertMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();
const singleMock = vi.fn();

function chain() {
  return {
    select: selectMock,
    eq: eqMock,
    order: orderMock,
    limit: limitMock,
    insert: insertMock,
    update: updateMock,
    delete: deleteMock,
    single: singleMock,
    from: fromMock,
  };
}

const getUserMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));

describe("chat actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockReturnValue(chain());
    selectMock.mockReturnValue(chain());
    eqMock.mockReturnValue(chain());
    orderMock.mockReturnValue(chain());
    limitMock.mockReturnValue(chain());
    insertMock.mockReturnValue(chain());
    updateMock.mockReturnValue(chain());
    deleteMock.mockReturnValue(chain());
    singleMock.mockReturnValue(chain());

    getUserMock.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
  });

  describe("getChatSessions", () => {
    it("returns sessions for authenticated user", async () => {
      const sessions = [
        {
          id: "s1",
          title: "Chat 1",
          messages: [],
          herb_context: null,
          created_at: "2024-01-01",
          updated_at: "2024-01-02",
        },
      ];
      const countResult = { data: sessions, error: null, count: 1 };
      selectMock.mockReturnValueOnce({
        ...chain(),
        eq: () => ({
          ...chain(),
          order: () => ({ ...chain(), limit: () => countResult }),
        }),
      });

      const result = await actions.getChatSessions();
      expect(result.success).toBe(true);
    });

    it("returns error when not authenticated", async () => {
      getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });
      const result = await actions.getChatSessions();
      expect(result.success).toBe(false);
      expect(result.error).toBe("Not authenticated");
    });
  });

  describe("getChatSession", () => {
    it("returns error when not authenticated", async () => {
      getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });
      const result = await actions.getChatSession("s1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Not authenticated");
    });
  });

  describe("createChatSession", () => {
    it("returns error when not authenticated", async () => {
      getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });
      const result = await actions.createChatSession();
      expect(result.success).toBe(false);
      expect(result.error).toBe("Not authenticated");
    });
  });

  describe("updateChatSession", () => {
    it("returns error when not authenticated", async () => {
      getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });
      const result = await actions.updateChatSession("s1", []);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Not authenticated");
    });
  });

  describe("deleteChatSession", () => {
    it("returns error when not authenticated", async () => {
      getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });
      const result = await actions.deleteChatSession("s1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Not authenticated");
    });
  });
});
