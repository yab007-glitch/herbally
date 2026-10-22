import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { boundedFetch } from "@/lib/supabase/fetch-with-timeout";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Env vars not configured — return a no-op response so the proxy
    // doesn't crash on cold start. The health endpoint will report
    // the missing configuration.
    return {
      supabaseResponse: NextResponse.next({ request }),
      user: null,
      supabase: null,
    };
  }

  // Fast path: without a Supabase auth cookie there is no session to refresh.
  // Calling auth.getUser() anyway costs an outbound request and CPU on every
  // anonymous page view (the overwhelming majority of traffic, including
  // crawlers) and can never change the response. Supabase SSR names its
  // cookies `sb-<project-ref>-auth-token`, chunked as `.0`, `.1`, …
  const hasAuthCookie = request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token")
    );
  if (!hasAuthCookie) {
    return {
      supabaseResponse: NextResponse.next({ request }),
      user: null,
      supabase: null,
    };
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    // Match admin/server clients: a hung Supabase instance must fail this
    // request fast instead of stalling the proxy invocation until the
    // platform timeout.
    global: { fetch: boundedFetch },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabaseResponse, user, supabase };
}
