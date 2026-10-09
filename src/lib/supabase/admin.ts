import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { boundedFetch } from "@/lib/supabase/fetch-with-timeout";

/**
 * Admin Supabase client using the service role key.
 * Only use in server-side admin routes — bypasses RLS.
 *
 * Requests are time-bounded like the anon client's — the service role bypasses
 * RLS, not the network.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for admin operations"
    );
  }

  return createClient<Database>(url, key, {
    auth: { persistSession: false },
    global: { fetch: boundedFetch },
  });
}
