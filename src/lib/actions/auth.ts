"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { migrateGuestData } from "@/lib/actions/guest-migration";
import type { ActionResponse } from "@/lib/types";

/**
 * Redirect target after login. Defaults to "/" (home page). When a `returnTo`
 * query param is present on the login page, the client passes it as a hidden
 * field so the server action can redirect back to the original page.
 */
function safeReturnTo(fd: FormData): string {
  const raw = fd.get("returnTo") as string | null;
  // Only allow same-origin absolute-less paths to prevent open redirect.
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/";
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
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // If email confirmation is disabled in Supabase (as in this project),
  // signUp returns a session immediately — the user is logged in. Redirect
  // to home with a welcome flag so the client can show a toast.
  if (data.session) {
    await migrateGuestData();
    redirect("/?welcome=register");
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
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
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
