import { buildPageMetadata } from "@/lib/i18n/metadata";
import { ChatInterface } from "@/components/pharmacist/chat-interface";
import { getHerbBySlug } from "@/lib/actions/herbs";
import { getTranslations } from "next-intl/server";
import { getLocale } from "@/lib/i18n/page-locale";
import { ToolsMessagesProvider } from "@/components/i18n/tools-messages-provider";
import { ContinueExploring } from "@/components/shared/continue-exploring";
import { NewsletterSignup } from "@/components/marketing/newsletter-signup";

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
  const locale = await getLocale();
  const t = await getTranslations({ locale });
  let herbContext: string | null = null;
  let autoQuery: string | null = null;

  // NOTE: searchParams values arrive pre-decoded from Next.js — do NOT call
  // decodeURIComponent here. A lone "%" (e.g. ?q=100%) makes
  // decodeURIComponent throw URIError and 500s the whole page.
  // Direct query from homepage interaction checker
  if (params.q) {
    autoQuery = params.q;
  } else if (params.medications) {
    const meds = params.medications;
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
    <ToolsMessagesProvider locale={locale}>
      <div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t("herbalistPage.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("herbalistPage.subtitle")}
          </p>
          <p
            role="note"
            className="mt-3 rounded-xl border border-border/80 bg-muted/30 px-4 py-2.5 text-xs leading-relaxed text-muted-foreground"
          >
            {locale === "fr"
              ? "Assistant IA éducatif (non un clinicien) : interroge d'abord la base structurée HerbAlly, refuse les urgences médicales ou posologies pédiatriques et relaie votre question à Ollama Cloud sans identifiant nominatif (n'inscrivez aucun nom ni dossier médical)."
              : "Educational AI assistant (not a licensed clinician): retrieves HerbAlly database records first, blocks medical emergencies and pediatric dosing, and relays prompts to Ollama Cloud without personal identifiers — do not enter names or health-record IDs."}
          </p>
        </div>

        <ChatInterface
          herbContext={herbContext}
          autoQuery={autoQuery}
          locale={locale}
        />
        <div className="mt-8">
          <NewsletterSignup locale={locale === "fr" ? "fr" : "en"} />
        </div>
        <div className="mt-8">
          <ContinueExploring />
        </div>
      </div>
    </ToolsMessagesProvider>
  );
}
