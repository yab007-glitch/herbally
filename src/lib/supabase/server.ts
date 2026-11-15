import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types/database";
import { boundedFetch } from "@/lib/supabase/fetch-with-timeout";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Time-bounded like the other clients: a hung instance must fail fast
      // so the caller's error path runs, instead of stalling the invocation.
      global: { fetch: boundedFetch },
      // No browser Supabase client exists in this app, so the auth cookies
      // never need to be readable from JavaScript. HttpOnly removes the
      // easiest session-theft path for an XSS bug; Secure matters if HTTPS is
      // ever bypassed and is gated so local dev over plain HTTP still works.
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component - middleware handles refresh
          }
        },
      },
    }
  );
}
