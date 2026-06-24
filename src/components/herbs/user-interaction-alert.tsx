"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { checkUserMedicationInteractions } from "@/lib/actions/profile";
import { SafetyAlert } from "@/components/herbs/safety-alert";

/**
 * Renders a personalized drug-interaction warning at the top of the herb
 * detail page when the signed-in user is on a medication that interacts with
 * the herb being viewed.
 *
 * This is a CLIENT component deliberately. The herb detail page is ISR-cached
 * (revalidate: 86400); calling the session-reading `checkUserMedicationInteractions`
 * server action directly from the server component would force the page into
 * dynamic rendering and defeat the cache. Fetching on mount keeps the page
 * static for anonymous/first-load traffic and only personalizes after
 * hydration for signed-in users — the safe trade-off for a content page.
 *
 * Errors and empty results render nothing (no flash of placeholder). Guests
 * (no session) get an empty result from the action and also render nothing.
 */
export function UserInteractionAlert({ herbSlug }: { herbSlug: string }) {
  const t = useTranslations();
  const [state, setState] = useState<{
    interactions: Array<{
      drug_name: string;
      severity: string;
      description: string;
      mechanism: string | null;
    }>;
    userMedications: string[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    checkUserMedicationInteractions(herbSlug)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data && res.data.interactions.length > 0) {
          setState(res.data);
        }
      })
      .catch(() => {
        // Swallow — never block page render on a failed interaction check.
      });
    return () => {
      cancelled = true;
    };
  }, [herbSlug]);

  if (!state || state.interactions.length === 0) return null;

  const critical = state.interactions.filter(
    (i) => i.severity === "contraindicated"
  ).length;

  return (
    <SafetyAlert
      severity={critical > 0 ? "critical" : "warning"}
      title={t("safety.personalizedInteractionsTitle")}
    >
      <p className="mb-2">{t("safety.personalizedInteractionsBody")}</p>
      <ul className="list-disc space-y-1 pl-5">
        {state.interactions.map((ix) => (
          <li key={ix.drug_name}>
            <span className="font-semibold capitalize">{ix.severity}:</span>{" "}
            {ix.drug_name} — {ix.description}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        {t("interactions.coverageNotice")}
      </p>
    </SafetyAlert>
  );
}
