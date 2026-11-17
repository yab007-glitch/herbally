"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  loadGoogleConsentMessage,
  readGoogleConsent,
  updateConsentMode,
} from "@/lib/ads/cmp";
import { ADS_LAUNCH_GATE, isAdEligiblePath } from "@/lib/ads/policy";

/**
 * Boot the Google consent message (Funding Choices) on ad-eligible documents.
 *
 * The CMP owns EEA/UK/CH consent; this component only loads it and forwards
 * whichever answer it gives into Consent Mode v2. It is inert while the launch
 * gate is off and on every page that could never carry an ad, so no Google
 * script or message is fetched anywhere else.
 *
 * Renders nothing. `AdSlot` reads the same answer through `readGoogleConsent`
 * before it decides whether a unit may exist.
 */
export function AdCmp() {
  const pathname = usePathname();
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

  useEffect(() => {
    if (!ADS_LAUNCH_GATE) return;
    if (!isAdEligiblePath(pathname)) return;

    loadGoogleConsentMessage(client);

    let cancelled = false;
    void readGoogleConsent().then((consent) => {
      if (cancelled) return;
      if (consent === "granted" || consent === "denied") {
        updateConsentMode(consent);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pathname, client]);

  return null;
}
