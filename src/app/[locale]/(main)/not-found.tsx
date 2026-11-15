import type { Metadata } from "next";
import NotFoundContent from "./not-found-content";

// A client component cannot export metadata, so the nearest not-found for the
// (main) subtree had none: every 404 under it inherited the homepage title in
// <title> while correctly returning 404/noindex.
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return <NotFoundContent />;
}
