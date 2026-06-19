import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---------------------------------------------------------------
const readGuestIdMock = vi.fn();
const clearGuestIdMock = vi.fn();
const getUserMock = vi.fn();

// Thenable, chainable admin client mock: every builder method returns the
// same proxy `chain`, and each `await` consumes the next queued response in
// call order. This lets us assert the exact sequence of DB operations the
// migration performs without modeling every supabase-js builder branch.
const responses: Array<{ data: unknown; error: unknown }> = [];
// The mock must be both chainable (every builder method returns itself) and
// thenable (await consumes the next queued response). supabase-js's builder
// types don't model this single-object shape, so a structural type with an
// index signature is the cleanest faithful representation.
type Chain = {
  from: () => Chain;
  select: () => Chain;
  eq: () => Chain;
  in: () => Chain;
  is: () => Chain;
  update: () => Chain;
  delete: () => Chain;
  then: (resolve: (v: { data: unknown; error: unknown }) => unknown) => unknown;
};
const chain = {
  from: () => chain,
  select: () => chain,
  eq: () => chain,
  in: () => chain,
  is: () => chain,
  update: () => chain,
  delete: () => chain,
  then: (resolve: (v: { data: unknown; error: unknown }) => unknown) =>
    resolve(responses.shift() ?? { data: null, error: null }),
} as Chain;

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

describe("migrateGuestData (FUNC-8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    responses.length = 0;
    readGuestIdMock.mockReset();
    clearGuestIdMock.mockReset();
    getUserMock.mockReset();
  });

  it("returns false and does nothing when there is no guest id", async () => {
    readGuestIdMock.mockResolvedValue(null);
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });

    const ran = await migrateGuestData();

    expect(ran).toBe(false);
    expect(getUserMock).not.toHaveBeenCalled();
    expect(clearGuestIdMock).not.toHaveBeenCalled();
  });

  it("returns false and does not claim when there is no authenticated user", async () => {
    readGuestIdMock.mockResolvedValue("guest-123");
    getUserMock.mockResolvedValue({ data: { user: null } });

    const ran = await migrateGuestData();

    expect(ran).toBe(false);
    expect(clearGuestIdMock).not.toHaveBeenCalled();
  });

  it("claims garden + chat rows, dedupes colliding herbs, and clears the cookie", async () => {
    readGuestIdMock.mockResolvedValue("guest-123");
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });

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

    const ran = await migrateGuestData();

    expect(ran).toBe(true);
    expect(clearGuestIdMock).toHaveBeenCalledTimes(1);
    // All five queued responses were consumed (migration ran to completion).
    expect(responses).toHaveLength(0);
  });

  it("skips garden dedupe + claim when the guest has no saved herbs", async () => {
    readGuestIdMock.mockResolvedValue("guest-123");
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });

    // guest has no garden rows -> the garden block is skipped entirely; only
    // the chat claim runs.
    responses.push({ data: [], error: null });
    responses.push({ data: [{ id: "s1" }], error: null });

    const ran = await migrateGuestData();

    expect(ran).toBe(true);
    expect(clearGuestIdMock).toHaveBeenCalledTimes(1);
    expect(responses).toHaveLength(0);
  });

  it("never throws on DB error (returns false, login is not blocked)", async () => {
    readGuestIdMock.mockResolvedValue("guest-123");
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    // First garden query errors.
    responses.push({ data: null, error: { message: "db down" } });

    const ran = await migrateGuestData();

    expect(ran).toBe(false);
    expect(clearGuestIdMock).not.toHaveBeenCalled();
  });
});
