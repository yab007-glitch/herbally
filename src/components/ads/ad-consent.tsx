"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import {
  ADS_LAUNCH_GATE,
  isConsentRestrictedRegion,
  type AdRegion,
} from "@/lib/ads/policy";
import {
  notifyAdConsentChanged,
  readAdConsent,
  subscribeAdConsent,
  writeAdConsent,
} from "@/lib/ads/consent";
import { getAdRegion } from "@/lib/ads/region-client";

type AdConsentProps = {
  /** Test seam: production uses window.location.reload(). */
  reload?: () => void;
};

/**
 * Consent surface for the prepared ad programme.
 *
 * Rendered in the footer on every public layout, but inert while the launch
 * gate is off: no banner, no region lookup, no network. Once the gate is on:
 *
 *   - EEA/UK/CH (and unknown regions) get nothing — ads are blocked there
 *     until a Google-certified CMP exists, so there is nothing to consent to;
 *   - elsewhere the reader gets an explicit Allow / No-ads choice before any
 *     ad request;
 *   - a footer "Ad settings" control reopens the choice and can revoke it. A
 *     revoke that happens after an ad script loaded reloads the document,
 *     because unmounting markup cannot unload third-party code.
 *
 * The stored choice is read through `useSyncExternalStore` so a change made in
 * another tab (BroadcastChannel) reaches every mounted instance, and so the
 * server-rendered HTML never depends on a cookie the server cannot see.
 */
export function AdConsent({ reload }: AdConsentProps = {}) {
  const t = useTranslations("ads");
  const [region, setRegion] = useState<AdRegion | null>(null);
  const [open, setOpen] = useState(false);

  // Server snapshot is `null` (unknown) so hydration matches and the first
  // client paint is the dialog, never a wrong "granted" state.
  const consent = useSyncExternalStore(
    subscribeAdConsent,
    readAdConsent,
    () => null
  );

  useEffect(() => {
    if (!ADS_LAUNCH_GATE) return;
    let alive = true;
    void getAdRegion().then((value) => {
      if (alive) setRegion(value);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!ADS_LAUNCH_GATE) return null;
  if (region === null) return null;
  if (isConsentRestrictedRegion(region)) return null;

  const decide = (choice: "granted" | "denied") => {
    const hadGranted = consent === "granted";
    writeAdConsent(choice);
    notifyAdConsentChanged();
    setOpen(false);
    if (choice === "denied" && hadGranted) {
      if (reload) reload();
      else window.location.reload();
    }
  };

  if (!open && consent !== null) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        {t("settings")}
      </button>
    );
  }

  const granted = consent === "granted";

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={t("consentTitle")}
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl border border-border bg-background p-4 shadow-2xl"
    >
      <p className="text-sm font-semibold text-foreground">
        {t("consentTitle")}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {granted ? t("statusOn") : t("consentBody")}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!granted && (
          <button
            type="button"
            onClick={() => decide("granted")}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            {t("allow")}
          </button>
        )}
        <button
          type="button"
          onClick={() => decide("denied")}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground"
        >
          {granted ? t("revoke") : t("reject")}
        </button>
        <Link
          href="/privacy"
          className="text-xs text-muted-foreground underline underline-offset-4"
        >
          {t("privacyLink")}
        </Link>
      </div>
    </div>
  );
}
