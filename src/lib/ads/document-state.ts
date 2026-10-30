/**
 * Per-document ad state.
 *
 * Module state is exactly the lifetime of a browsing-context document (a full
 * page load). Client-side navigation does not re-evaluate module scope, which
 * is what makes it a reliable "was this document born at an ad-eligible URL?"
 * signal:
 *
 *   - Direct load at /herbs/ginger  → bootPathname = "/herbs/ginger"  → ads may run.
 *   - Client nav from /herbalist    → bootPathname = "/herbalist"     → ads never run.
 *   - Client nav off an ad document → the whole document is replaced; module resets.
 *
 * This is deliberately conservative. It means a reader who reaches a herb page
 * through in-app client navigation sees no ad until the page is loaded as its
 * own document. The navigation guard in `ad-document-guard.tsx` forces a real
 * document load for those transitions once the gate is on.
 */

let bootPathname: string | null =
  typeof window === "undefined" ? null : window.location.pathname;

let adScriptActive = false;
const listeners = new Set<() => void>();

export function getDocumentBootPathname(): string | null {
  return bootPathname;
}

export function isAdScriptActive(): boolean {
  return adScriptActive;
}

export function markAdScriptActive(): void {
  if (adScriptActive) return;
  adScriptActive = true;
  for (const listener of listeners) listener();
}

export function subscribeAdScriptActive(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Test-only reset. Never call from application code: the point of this module
 * is that the boot pathname is fixed for the document's lifetime.
 */
export function __setAdDocumentStateForTests(next: {
  bootPathname?: string | null;
  adScriptActive?: boolean;
}): void {
  if (next.bootPathname !== undefined) {
    bootPathname = next.bootPathname;
  }
  if (next.adScriptActive !== undefined) {
    adScriptActive = next.adScriptActive;
  }
}
