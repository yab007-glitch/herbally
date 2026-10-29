/**
 * One-shot reload for document-level ad cleanup.
 *
 * A loaded provider script cannot be unloaded by unmounting React nodes; the
 * only reliable revoke is to replace the document with one where the gate
 * refuses to load it. The sessionStorage stamp prevents a reload loop if
 * consent and stored state disagree.
 */
export function reloadDocumentOnce(key: string, now = Date.now()): void {
  if (typeof window === "undefined") return;
  try {
    const last = Number(window.sessionStorage.getItem(key) ?? "0");
    if (Number.isFinite(last) && now - last < 10_000) return;
    window.sessionStorage.setItem(key, String(now));
  } catch {
    // Storage unavailable (private mode): fall through and reload. The
    // consent cookie is already written, so the next document stays ad-free.
  }
  window.location.reload();
}
