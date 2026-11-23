import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getLocale } from "@/lib/i18n/page-locale";
import { LocaleNotFoundContent } from "./locale-not-found-content";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "notFound" });
  return {
    // `absolute` bypasses the root layout's `%s | HerbAlly` title template —
    // without it the tab reads "Page Not Found | HerbAlly | HerbAlly".
    title: { absolute: `${t("title")} | HerbAlly` },
    // follow, not "no": a 404 is never indexed either way, and its outbound
    // links are the only thing a lost visitor or a crawler can act on.
    robots: { index: false, follow: true },
  };
}

export default function NotFound() {
  return <LocaleNotFoundContent />;
}
