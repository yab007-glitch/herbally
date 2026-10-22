import { notFound } from "next/navigation";

/**
 * Any path under a locale that does not match a real route is a 404.
 *
 * Without this catch-all, `/fr/does-not-exist` would still return 404, but
 * from Next's built-in unstyled page and *outside* the localized root layout.
 * Routing it through `notFound()` renders app/[locale]/not-found.tsx with the
 * correct `<html lang>` and navigation instead.
 *
 * More specific routes (e.g. `[locale]/herbs/[slug]`) always win over a
 * catch-all, so this only sees genuinely unknown paths.
 */

export default function LocaleCatchAll() {
  notFound();
}
