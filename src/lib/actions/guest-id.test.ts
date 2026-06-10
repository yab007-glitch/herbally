import { describe, it, expect, vi, beforeEach } from "vitest";
import { getGuestId, setGuestId } from "./guest-id";

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
    it("returns existing guest ID from cookie", async () => {
      getMock.mockReturnValueOnce({ value: "existing-guest-123" });
      const result = await getGuestId();
      expect(result).toBe("existing-guest-123");
      expect(getMock).toHaveBeenCalledWith("herbally-guest-id");
    });

    it("generates a new UUID when no cookie exists", async () => {
      getMock.mockReturnValueOnce(undefined);
      const result = await getGuestId();
      expect(result).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(getMock).toHaveBeenCalledWith("herbally-guest-id");
    });
  });

  describe("setGuestId", () => {
    it("sets the guest ID cookie with correct options", async () => {
      await setGuestId("guest-abc-123");
      expect(setMock).toHaveBeenCalledWith("herbally-guest-id", "guest-abc-123", {
        httpOnly: true,
        secure: false, // NODE_ENV !== "production" in test
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
      });
    });
  });
});
