import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { boundedFetch } from "@/lib/supabase/fetch-with-timeout";

/**
 * Anonymous Supabase client for static generation and sitemap.
 * Uses the anon key — safe for public read-only operations.
 * Returns null if env vars are not configured.
 *
 * Every request is time-bounded (see fetch-with-timeout) — an unhealthy
 * instance must surface as an error the caller can handle, never as a hang.
 */
export function getAnonClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient<Database>(supabaseUrl, supabaseKey, {
    global: { fetch: boundedFetch },
  });
}
