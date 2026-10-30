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
 * Turn a getHerbBySlug result into the row, or a 404.
 *
 * `unavailable` means the query itself failed (timeout, connection refused,
 * misconfiguration) — that must propagate as an error so Next renders a 500
 * and the next request retries. Only a real `not_found` (or a legacy failure
 * with no reason) becomes notFound().
 */
export function resolveHerbOr404(
  result: ActionResponse<HerbWithInteractions>
): HerbWithInteractions {
  if (result.success && result.data) return result.data;
  if (!result.success && result.reason === "unavailable") {
    throw new HerbDataUnavailableError(result.error);
  }
  notFound();
}
