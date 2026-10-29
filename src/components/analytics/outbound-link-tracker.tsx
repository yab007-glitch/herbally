"use client";

import { useEffect } from "react";
import { trackEvent, type OutboundTarget } from "@/lib/analytics";

/**
 * Hosts that should be classified as monetisation destinations.
 *
 * Empty today: there are no sponsors and no affiliate programs live. Add a
 * host here (or `data-outbound-target` on the link) when one is signed, and the
 * existing click handler starts attributing it without any other change.
 */
const SPONSOR_HOSTS = new Set<string>([]);
const AFFILIATE_HOSTS = new Set<string>([]);
const DONATION_HOSTS = new Set<string>(["checkout.stripe.com", "billing.stripe.com"]);

function isHostIn(host: string, set: Set<string>): boolean {
  for (const candidate of set) {
    if (host === candidate || host.endsWith(`.${candidate}`)) return true;
  }
  return false;
}

function classify(anchor: HTMLAnchorElement, host: string): OutboundTarget {
  const declared = anchor.dataset.outboundTarget;
  if (declared === "sponsor" || declared === "affiliate" || declared === "donation") {
    return declared;
  }
  if (isHostIn(host, SPONSOR_HOSTS)) return "sponsor";
  if (isHostIn(host, AFFILIATE_HOSTS)) return "affiliate";
  if (isHostIn(host, DONATION_HOSTS)) return "donation";
  return "external";
}

/**
 * Records clicks that leave the site as `outbound_click`.
 *
 * Only the destination class and the hostname are sent — never the path,
 * query string or fragment, which can carry referral identifiers or the title
 * of a health page the visitor was reading.
 *
 * A document-level listener is used on purpose: sponsor and affiliate links do
 * not exist yet, and a delegated handler attributes them the day they ship
 * instead of requiring every new link to remember to call the tracker.
 */
export function OutboundLinkTracker() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.hasAttribute("download")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") return;
      if (url.hostname === window.location.hostname) return;

      trackEvent("outbound_click", {
        target: classify(anchor, url.hostname),
        host: url.hostname,
      });
    }

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
