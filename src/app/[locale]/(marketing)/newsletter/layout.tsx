import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Transactional confirmation screens, not pages.
 *
 * Both routes render HTTP 200 whether the token was good, already used,
 * expired or absent, and `?status=` multiplies that four ways per locale. That
 * is a soft-404 shape: Googlebot follows a link, gets a 200, and reads "that
 * link didn't work". Neither route exported any metadata at all, so both
 * inherited the site's default title and description and were fully
 * indexable.
 *
 * Nothing here belongs in an index. One layout covers both routes so a third
 * confirmation screen cannot be added without inheriting this.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Pass-through. This layout exists only to carry `metadata` down to both
 * newsletter routes; it renders no chrome of its own.
 */
export default function NewsletterLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
