"use client";

/**
 * Client-side ad-consent storage.
 *
 * The choice lives in a first-party cookie so it survives full document loads
 * (required: every ad-eligible page is its own document) and can be read by
 * the AdSlot before any provider script is created. The cookie holds only
 * `v1:granted` / `v1:denied` — no identifier, no timestamp, nothing personal.
 */

import {
  AD_CONSENT_COOKIE,
  AD_CONSENT_EVENT,
  AD_CONSENT_MAX_AGE_SECONDS,
  parseAdConsent,
  serializeAdConsent,
  type AdConsent,
} from "./policy";

const BROADCAST_CHANNEL = "herbally-ads-consent";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split("; ")) {
    if (part.startsWith(prefix)) {
      return decodeURIComponent(part.slice(prefix.length));
    }
  }
  return null;
}

export function readAdConsent(): AdConsent {
  return parseAdConsent(readCookie(AD_CONSENT_COOKIE));
}

export function writeAdConsent(consent: "granted" | "denied"): void {
  if (typeof document === "undefined") return;
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:";
  const attributes = [
    `${AD_CONSENT_COOKIE}=${encodeURIComponent(serializeAdConsent(consent))}`,
    "Path=/",
    `Max-Age=${AD_CONSENT_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
  ];
  if (secure) attributes.push("Secure");
  document.cookie = attributes.join("; ");
}

/** Fire after a choice changes so mounted AdSlots re-evaluate immediately. */
export function notifyAdConsentChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AD_CONSENT_EVENT));
  if (typeof BroadcastChannel !== "undefined") {
    try {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL);
      channel.postMessage("changed");
      channel.close();
    } catch {
      // Cross-tab notification is best-effort; the cookie is still shared.
    }
  }
}

export function subscribeAdConsent(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onCustom = () => listener();
  window.addEventListener(AD_CONSENT_EVENT, onCustom);

  let channel: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== "undefined") {
    try {
      channel = new BroadcastChannel(BROADCAST_CHANNEL);
      channel.onmessage = () => listener();
    } catch {
      channel = null;
    }
  }

  return () => {
    window.removeEventListener(AD_CONSENT_EVENT, onCustom);
    channel?.close();
  };
}
