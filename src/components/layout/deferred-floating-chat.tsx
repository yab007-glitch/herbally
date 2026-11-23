"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const FloatingChatButton = dynamic(
  () =>
    import("./floating-chat-button").then((mod) => mod.FloatingChatButton),
  { ssr: false }
);

/**
 * Defers the floating herbalist launcher chunk and mount until after first
 * paint / idle so it does not compete with LCP or hydration on initial load.
 */
export function DeferredFloatingChat() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(() => setReady(true), {
        timeout: 2000,
      });
      return () => window.cancelIdleCallback(id);
    }
    const timer = globalThis.setTimeout(() => setReady(true), 1500);
    return () => globalThis.clearTimeout(timer);
  }, []);

  if (!ready) return null;
  return <FloatingChatButton />;
}
