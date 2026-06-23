import { describe, it, expect, vi, beforeEach } from "vitest";
import * as actions from "./chat-persist";

const rpcMock = vi.fn();
const fromMock = vi.fn();
const selectMock = vi.fn();
const eqMock = vi.fn();
const singleMock = vi.fn();

function chain() {
  return {
    rpc: rpcMock,
    from: fromMock,
    select: selectMock,
    eq: eqMock,
    single: singleMock,
  };
}

vi.mock("@/lib/supabase/anonymous", () => ({
  getAnonClient: () => chain(),
}));

// M2: chat-persist now derives the guest id server-side from the cookie via
// getGuestId(). Stub it so the RPC functions receive a deterministic p_guest_id
// without touching next/headers cookies.
vi.mock("@/lib/actions/guest-id", () => ({
  getGuestId: vi.fn().mockResolvedValue("guest-123"),
}));

describe("chat-persist (guest)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpcMock.mockReset();
    fromMock.mockReturnValue(chain());
    selectMock.mockReturnValue(chain());
    eqMock.mockReturnValue(chain());
    singleMock.mockReturnValue(chain());
  });

  describe("createGuestSession", () => {
    it("creates a session successfully", async () => {
      rpcMock.mockResolvedValueOnce({
        data: {
          id: "gs1",
          title: "Guest Chat",
          herb_context: "turmeric",
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        },
        error: null,
      });

      const result = await actions.createGuestSession("turmeric");
      expect(result).not.toBeNull();
      expect(result?.id).toBe("gs1");
      expect(result?.herbContext).toBe("turmeric");
      // guest id is passed to the RPC, derived from the cookie server-side
      expect(rpcMock).toHaveBeenCalledWith("create_guest_chat_session", {
        p_guest_id: "guest-123",
        p_herb_context: "turmeric",
      });
    });

    it("returns null on RPC error", async () => {
      rpcMock.mockResolvedValueOnce({
        data: null,
        error: { message: "db error" },
      });
      const result = await actions.createGuestSession();
      expect(result).toBeNull();
    });
  });

  describe("getGuestSessions", () => {
    it("returns empty array when no sessions", async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: null });
      const result = await actions.getGuestSessions();
      expect(result).toEqual([]);
    });

    it("maps RPC result to PersistedChatSession shape", async () => {
      rpcMock.mockResolvedValueOnce({
        data: [
          {
            id: "gs1",
            title: "Chat 1",
            herb_context: null,
            created_at: "2024-01-01",
            updated_at: "2024-01-02",
          },
        ],
        error: null,
      });
      const result = await actions.getGuestSessions();
      expect(result).toHaveLength(1);
      expect(result[0].herbContext).toBeNull();
    });
  });

  describe("getGuestSession", () => {
    it("returns null when session is not in the guest's own list", async () => {
      // get_guest_chat_sessions returns the guest's sessions; if the requested
      // id isn't among them, ownership check fails -> null (no singular RPC).
      rpcMock.mockResolvedValueOnce({
        data: [
          {
            id: "other",
            title: "Not It",
            herb_context: null,
            created_at: "2024-01-01",
            updated_at: "2024-01-02",
          },
        ],
        error: null,
      });
      const result = await actions.getGuestSession("gs1");
      expect(result).toBeNull();
    });

    it("returns the session with messages when owned by the guest", async () => {
      rpcMock
        .mockResolvedValueOnce({
          data: [
            {
              id: "gs1",
              title: "Chat 1",
              herb_context: "turmeric",
              created_at: "2024-01-01",
              updated_at: "2024-01-02",
            },
          ],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [
            {
              id: "m1",
              role: "user",
              content: "hello",
              created_at: "2024-01-01",
            },
          ],
          error: null,
        });
      const result = await actions.getGuestSession("gs1");
      expect(result).not.toBeNull();
      expect(result?.id).toBe("gs1");
      expect(result?.herbContext).toBe("turmeric");
      expect(result?.messages).toHaveLength(1);
      expect(result?.messages[0].content).toBe("hello");
    });
  });

  describe("addGuestMessage", () => {
    it("returns null on RPC error", async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: { message: "fail" } });
      const result = await actions.addGuestMessage("gs1", "user", "hi");
      expect(result).toBeNull();
    });
  });

  describe("deleteGuestSession", () => {
    it("returns true on success", async () => {
      rpcMock.mockResolvedValueOnce({ data: true, error: null });
      const result = await actions.deleteGuestSession("gs1");
      expect(result).toBe(true);
    });

    it("returns false on error", async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: { message: "fail" } });
      const result = await actions.deleteGuestSession("gs1");
      expect(result).toBe(false);
    });
  });
});
