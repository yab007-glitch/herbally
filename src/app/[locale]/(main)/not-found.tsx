import type { Metadata } from "next";
import NotFoundContent from "./not-found-content";
import { getLocale } from "@/lib/i18n/page-locale";

// A client component cannot export metadata, so the nearest not-found for the
// (main) subtree had none: every 404 under it inherited the homepage title in
// <title> while correctly returning 404/noindex. The title is also localized:
// /fr/* 404s were announcing "Page not found" in English.
export async function generateMetadata(): Promise<Metadata> {
  const fr = (await getLocale()) === "fr";
  return {
    title: fr ? "Page introuvable" : "Page not found",
    robots: { index: false, follow: false },
  };
}

export default function NotFound() {
  return <NotFoundContent />;
}
