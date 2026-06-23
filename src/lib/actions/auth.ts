"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { migrateGuestData } from "@/lib/actions/guest-migration";
import { getLocaleFromRequest } from "@/lib/i18n/server-locale";
import { getTranslations } from "next-intl/server";
import type { ActionResponse } from "@/lib/types";

/**
 * Redirect target after login. Defaults to "/" (home page). When a `returnTo`
 * query param is present on the login page, the client passes it as a hidden
 * field so the server action can redirect back to the original page.
 */
function safeReturnTo(fd: FormData): string {
  const raw = fd.get("returnTo") as string | null;
  if (!raw) return "/";
  // M3 (audit 2026-06-22): the old `raw.startsWith("/") && !raw.startsWith("//")`
  // check blocked `//evil.com` but NOT `/\evil.com` or `/\\evil.com`, which
  // several browsers normalize to a protocol-relative `//evil.com` → open
  // redirect. Reject any backslash outright, then require a single-leading-slash
  // same-origin path. No query-encoded bypass: decode first so `%2F%2F` and
  // `%5C` can't sneak through.
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return "/";
  }
  if (decoded.includes("\\")) return "/";
  if (!decoded.startsWith("/") || decoded.startsWith("//")) return "/";
  // Block scheme-relative and protocol-relative URLs that begin with "//"
  // after any leading whitespace, and any explicit scheme.
  if (/^\s*[a-z][a-z0-9+.-]*:/i.test(decoded)) return "/";
  return decoded;
}

export async function login(formData: FormData): Promise<ActionResponse> {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // FUNC-8: claim the guest's anonymous garden + chat history into the
  // now-authenticated account. Best-effort — never blocks login. See
  // guest-migration.ts; idempotent and cookie-cleared on success.
  await migrateGuestData();

  // Redirect to the return URL (or home). redirect() throws a special
  // error that Next.js intercepts — the browser navigates automatically.
  redirect(
    safeReturnTo(formData) +
      (safeReturnTo(formData) === "/" ? "?welcome=login" : "&welcome=login")
  );
}

export async function register(formData: FormData): Promise<ActionResponse> {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("full_name") as string;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/`,
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Scenario 1: New user with email confirmation DISABLED.
  // signUp returns a session immediately — the user is logged in.
  if (data.session) {
    await migrateGuestData();
    redirect("/?welcome=register");
  }

  // Scenario 2: Email confirmation ENABLED — no session, user needs to
  // confirm via email. Show the "check email" message.
  // BUT: Supabase also returns { user, session: null, error: null } when
  // the email ALREADY EXISTS (for security reasons it doesn't reveal this).
  // In that case, no confirmation email is sent either. We detect this by
  // trying to sign in with the provided credentials — if it succeeds, the
  // user already had an account and is now logged in.
  if (data.user && !data.session) {
    // Try signing in — this distinguishes between:
    // - New user with email confirmation enabled (sign-in fails with "not confirmed")
    // - Existing user with correct password (sign-in succeeds → auto-login)
    // - Existing user with wrong password (sign-in fails with "invalid credentials")
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (!signInError && signInData.session) {
      // The user already had an account with this email + password.
      // They're now logged in — redirect to home.
      await migrateGuestData();
      redirect("/?welcome=login");
    }

    if (signInError) {
      const errMsg = signInError.message.toLowerCase();
      // If the error is about email not being confirmed, this is a genuinely
      // new user who needs to confirm their email — show the "check email" message.
      if (
        errMsg.includes("not confirmed") ||
        errMsg.includes("email not verified")
      ) {
        return { success: true };
      }
      // Any other sign-in error (invalid credentials, etc.) means the email
      // already exists with a different password — tell them to log in.
      const locale = await getLocaleFromRequest();
      const t = await getTranslations({ locale, namespace: "auth.register" });
      return {
        success: false,
        error: t("accountExists"),
      };
    }
  }

  // Email confirmation required — tell the user to check their inbox.
  return { success: true };
}

export async function forgotPassword(
  formData: FormData
): Promise<ActionResponse> {
  const supabase = await createClient();

  const email = formData.get("email") as string;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function resetPassword(
  formData: FormData
): Promise<ActionResponse> {
  const supabase = await createClient();

  const password = formData.get("password") as string;

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

/**
 * Returns the currently signed-in user (id + email) or null.
 * Used by the client AccountMenu to render login/logout without exposing the
 * full session. Safe to call from client components (server action).
 */
export async function currentUser(): Promise<{
  id: string;
  email?: string | null;
  isAdmin?: boolean;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Check admin status
  let isAdmin = false;
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    isAdmin = profile?.role === "admin";
  } catch {
    // If profile lookup fails, default to non-admin
  }

  return { id: user.id, email: user.email, isAdmin };
}
