import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Medical Disclaimer",
  description: "Read the full medical and FDA disclaimer for HerbAlly.",
  alternates: { canonical: "https://herbally.app/disclaimer" },
  openGraph: {
    title: "Medical Disclaimer",
    description: "Read the full medical and FDA disclaimer for HerbAlly.",
    url: "https://herbally.app/disclaimer",
    type: "website",
    siteName: "HerbAlly",
  },
};

export default async function DisclaimerPage() {
    const t = await getTranslations();

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-8 text-center">
        <div className="mb-4 inline-flex size-14 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          <AlertTriangle className="size-7" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {t("disclaimer.title")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("disclaimer.text")}</p>
      </div>

      <div className="prose prose-sm max-w-none dark:prose-invert">
        <p className="text-muted-foreground leading-relaxed">
          {t("disclaimer.consult")}
        </p>
        <p className="text-muted-foreground leading-relaxed">
          {t("disclaimer.fda")}
        </p>
        <p className="text-muted-foreground leading-relaxed">
          {t("disclaimer.emergency")}
        </p>
        <p className="text-muted-foreground leading-relaxed">
          {t("disclaimer.reliance")}
        </p>
      </div>
    </div>
  );
}
