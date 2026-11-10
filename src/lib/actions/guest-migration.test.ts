import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---------------------------------------------------------------
const readGuestIdMock = vi.fn();
const clearGuestIdMock = vi.fn();
const getUserMock = vi.fn();

const responses: Array<{ data: unknown; error: unknown }> = [];
const calls: Array<{ method: string; args: unknown[] }> = [];

// Chainable, thenable, recording admin-client mock. Every builder method
// returns the same chain, records its arguments, and each await consumes the
// next queued response in call order — enough to assert both the sequence of DB
// operations and the exact filters the migration relies on for ownership.
const chain = {
  from: (...args: unknown[]) => {
    calls.push({ method: "from", args });
    return chain;
  },
  select: (...args: unknown[]) => {
    calls.push({ method: "select", args });
    return chain;
  },
  eq: (...args: unknown[]) => {
    calls.push({ method: "eq", args });
    return chain;
  },
  in: (...args: unknown[]) => {
    calls.push({ method: "in", args });
    return chain;
  },
  is: (...args: unknown[]) => {
    calls.push({ method: "is", args });
    return chain;
  },
  update: (...args: unknown[]) => {
    calls.push({ method: "update", args });
    return chain;
  },
  delete: (...args: unknown[]) => {
    calls.push({ method: "delete", args });
    return chain;
  },
  then: (resolve: (value: unknown) => unknown) =>
    resolve(responses.shift() ?? { data: null, error: null }),
};

vi.mock("@/lib/actions/guest-id", () => ({
  readGuestId: () => readGuestIdMock(),
  clearGuestId: () => clearGuestIdMock(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { getUser: () => getUserMock() } }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => chain,
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { migrateGuestData } from "./guest-migration";

function findCalls(method: string) {
  return calls.filter((call) => call.method === method);
}

describe("migrateGuestData (FUNC-8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    responses.length = 0;
    calls.length = 0;
    readGuestIdMock.mockReset();
    clearGuestIdMock.mockReset();
    getUserMock.mockReset();
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
  });

  it("skips when there is no guest identity", async () => {
    readGuestIdMock.mockResolvedValue(null);

    const result = await migrateGuestData();

    expect(result).toEqual({ status: "skipped", reason: "no_guest" });
    expect(getUserMock).not.toHaveBeenCalled();
    expect(clearGuestIdMock).not.toHaveBeenCalled();
  });

  it("skips when the visitor is not signed in", async () => {
    readGuestIdMock.mockResolvedValue("guest-123");
    getUserMock.mockResolvedValue({ data: { user: null } });

    const result = await migrateGuestData();

    expect(result).toEqual({ status: "skipped", reason: "not_signed_in" });
    expect(clearGuestIdMock).not.toHaveBeenCalled();
  });

  it("claims garden + chat rows, dedupes colliding herbs, and clears the cookie", async () => {
    readGuestIdMock.mockResolvedValue("guest-123");

    // 1. guest's garden rows: turmeric + ginger
    responses.push({
      data: [
        { id: "g1", herb_slug: "turmeric" },
        { id: "g2", herb_slug: "ginger" },
      ],
      error: null,
    });
    // 2. user already has turmeric -> collides with g1
    responses.push({ data: [{ herb_slug: "turmeric" }], error: null });
    // 3. delete the colliding guest row (g1)
    responses.push({ data: null, error: null });
    // 4. claim the surviving guest row (g2 -> ginger)
    responses.push({ data: [{ id: "g2" }], error: null });
    // 5. claim chat sessions
    responses.push({ data: [{ id: "s1" }], error: null });

    const result = await migrateGuestData();

    expect(result).toEqual({
      status: "migrated",
      gardenClaimed: 1,
      gardenDeduped: 1,
      chatClaimed: 1,
    });
    expect(clearGuestIdMock).toHaveBeenCalledTimes(1);
    expect(responses).toHaveLength(0);

    // Ownership scoping: only guest rows that are not already user-owned, and
    // the claim sets both sides of the identity.
    const updates = findCalls("update").map((call) => call.args[0]);
    expect(updates).toContainEqual({ user_id: "u1", guest_id: null });
    expect(findCalls("eq")).toContainEqual({
      method: "eq",
      args: ["guest_id", "guest-123"],
    });
    expect(findCalls("is")).toContainEqual({
      method: "is",
      args: ["user_id", null],
    });
  });

  it("claims chat sessions even when the guest has no saved herbs", async () => {
    readGuestIdMock.mockResolvedValue("guest-123");

    responses.push({ data: [], error: null }); // no garden rows
    responses.push({ data: [{ id: "s1" }], error: null }); // chat claim

    const result = await migrateGuestData();

    expect(result).toEqual({
      status: "migrated",
      gardenClaimed: 0,
      gardenDeduped: 0,
      chatClaimed: 1,
    });
    expect(clearGuestIdMock).toHaveBeenCalledTimes(1);
  });

  it("retries once after a transient failure and keeps the cookie until it succeeds", async () => {
    readGuestIdMock.mockResolvedValue("guest-123");

    // Attempt 1: the guest garden query fails.
    responses.push({ data: null, error: { message: "db hiccup" } });
    // Attempt 2: re-runs from the top (idempotent) and completes.
    responses.push({ data: [], error: null });
    responses.push({ data: [{ id: "s1" }], error: null });

    const result = await migrateGuestData();

    expect(result).toEqual({
      status: "migrated",
      gardenClaimed: 0,
      gardenDeduped: 0,
      chatClaimed: 1,
    });
    expect(clearGuestIdMock).toHaveBeenCalledTimes(1);
    expect(findCalls("from").length).toBeGreaterThanOrEqual(3);
  });

  it("recovers when only the chat claim failed on the first attempt", async () => {
    readGuestIdMock.mockResolvedValue("guest-123");

    responses.push({ data: [], error: null }); // garden: none
    responses.push({ data: null, error: { message: "chat claim failed" } });
    responses.push({ data: [], error: null }); // retry garden: none
    responses.push({ data: [{ id: "s1" }], error: null }); // retry chat claim

    const result = await migrateGuestData();

    expect(result).toEqual({
      status: "migrated",
      gardenClaimed: 0,
      gardenDeduped: 0,
      chatClaimed: 1,
    });
  });

  it("reports failure and preserves the guest cookie when every attempt fails", async () => {
    readGuestIdMock.mockResolvedValue("guest-123");

    responses.push({ data: null, error: { message: "db down" } });
    responses.push({ data: null, error: { message: "db down" } });

    const result = await migrateGuestData();

    expect(result).toEqual({ status: "failed", reason: "db_error" });
    // The cookie is the retry token: clearing it would orphan the unclaimed
    // rows forever.
    expect(clearGuestIdMock).not.toHaveBeenCalled();
  });

  it("never throws, so login is never blocked", async () => {
    readGuestIdMock.mockRejectedValue(new Error("cookie store exploded"));

    await expect(migrateGuestData()).resolves.toEqual({
      status: "failed",
      reason: "db_error",
    });
    expect(clearGuestIdMock).not.toHaveBeenCalled();
  });
});
