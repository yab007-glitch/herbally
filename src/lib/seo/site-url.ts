/**
 * Centralized site base URL so JSON-LD schemas, OG tags, and canonical URLs
 * never hardcode `https://herbally.app` (which would emit wrong URLs if the
 * app is deployed under a different NEXT_PUBLIC_APP_URL, and can't reflect the
 * locale). All SEO/schema URLs should derive from this.
 */
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app";
}
