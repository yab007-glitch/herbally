"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>> & {
      requestNonPersonalizedAds?: number;
    };
  }
}

// Fail closed even when identifiers are configured. Before changing this flag,
// implement and independently verify consent before any ad request and a
// document isolation boundary for navigation to sensitive health tools.
const ADS_APPROVED_FOR_LAUNCH = false;

type AdSlotProps = {
  /** AdSense ad unit slot id, e.g. "1234567890". */
  slot?: string;
  /** AdSense layout format. "auto" is responsive. */
  format?: "auto" | "rectangle" | "horizontal";
  className?: string;
};

/**
 * Render one clearly labelled AdSense display unit.
 *
 * Ads are disabled pending a verified consent flow and isolation from private
 * tools. The script, once executed, can persist during client-side navigation;
 * unmounting a component is not a privacy boundary.
 *
 * `requestNonPersonalizedAds` is set before the first push: HerbAlly pages are
 * health-related, so ads are deliberately contextual rather than based on the
 * reader's inferred health interests.
 */
export function AdSlot({ slot, format = "auto", className }: AdSlotProps) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const adRef = useRef<HTMLModElement>(null);
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!ADS_APPROVED_FOR_LAUNCH || !client || !slot) return;
    if (pushedRef.current) return;
    const adElement = adRef.current;
    if (!adElement) return;

    const scriptId = "adsbygoogle-js";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
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
      window.adsbygoogle.push({});
      pushedRef.current = true;
    } catch {
      // Ad blockers and script failures must never break the page.
    }
  }, [client, slot]);

  if (!ADS_APPROVED_FOR_LAUNCH || !client || !slot) return null;

  return (
    <aside
      aria-label="Advertisement"
      className={className}
      data-ad-container="herbally"
    >
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Advertisement
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
