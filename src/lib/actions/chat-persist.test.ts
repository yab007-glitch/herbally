import { describe, it, expect, vi, beforeEach } from "vitest";
import * as actions from "./chat-persist";

// --- Mocks ---------------------------------------------------------------
const getUserMock = vi.fn();
const getUserFromMock = vi.fn();
const rpcMock = vi.fn();
const adminFromMock = vi.fn();
const migrateGuestDataMock = vi.fn();
const readGuestIdMock = vi.fn();
const getGuestIdMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: () => getUserMock() },
    from: (table: string) => getUserFromMock(table),
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: rpcMock, from: adminFromMock }),
}));

vi.mock("@/lib/actions/guest-id", () => ({
  getGuestId: () => getGuestIdMock(),
  readGuestId: () => readGuestIdMock(),
}));

vi.mock("@/lib/actions/guest-migration", () => ({
  migrateGuestData: () => migrateGuestDataMock(),
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// --- Helpers -------------------------------------------------------------
type DbResult = { data: unknown; error: unknown };

/**
 * Minimal PostgREST builder: chainable, thenable, with `.single()` and
 * `.maybeSingle()` terminating it. Resolves to `result`.
 */
function builder(result: DbResult) {
  const api: Record<string, unknown> = {};
  for (const method of [
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "is",
    "in",
    "order",
    "limit",
  ]) {
    api[method] = vi.fn(() => api);
  }
  api.maybeSingle = vi.fn(async () => result);
  api.single = vi.fn(async () => result);
  api.then = (resolve: (value: DbResult) => unknown) =>
    Promise.resolve(result).then(resolve);
  return api as Record<string, unknown> & {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
  };
}

const ok = (data: unknown): DbResult => ({ data, error: null });
const fail = (message = "db down", code?: string): DbResult => ({
  data: null,
  error: { message, ...(code ? { code } : {}) },
});

let userQueues: Record<string, DbResult[]>;

function mockUserClient() {
  getUserFromMock.mockImplementation((table: string) => {
    const queue = userQueues[table] ?? [];
    return builder(queue.shift() ?? ok(null));
  });
}

function signedIn(userId = "user-1") {
  getUserMock.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
}

function guestSession() {
  getUserMock.mockResolvedValue({
    data: { user: null },
    error: {
      name: "AuthSessionMissingError",
      message: "Auth session missing!",
      status: 400,
    },
  });
}

const sessionRow = {
  id: "s1",
  title: "Synthetic chat",
  herb_context: null,
  created_at: "2026-10-29T10:00:00Z",
  updated_at: "2026-10-29T10:01:00Z",
};

describe("chat-persist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks keeps queued mockResolvedValueOnce values; reset the mocks
    // that take per-test queues so one test's leftovers cannot answer another
    // test's first call.
    getUserMock.mockReset();
    getUserFromMock.mockReset();
    rpcMock.mockReset();
    adminFromMock.mockReset();
    migrateGuestDataMock.mockReset();
    readGuestIdMock.mockReset();
    getGuestIdMock.mockReset();

    userQueues = {};
    mockUserClient();
    guestSession();
    readGuestIdMock.mockResolvedValue("guest-123");
    getGuestIdMock.mockResolvedValue("guest-123");
    migrateGuestDataMock.mockResolvedValue({ status: "migrated" });
    rpcMock.mockResolvedValue(ok(null));
  });

  // ── Guest paths ──────────────────────────────────────────────────────
  describe("guest identity", () => {
    it("creates a guest session through the service-role RPC", async () => {
      rpcMock.mockResolvedValueOnce(ok({ ...sessionRow, id: "gs1" }));

      const result = await actions.createChatSession(null);

      expect(result).toEqual({
        ok: true,
        data: expect.objectContaining({ id: "gs1", messages: [] }),
      });
      expect(rpcMock).toHaveBeenCalledWith("create_guest_chat_session", {
        p_guest_id: "guest-123",
        p_herb_context: undefined,
      });
      expect(getUserFromMock).not.toHaveBeenCalled();
    });

    it("reports a failed create instead of returning null", async () => {
      rpcMock.mockResolvedValueOnce(fail("db down"));

      const result = await actions.createChatSession();

      expect(result).toEqual({ ok: false, code: "unavailable" });
    });

    it("reports a failed message write with the unavailable code", async () => {
      rpcMock.mockResolvedValueOnce(fail("db down"));

      const result = await actions.addChatMessage("gs1", "user", "synthetic");

      expect(result).toEqual({ ok: false, code: "unavailable" });
    });

    it("maps 'session not found' from the RPC to not_found", async () => {
      rpcMock.mockResolvedValueOnce(
        fail("Session not found or not owned by guest")
      );

      const result = await actions.addChatMessage("gs1", "user", "synthetic");

      expect(result).toEqual({ ok: false, code: "not_found" });
    });

    it("does not mint a guest cookie just to read history", async () => {
      readGuestIdMock.mockResolvedValueOnce(null);
      rpcMock.mockResolvedValueOnce(ok([]));

      const result = await actions.getChatSession("gs1");

      expect(result).toEqual({ ok: false, code: "not_found" });
      expect(rpcMock).not.toHaveBeenCalled();
      expect(getGuestIdMock).not.toHaveBeenCalled();
    });

    it("distinguishes a read failure from an empty history", async () => {
      rpcMock.mockResolvedValueOnce(fail("db down"));

      const result = await actions.getChatSession("gs1");

      expect(result).toEqual({ ok: false, code: "unavailable" });
    });

    it("returns the guest's own session with its messages", async () => {
      rpcMock.mockResolvedValueOnce(ok([sessionRow])).mockResolvedValueOnce(
        ok([
          {
            id: "m1",
            role: "user",
            content: "synthetic question",
            created_at: "2026-10-29T10:00:00Z",
          },
        ])
      );

      const result = await actions.getChatSession("s1");

      expect(result).toEqual({
        ok: true,
        data: expect.objectContaining({
          id: "s1",
          messages: [
            {
              id: "m1",
              role: "user",
              content: "synthetic question",
              createdAt: "2026-10-29T10:00:00Z",
            },
          ],
        }),
      });
    });

    it("reports a not-found session when the guest does not own the id", async () => {
      rpcMock.mockResolvedValueOnce(ok([]));

      const result = await actions.getChatSession("someone-elses");

      expect(result).toEqual({ ok: false, code: "not_found" });
    });

    it("treats data:false from the delete RPC as 'nothing to delete', not failure", async () => {
      rpcMock.mockResolvedValueOnce(ok(false));

      const result = await actions.deleteChatSession("gs1");

      expect(result).toEqual({ ok: true, data: { deleted: false } });
    });

    it("reports a failed delete so the UI cannot claim deletion", async () => {
      rpcMock.mockResolvedValueOnce(fail("db down"));

      const result = await actions.deleteChatSession("gs1");

      expect(result).toEqual({ ok: false, code: "unavailable" });
    });
  });

  // ── Account paths ────────────────────────────────────────────────────
  describe("signed-in identity", () => {
    it("creates account-owned sessions and never writes anonymously", async () => {
      signedIn();
      const insertBuilder = builder(ok(sessionRow));
      getUserFromMock.mockImplementationOnce(() => insertBuilder);

      const result = await actions.createChatSession("synthetic context");

      expect(result.ok).toBe(true);
      expect(insertBuilder.insert).toHaveBeenCalledWith({
        user_id: "user-1",
        title: "New Chat",
        herb_context: "synthetic context",
      });
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it("claims a leftover guest cookie before starting a new conversation", async () => {
      signedIn();
      getUserFromMock.mockImplementation(() => builder(ok(sessionRow)));

      await actions.createChatSession();

      expect(migrateGuestDataMock).toHaveBeenCalledTimes(1);
    });

    it("skips migration when there is no guest cookie", async () => {
      signedIn();
      readGuestIdMock.mockResolvedValue(null);
      getUserFromMock.mockImplementation(() => builder(ok(sessionRow)));

      await actions.createChatSession();

      expect(migrateGuestDataMock).not.toHaveBeenCalled();
    });

    it("writes account messages under RLS", async () => {
      signedIn();
      const messageRow = {
        id: "m9",
        role: "assistant",
        content: "synthetic answer",
        created_at: "2026-10-29T10:05:00Z",
      };
      const insertBuilder = builder(ok(messageRow));
      getUserFromMock.mockImplementationOnce(() => insertBuilder);
      getUserFromMock.mockImplementation(() => builder(ok(null))); // title touch

      const result = await actions.addChatMessage(
        "s1",
        "assistant",
        "synthetic answer"
      );

      expect(result).toEqual({
        ok: true,
        data: {
          id: "m9",
          role: "assistant",
          content: "synthetic answer",
          createdAt: "2026-10-29T10:05:00Z",
        },
      });
      expect(insertBuilder.insert).toHaveBeenCalledWith({
        session_id: "s1",
        role: "assistant",
        content: "synthetic answer",
      });
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it("falls back to the guest write when the session is still guest-owned", async () => {
      signedIn();
      getUserFromMock
        .mockImplementationOnce(() =>
          builder(fail("new row violates row-level security policy", "42501"))
        )
        .mockImplementation(() => builder(ok(null)));
      rpcMock.mockResolvedValueOnce(
        ok({
          id: "m10",
          role: "user",
          content: "synthetic question",
          created_at: "2026-10-29T10:06:00Z",
        })
      );

      const result = await actions.addChatMessage(
        "s1",
        "user",
        "synthetic question"
      );

      expect(result.ok).toBe(true);
      expect(rpcMock).toHaveBeenCalledWith("add_guest_chat_message", {
        p_session_id: "s1",
        p_role: "user",
        p_content: "synthetic question",
        p_guest_id: "guest-123",
      });
    });

    it("reports not_found when an RLS rejection has no guest fallback", async () => {
      signedIn();
      readGuestIdMock.mockResolvedValue(null);
      getUserFromMock.mockImplementationOnce(() =>
        builder(fail("new row violates row-level security policy", "42501"))
      );

      const result = await actions.addChatMessage(
        "s1",
        "user",
        "synthetic question"
      );

      expect(result).toEqual({ ok: false, code: "not_found" });
    });

    it("reads an account session and its messages in order", async () => {
      signedIn();
      const sessionBuilder = builder(ok(sessionRow));
      const messagesBuilder = builder(
        ok([
          {
            id: "m1",
            role: "user",
            content: "synthetic question",
            created_at: "2026-10-29T10:00:00Z",
          },
        ])
      );
      getUserFromMock
        .mockImplementationOnce(() => sessionBuilder)
        .mockImplementationOnce(() => messagesBuilder);

      const result = await actions.getChatSession("s1");

      expect(result.ok).toBe(true);
      expect(sessionBuilder.maybeSingle).toHaveBeenCalled();
      expect(messagesBuilder.order).toHaveBeenCalledWith("created_at", {
        ascending: true,
      });
    });

    it("surfaces a read failure instead of pretending the history is empty", async () => {
      signedIn();
      getUserFromMock.mockImplementationOnce(() => builder(fail("db down")));

      const result = await actions.getChatSession("s1");

      expect(result).toEqual({ ok: false, code: "unavailable" });
    });

    it("finds a still-guest-owned conversation after a failed migration and retries the claim", async () => {
      signedIn();
      getUserFromMock.mockImplementationOnce(() => builder(ok(null))); // account miss
      rpcMock
        .mockResolvedValueOnce(ok([sessionRow])) // guest list
        .mockResolvedValueOnce(
          ok([
            {
              id: "m1",
              role: "user",
              content: "synthetic question",
              created_at: "2026-10-29T10:00:00Z",
            },
          ])
        );

      const result = await actions.getChatSession("s1");

      expect(result.ok).toBe(true);
      expect(migrateGuestDataMock).toHaveBeenCalledTimes(1);
    });

    it("returns not_found when neither identity owns the session", async () => {
      signedIn();
      readGuestIdMock.mockResolvedValue(null);
      getUserFromMock.mockImplementationOnce(() => builder(ok(null)));

      const result = await actions.getChatSession("missing");

      expect(result).toEqual({ ok: false, code: "not_found" });
    });

    it("deletes only the caller's session and reports whether a row went away", async () => {
      signedIn();
      const deleteBuilder = builder(ok([{ id: "s1" }]));
      getUserFromMock.mockImplementationOnce(() => deleteBuilder);

      const result = await actions.deleteChatSession("s1");

      expect(result).toEqual({ ok: true, data: { deleted: true } });
      expect(deleteBuilder.delete).toHaveBeenCalled();
      expect(deleteBuilder.eq).toHaveBeenCalledWith("id", "s1");
      // The response cache has no session linkage; a conversation delete must
      // not pretend to (or attempt to) purge prompt-keyed cache rows.
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it("reports a failed delete", async () => {
      signedIn();
      getUserFromMock.mockImplementationOnce(() => builder(fail("db down")));

      const result = await actions.deleteChatSession("s1");

      expect(result).toEqual({ ok: false, code: "unavailable" });
    });

    it("deletes a still-guest-owned session when no account row matched", async () => {
      signedIn();
      getUserFromMock.mockImplementationOnce(() => builder(ok([])));
      rpcMock.mockResolvedValueOnce(ok(true));

      const result = await actions.deleteChatSession("s1");

      expect(result).toEqual({ ok: true, data: { deleted: true } });
      expect(rpcMock).toHaveBeenCalledWith("delete_guest_chat_session", {
        p_session_id: "s1",
        p_guest_id: "guest-123",
      });
    });

    it("does not claim deletion when the guest fallback delete fails", async () => {
      signedIn();
      getUserFromMock.mockImplementationOnce(() => builder(ok([])));
      rpcMock.mockResolvedValueOnce(fail("db down"));

      const result = await actions.deleteChatSession("s1");

      expect(result).toEqual({ ok: false, code: "unavailable" });
    });

    it("claims a pending guest migration before listing conversations", async () => {
      signedIn();
      getUserFromMock.mockImplementation(() => builder(ok([sessionRow])));

      const result = await actions.getChatSessions();

      expect(result.ok).toBe(true);
      expect(migrateGuestDataMock).toHaveBeenCalledTimes(1);
    });
  });

  // ── Identity resolution ──────────────────────────────────────────────
  describe("identity resolution", () => {
    it("refuses to guess when the auth backend errors mid-flight", async () => {
      getUserMock.mockResolvedValue({
        data: { user: null },
        error: {
          name: "AuthRetryableFetchError",
          message: "fetch failed",
          status: 0,
        },
      });

      const result = await actions.getChatSession("s1");

      expect(result).toEqual({ ok: false, code: "unavailable" });
      // It must not fall through to a guest read/write under a possibly
      // different identity.
      expect(rpcMock).not.toHaveBeenCalled();
    });
  });
});
