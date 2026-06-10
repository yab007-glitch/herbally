import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ChatInterface } from "@/components/pharmacist/chat-interface";
import { getHerbBySlug } from "@/lib/actions/herbs";
import { getTranslations } from "next-intl/server";
import { type Locale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Virtual Herbalist",
  description: "Ask about herb safety, drug interactions, and dosage.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app"}/herbalist`,
  },
};

export default async function PharmacistPage({
  searchParams,
}: {
  searchParams: Promise<{ herb?: string; medications?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("herbally-locale");
  const locale: Locale = (localeCookie?.value as Locale) || "en";
  const t = await getTranslations();
  let herbContext: string | null = null;
  let autoQuery: string | null = null;

  if (params.medications) {
    const meds = decodeURIComponent(params.medications);
    herbContext = `The user is currently taking these medications: ${meds}`;
    autoQuery = t("herbalistPage.medsAutoQuery", { meds });
  } else if (params.herb) {
    const result = await getHerbBySlug(params.herb);
    if (result.success && result.data) {
      const h = result.data;
      herbContext = `${h.name} (${h.scientific_name}): ${h.description}. Traditional uses: ${h.traditional_uses?.join(", ")}. Contraindications: ${h.contraindications?.join(", ")}. Side effects: ${h.side_effects?.join(", ")}.`;
      autoQuery = t("herbalistPage.herbAutoQuery", {
        name: h.name,
        scientific: h.scientific_name,
      });
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("herbalistPage.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("herbalistPage.subtitle")}
        </p>
      </div>

      <ChatInterface
        herbContext={herbContext}
        autoQuery={autoQuery}
        locale={locale}
      />
    </div>
  );
}
