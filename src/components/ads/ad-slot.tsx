"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ADS_LAUNCH_GATE,
  evaluateAdGate,
  isAdEligiblePath,
  isGlobalPrivacyControlEnabled,
  type AdGateDecision,
  type AdGateInput,
  type GoogleCmpConsent,
} from "@/lib/ads/policy";
import { readGoogleConsent, updateConsentMode } from "@/lib/ads/cmp";
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

/** `navigator.globalPrivacyControl`, undefined on browsers without the API. */
function readGlobalPrivacyControl(): boolean | null | undefined {
  if (typeof navigator === "undefined") return undefined;
  const nav = navigator as Navigator & {
    globalPrivacyControl?: boolean | null;
  };
  return nav.globalPrivacyControl;
}

/**
 * Render one clearly labelled AdSense unit, or nothing.
 *
 * Fails closed at every step:
 *   - hard launch gate (hard-coded false today);
 *   - publisher id + slot configured;
 *   - current URL is a public herb detail page;
 *   - the *document* was loaded at such a page — an ad script must never be
 *     injected into a document that also rendered a health tool;
 *   - the reader has not asserted Global Privacy Control;
 *   - positively-known region; outside EEA/UK/CH an explicit opt-in, inside
 *     EEA/UK/CH a grant from the Google CMP.
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
      const gpc = isGlobalPrivacyControlEnabled(readGlobalPrivacyControl());
      const bootPathname = getDocumentBootPathname();
      const base = {
        gate: ADS_LAUNCH_GATE,
        client,
        slot,
        pathname,
        bootPathname,
        consent,
        gpc,
      } satisfies Omit<AdGateInput, "region" | "cmpConsent">;

      // Cheap decisions first: a document that can never be ad-eligible, or a
      // reader who asserted Global Privacy Control, must not even cost a geo
      // lookup. Every one of these checks precedes the region branch in
      // evaluateAdGate, so the placeholder region cannot change the reason.
      if (
        !isAdEligiblePath(pathname) ||
        !bootPathname ||
        !isAdEligiblePath(bootPathname) ||
        gpc
      ) {
        setDecision(evaluateAdGate({ ...base, region: "unknown" }));
        return;
      }

      const region = await getAdRegion();
      if (cancelled) return;

      // Outside EEA/UK/CH the first-party choice is the consent basis. Mirror
      // it into Consent Mode v2 as soon as it is known, exactly as the CMP's
      // answer is mirrored below: the tags must see the same decision the ad
      // gate honours, including on a document loaded with a stored choice.
      if (region === "row" && (consent === "granted" || consent === "denied")) {
        updateConsentMode(consent);
      }

      // EEA/UK/CH consent comes from the Google CMP, never the first-party
      // cookie. "unknown" covers a message that is absent or still loading.
      const cmpConsent: GoogleCmpConsent =
        region === "eea" ? await readGoogleConsent() : "unknown";
      if (cancelled) return;

      if (cmpConsent === "granted" || cmpConsent === "denied") {
        updateConsentMode(cmpConsent);
      }

      const next = evaluateAdGate({ ...base, region, cmpConsent });

      // Nothing below this point may create a provider request. A revoke, a
      // CMP denial or a GPC opt-out that arrives after the script loaded
      // cannot unload it by removing markup, so replace the document.
      if (!next.allowed && isAdScriptActive()) {
        reloadDocumentOnce("herbally:ads-consent-reload");
      }

      setDecision(next);
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
