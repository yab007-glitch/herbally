import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { login, register, forgotPassword, resetPassword, logout } from "./auth";

// ─── mocks ──────────────────────────────────────────────────────────
const signInMock = vi.fn();
const signUpMock = vi.fn();
const resetPasswordMock = vi.fn();
const updateUserMock = vi.fn();
const signOutMock = vi.fn();
const getUserMock = vi.fn();

const redirectMock = vi.fn();

vi.mock("next/navigation", () => ({
  // redirect() throws a special error in Next.js to interrupt control flow.
  // The mock must replicate this so tests can assert it was called.
  redirect: (...args: string[]) => {
    redirectMock(...args);
    throw new Error("NEXT_REDIRECT");
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithPassword: signInMock,
      signUp: signUpMock,
      resetPasswordForEmail: resetPasswordMock,
      updateUser: updateUserMock,
      signOut: signOutMock,
      getUser: getUserMock,
    },
  }),
}));

describe("auth actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://herbally.app";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("login", () => {
    it("redirects to home when credentials are valid", async () => {
      signInMock.mockResolvedValueOnce({ error: null });
      const formData = new FormData();
      formData.set("email", "user@example.com");
      formData.set("password", "secret123");

      // redirect() throws NEXT_REDIRECT — catch it so we can assert.
      await expect(login(formData)).rejects.toThrow("NEXT_REDIRECT");
      expect(signInMock).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "secret123",
      });
      expect(redirectMock).toHaveBeenCalledWith("/?welcome=login");
    });

    it("returns error when sign-in fails", async () => {
      signInMock.mockResolvedValueOnce({
        error: { message: "Invalid login credentials" },
      });
      const formData = new FormData();
      formData.set("email", "bad@example.com");
      formData.set("password", "wrong");

      const result = await login(formData);
      expect(result.success).toBe(false);
      expect(!result.success && result.error).toBe("Invalid login credentials");
    });
  });

  describe("register", () => {
    it("redirects when registration returns a session", async () => {
      signUpMock.mockResolvedValueOnce({
        data: { session: { access_token: "x" }, user: { id: "u1" } },
        error: null,
      });
      const formData = new FormData();
      formData.set("email", "new@example.com");
      formData.set("password", "securepass");
      formData.set("full_name", "Jane Doe");

      await expect(register(formData)).rejects.toThrow("NEXT_REDIRECT");
      expect(redirectMock).toHaveBeenCalledWith("/?welcome=register");
    });

    it("returns success when email confirmation is required", async () => {
      signUpMock.mockResolvedValueOnce({
        data: { session: null, user: { id: "u1" } },
        error: null,
      });
      const formData = new FormData();
      formData.set("email", "new@example.com");
      formData.set("password", "securepass");
      formData.set("full_name", "Jane Doe");

      const result = await register(formData);
      expect(result.success).toBe(true);
    });

    it("returns error when registration fails", async () => {
      signUpMock.mockResolvedValueOnce({
        error: { message: "Email already registered" },
      });
      const formData = new FormData();
      formData.set("email", "taken@example.com");
      formData.set("password", "x");
      formData.set("full_name", "X");

      const result = await register(formData);
      expect(result.success).toBe(false);
      expect(!result.success && result.error).toBe("Email already registered");
    });
  });

  describe("forgotPassword", () => {
    it("returns success when reset email is sent", async () => {
      resetPasswordMock.mockResolvedValueOnce({ error: null });
      const formData = new FormData();
      formData.set("email", "user@example.com");

      const result = await forgotPassword(formData);
      expect(result.success).toBe(true);
      expect(resetPasswordMock).toHaveBeenCalledWith("user@example.com", {
        redirectTo: "https://herbally.app/reset-password",
      });
    });

    it("returns error when reset fails", async () => {
      resetPasswordMock.mockResolvedValueOnce({
        error: { message: "User not found" },
      });
      const formData = new FormData();
      formData.set("email", "unknown@example.com");

      const result = await forgotPassword(formData);
      expect(result.success).toBe(false);
      expect(!result.success && result.error).toBe("User not found");
    });
  });

  describe("resetPassword", () => {
    it("returns success when password is updated", async () => {
      updateUserMock.mockResolvedValueOnce({ error: null });
      const formData = new FormData();
      formData.set("password", "newpassword123");

      const result = await resetPassword(formData);
      expect(result.success).toBe(true);
      expect(updateUserMock).toHaveBeenCalledWith({
        password: "newpassword123",
      });
    });

    it("returns error when update fails", async () => {
      updateUserMock.mockResolvedValueOnce({
        error: { message: "Password too weak" },
      });
      const formData = new FormData();
      formData.set("password", "123");

      const result = await resetPassword(formData);
      expect(result.success).toBe(false);
      expect(!result.success && result.error).toBe("Password too weak");
    });
  });

  describe("logout", () => {
    it("calls signOut and redirects to home", async () => {
      signOutMock.mockResolvedValueOnce({ error: null });
      await expect(logout()).rejects.toThrow("NEXT_REDIRECT");
      expect(signOutMock).toHaveBeenCalled();
      expect(redirectMock).toHaveBeenCalledWith("/");
    });
  });
});
