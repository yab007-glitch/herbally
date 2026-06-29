import { describe, it, expect, vi, beforeEach } from "vitest";
import { getGuestId } from "./guest-id";

const getMock = vi.fn();
const setMock = vi.fn();
const getAllMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: getMock,
    set: setMock,
    getAll: getAllMock,
  }),
}));

describe("guest-id actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockReset();
    setMock.mockReset();
  });

  describe("getGuestId", () => {
    it("returns existing guest ID from cookie when it is a valid UUID", async () => {
      const existing = "de7cf5db-b958-49e9-88a5-39a99972ad9e";
      getMock.mockReturnValueOnce({ value: existing });
      const result = await getGuestId();
      expect(result).toBe(existing);
      expect(getMock).toHaveBeenCalledWith("herbally-guest-id");
      // An existing valid cookie must NOT be overwritten.
      expect(setMock).not.toHaveBeenCalled();
    });

    it("rejects a non-UUID cookie value and mints + persists a fresh UUID", async () => {
      // A legacy/tampered cookie value must never be trusted.
      getMock.mockReturnValueOnce({ value: "existing-guest-123" });
      const result = await getGuestId();
      expect(result).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(setMock).toHaveBeenCalledTimes(1);
      expect(setMock).toHaveBeenCalledWith(
        "herbally-guest-id",
        result,
        expect.objectContaining({ httpOnly: true, path: "/" })
      );
    });

    it("generates a new UUID and sets the cookie when none exists", async () => {
      getMock.mockReturnValueOnce(undefined);
      const result = await getGuestId();
      expect(result).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(getMock).toHaveBeenCalledWith("herbally-guest-id");
      expect(setMock).toHaveBeenCalledWith(
        "herbally-guest-id",
        result,
        expect.objectContaining({ httpOnly: true, path: "/" })
      );
    });
  });
});
