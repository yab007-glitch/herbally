import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Info } from "lucide-react";
import { ChatInterface } from "@/components/pharmacist/chat-interface";
import { getHerbBySlug } from "@/lib/actions/herbs";
import { getTranslations } from "next-intl/server";
import { type Locale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "HerbAlly — Virtual Herbalist | Medicinal Herbs & Drug Interactions",
  description:
    "Ask our AI herbalist about herb safety, drug interactions, and dosage. Explore 2,700+ medicinal herbs. Evidence-based answers from WHO, NCCIH, and PubMed. Free, no account required.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app"}`,
  },
};

export default async function HomePage({
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
  let herbName: string | null = null;

  if (params.medications) {
    const meds = decodeURIComponent(params.medications);
    herbContext = `The user is currently taking these medications: ${meds}`;
    autoQuery = t("herbalistPage.medsAutoQuery", { meds });
  } else if (params.herb) {
    const result = await getHerbBySlug(params.herb);
    if (result.success && result.data) {
      const h = result.data;
      herbName = h.name;
      herbContext = `${h.name} (${h.scientific_name}): ${h.description}. Traditional uses: ${h.traditional_uses?.join(", ")}. Contraindications: ${h.contraindications?.join(", ")}. Side effects: ${h.side_effects?.join(", ")}.`;
      autoQuery = t("herbalistPage.herbAutoQuery", {
        name: h.name,
        scientific: h.scientific_name,
      });
    }
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-12rem)] min-h-[500px]">
      {/* Context-specific banner when deep-linked from herb page */}
      {herbName && (
        <div className="mb-4 shrink-0 rounded-lg border bg-muted/50 p-3">
          <div className="flex items-start gap-3">
            <Info className="size-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-foreground text-sm">
                {t("herbalistPage.askingAbout", { name: herbName })}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("herbalistPage.askingAboutDesc")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Chat fills all remaining space */}
      <div className="flex-1 min-h-0">
        <ChatInterface
          herbContext={herbContext}
          autoQuery={autoQuery}
          locale={locale}
        />
      </div>
    </div>
  );
}
