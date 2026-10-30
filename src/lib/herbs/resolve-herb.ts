import { notFound } from "next/navigation";
import type { ActionResponse, HerbWithInteractions } from "@/lib/types";

/**
 * A failed herb lookup that is NOT a genuine miss: the database (or the
 * client) is unavailable. Thrown before a result can enter any data cache so
 * a transient DB failure surfaces as a retryable 500 instead of being
 * persisted and re-served as a 404.
 */
export class HerbDataUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HerbDataUnavailableError";
  }
}

/**
 * True when the app was built/run against the CI placeholder Supabase
 * config. `build` and `test-e2e` intentionally run with
 * `NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co` so CI never
 * touches production data. In that environment an `unavailable` result is
 * expected rather than an incident, so it must not fail the build.
 */
function isStubSupabase(): boolean {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").includes(
    "placeholder.supabase.co"
  );
}

/**
 * Fail loud on an unavailable data source — except under the CI placeholder
 * config, where no database exists and a 404 is the correct stub result.
 * Every call site that needs the fail-loud behaviour must go through here so
 * the stub rule cannot be bypassed by a new inline throw.
 */
export function herbUnavailable(error: string): never {
  if (isStubSupabase()) notFound();
  throw new HerbDataUnavailableError(error);
}

/**
 * Turn a getHerbBySlug result into the row, or a 404.
 *
 * `unavailable` means the query itself failed (timeout, connection refused,
 * misconfiguration) — that must propagate as an error so Next renders a 500
 * and the next request retries. Only a real `not_found` (or a legacy failure
 * with no reason) becomes notFound().
 *
 * Exception: under the CI placeholder config there is no database to be
 * unavailable, so rendering a 404 is the correct stub behaviour. Production
 * and preview always carry a real URL and keep the fail-loud path.
 */
export function resolveHerbOr404(
  result: ActionResponse<HerbWithInteractions>
): HerbWithInteractions {
  if (result.success && result.data) return result.data;
  if (!result.success && result.reason === "unavailable") {
    herbUnavailable(result.error);
  }
  notFound();
}
