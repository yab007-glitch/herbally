"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ADS_LAUNCH_GATE,
  evaluateAdGate,
  type AdGateDecision,
} from "@/lib/ads/policy";
import { readAdConsent, subscribeAdConsent } from "@/lib/ads/consent";
import {
  getDocumentBootPathname,
  isAdScriptActive,
  markAdScriptActive,
} from "@/lib/ads/document-state";
import { getAdRegion } from "@/lib/ads/region-client";
import { reloadDocumentOnce } from "@/lib/ads/reload";

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>> & {
      requestNonPersonalizedAds?: number;
    };
  }
}

type AdSlotProps = {
  /** AdSense ad unit slot id, e.g. "1234567890". */
  slot?: string;
  /** AdSense layout format. "auto" is responsive. */
  format?: "auto" | "rectangle" | "horizontal";
  /** Visible label (policy allows "Advertisements" / "Sponsored Links"). */
  label?: string;
  className?: string;
};

const SCRIPT_ID = "adsbygoogle-js";

/**
 * Render one clearly labelled AdSense unit, or nothing.
 *
 * Fails closed at every step:
 *   - hard launch gate (hard-coded false today);
 *   - publisher id + slot configured;
 *   - current URL is a public herb detail page;
 *   - the *document* was loaded at such a page — an ad script must never be
 *     injected into a document that also rendered a health tool;
 *   - explicit opt-in consent;
 *   - positively-known non-EEA/UK/CH region.
 *
 * The provider script is only created after all of those pass, so there is no
 * ad-network request before consent. Non-personalised ads are requested
 * because the surrounding content is health-related.
 */
export function AdSlot({
  slot,
  format = "auto",
  label = "Advertisements",
  className,
}: AdSlotProps) {
  const pathname = usePathname();
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const [decision, setDecision] = useState<AdGateDecision | null>(null);
  const adRef = useRef<HTMLModElement>(null);
  const pushedRef = useRef(false);

  useEffect(() => {
    // Nothing to evaluate while the gate is closed or the ids are missing.
    // The initial decision state is already "no ad", so this branch must not
    // call setState: it would trigger a cascading render for no change.
    if (!ADS_LAUNCH_GATE || !client || !slot) return;

    let cancelled = false;

    const evaluate = async () => {
      const consent = readAdConsent();

      // Nothing below this point may create a provider request. A revoke in
      // another tab also lands here: if a script is already live, replace the
      // document so it cannot keep running.
      if (consent !== "granted") {
        if (isAdScriptActive()) {
          reloadDocumentOnce("herbally:ads-consent-reload");
        }
        setDecision({
          allowed: false,
          reason: consent === "denied" ? "consent-denied" : "consent-missing",
        });
        return;
      }

      const region = await getAdRegion();
      if (cancelled) return;

      setDecision(
        evaluateAdGate({
          gate: ADS_LAUNCH_GATE,
          client,
          slot,
          pathname,
          bootPathname: getDocumentBootPathname(),
          consent,
          region,
        })
      );
    };

    void evaluate();
    const unsubscribe = subscribeAdConsent(() => void evaluate());
    const onPageShow = (event: PageTransitionEvent) => {
      // bfcache restore: re-check a choice that may have changed elsewhere.
      if (event.persisted) void evaluate();
    };
    window.addEventListener("pageshow", onPageShow);

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [pathname, client, slot]);

  useEffect(() => {
    if (!decision?.allowed || !client) return;
    const adElement = adRef.current;
    if (!adElement) return;

    markAdScriptActive();

    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
        client
      )}`;
      document.head.appendChild(script);
    }

    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.requestNonPersonalizedAds = 1;
      if (!pushedRef.current) {
        pushedRef.current = true;
        window.adsbygoogle.push({});
      }
    } catch {
      // Ad blockers and script failures must never break the page.
    }
  }, [decision, client]);

  if (!decision?.allowed) return null;

  return (
    <aside
      aria-label={label}
      className={className}
      data-ad-container="herbally"
    >
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </aside>
  );
}
