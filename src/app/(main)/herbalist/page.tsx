/**
 * This route is intentionally PUBLIC and does not require authentication.
 * The AI chatbot (Virtual Herbalist) should be accessible to all visitors
 * without requiring a login, as per the public-only nature of the app.
 */

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Info } from "lucide-react";
import { ChatInterface } from "@/components/pharmacist/chat-interface";
import { SafetyAlert } from "@/components/herbs/safety-alert";
import { getHerbBySlug } from "@/lib/actions/herbs";
import { getTranslations } from "next-intl/server";
import { type Locale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "HerbAlly - Virtual Herbalist",
  description:
    "Ask our AI herbalist about herb safety, drug interactions, and dosage.",
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {t("herbalistPage.title")}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {t("herbalistPage.subtitle")}
        </p>
      </div>

      {/* Critical AI Limitations Notice */}
      <SafetyAlert severity="critical" title={t("herbalistPage.safetyTitle")}>
        <div className="space-y-2">
          <p>
            <strong>{t("herbalistPage.safetyNotMedical")}</strong>{" "}
            {t("herbalistPage.safetyDisclaimer")}
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>{t("herbalistPage.safetyConsult")}</li>
            <li>{t("herbalistPage.safetyInteractions")}</li>
            <li>{t("herbalistPage.safetyDiagnose")}</li>
            <li>{t("herbalistPage.safetyEvidence")}</li>
          </ul>
          <p className="font-medium mt-2">
            {t("herbalistPage.safetyEmergency")}
          </p>
        </div>
      </SafetyAlert>

      {/* Context-specific information */}
      {herbName && (
        <div className="rounded-lg border bg-muted/50 p-4">
          <div className="flex items-start gap-3">
            <Info className="size-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-foreground">
                {t("herbalistPage.askingAbout", { name: herbName })}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("herbalistPage.askingAboutDesc")}
              </p>
            </div>
          </div>
        </div>
      )}

      <ChatInterface
        herbContext={herbContext}
        autoQuery={autoQuery}
        locale={locale}
      />

      {/* Trust signals footer */}
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">
          {t("herbalistPage.aboutTitle")}
        </p>
        <ul className="space-y-1">
          <li>• {t("herbalistPage.aboutProvider")}</li>
          <li>• {t("herbalistPage.aboutSources")}</li>
          <li>• {t("herbalistPage.aboutUpdated")}</li>
          <li>• {t("herbalistPage.aboutNotFDA")}</li>
        </ul>
      </div>
    </div>
  );
}
