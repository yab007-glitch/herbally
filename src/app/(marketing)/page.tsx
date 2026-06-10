import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ChatInterface } from "@/components/pharmacist/chat-interface";
import { getTranslations } from "next-intl/server";
import { type Locale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "HerbAlly — Virtual Herbalist | Ask About Medicinal Herbs",
  description:
    "Ask our AI herbalist about herb safety, drug interactions, and dosage. Explore 2,700+ medicinal herbs. Evidence-based answers. Free, no account required.",
  alternates: {
    canonical: process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app",
  },
};

export default async function HomePage() {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("herbally-locale");
  const locale: Locale = (localeCookie?.value as Locale) || "en";
  const _t = await getTranslations();

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <ChatInterface locale={locale} />
    </div>
  );
}
