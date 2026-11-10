"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ADS_LAUNCH_GATE, isAdEligiblePath } from "@/lib/ads/policy";
import { isAdScriptActive } from "@/lib/ads/document-state";
import { decideDocumentNavigation } from "@/lib/ads/navigation";
import { reloadDocumentOnce } from "@/lib/ads/reload";

/**
 * Enforces the document boundary while an ad script is live.
 *
 * Two jobs, both inert while the launch gate is off:
 *
 * 1. Upgrade internal link clicks to real document navigations. A client-side
 *    route change would keep the provider script alive inside the next page's
 *    document — including health tools. A full document load guarantees the
 *    next document's CSP and layout are chosen from its own URL.
 * 2. Defence in depth: if a programmatic `router.push` still slips through and
 *    the URL stops being ad-eligible while the script is active, reload the
 *    current URL once so the provider script is unloaded.
 *
 * Back/forward are left to the browser: each history entry is its own
 * document (an ad page restores an ad document, a health tool restores a
 * health-tool document), so the script never migrates between them.
 */
export function AdDocumentGuard() {
  const pathname = usePathname();

  useEffect(() => {
    if (!ADS_LAUNCH_GATE) return;

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const decision = decideDocumentNavigation({
        adActive: isAdScriptActive(),
        currentUrl: window.location.href,
        targetUrl: anchor.href,
      });
      if (!decision.force || !decision.href) return;

      event.preventDefault();
      event.stopPropagation();
      window.location.assign(decision.href);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!ADS_LAUNCH_GATE) return;
    if (!isAdScriptActive()) return;
    if (isAdEligiblePath(pathname)) return;
    reloadDocumentOnce("herbally:ad-document-guard");
  }, [pathname]);

  return null;
}
