"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

type Props = {
  /** Where the interaction data was consulted. Defaults to a pair page. */
  trigger?: "pair_page" | "expand_table";
};

/**
 * Records that a visitor consulted a herb–drug interaction pair.
 *
 * Deliberately sends neither the herb nor the drug: a pair is health
 * information about the reader, and the page view already records which pair
 * was opened. The event exists to measure the funnel step ("did anyone get
 * past a page view to interaction data?"), not to build a health profile.
 */
export function InteractionCheckTracker({ trigger = "pair_page" }: Props) {
  useEffect(() => {
    trackEvent("interaction_checked", { trigger });
  }, [trigger]);

  return null;
}
