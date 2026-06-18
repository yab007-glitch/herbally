import { buildPageMetadata } from "@/lib/i18n/metadata";
import { ChatInterface } from "@/components/pharmacist/chat-interface";
import { getHerbBySlug } from "@/lib/actions/herbs";
import { getTranslations } from "next-intl/server";
import { getLocaleFromRequest } from "@/lib/i18n/server-locale";

export const dynamic = "force-dynamic";

export const generateMetadata = () =>
  buildPageMetadata({
    titleKey: "virtualHerbalist",
    descKey: "virtualHerbalistDesc",
    path: "/herbalist",
  });

export default async function PharmacistPage({
  searchParams,
}: {
  searchParams: Promise<{ herb?: string; medications?: string; q?: string }>;
}) {
  const params = await searchParams;
  const locale = await getLocaleFromRequest();
  const t = await getTranslations({ locale });
  let herbContext: string | null = null;
  let autoQuery: string | null = null;

  // Direct query from homepage interaction checker
  if (params.q) {
    autoQuery = decodeURIComponent(params.q);
  } else if (params.medications) {
    const meds = decodeURIComponent(params.medications);
    herbContext = `The user is currently taking these medications: ${meds}`;
    autoQuery = t("herbalistPage.medsAutoQuery", { meds });
  } else if (params.herb) {
    const result = await getHerbBySlug(params.herb);
    if (result.success && result.data) {
      const h = result.data;
      herbContext = `${h.name} (${h.scientific_name}): ${h.description || ""}`;
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
        locale="en"
      />
    </div>
  );
}
