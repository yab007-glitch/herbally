/**
 * Navigation boundary for ad-bearing documents.
 *
 * Once an ad script is active, the only safe way to leave the document is a
 * real document navigation: a client-side route change would keep the
 * provider script alive inside the next page's document. This helper decides
 * whether a click has to be upgraded to a full document load. It is pure so
 * the decision table can be tested without a browser.
 */

export type DocumentNavigationReason =
  "inactive" | "external" | "same-document-hash" | "same-url" | "internal";

export type DocumentNavigationDecision = {
  force: boolean;
  reason: DocumentNavigationReason;
  href?: string;
};

export function decideDocumentNavigation(input: {
  adActive: boolean;
  currentUrl: string;
  targetUrl: string;
}): DocumentNavigationDecision {
  if (!input.adActive) return { force: false, reason: "inactive" };

  let current: URL;
  let target: URL;
  try {
    current = new URL(input.currentUrl);
    target = new URL(input.targetUrl, input.currentUrl);
  } catch {
    // Unparseable destination: let the browser do whatever it would do.
    return { force: false, reason: "external" };
  }

  if (target.origin !== current.origin) {
    return { force: false, reason: "external", href: target.href };
  }

  // In-page anchor: no document change, so no provider-script migration.
  if (
    target.hash &&
    target.pathname === current.pathname &&
    target.search === current.search
  ) {
    return { force: false, reason: "same-document-hash", href: target.href };
  }

  if (target.href === current.href) {
    return { force: false, reason: "same-url", href: target.href };
  }

  return { force: true, reason: "internal", href: target.href };
}
