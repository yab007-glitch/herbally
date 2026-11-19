import { buildPageMetadata } from "@/lib/i18n/metadata";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { WebPageSchema } from "@/components/seo/webpage-schema";
import { BreadcrumbListSchema } from "@/components/seo/breadcrumb-list-schema";
import { siteUrl } from "@/lib/seo/site-url";
import { getTranslations } from "next-intl/server";
import { getLocale } from "@/lib/i18n/page-locale";

export const generateMetadata = () =>
  buildPageMetadata({
    titleKey: "termsOfService",
    descKey: "termsDesc",
    path: "/terms",
  });

export default async function TermsPage() {
  const locale = await getLocale();
  const t = await getTranslations({ locale });
  const prefix = locale === "fr" ? "/fr" : "";
  const url = `${siteUrl()}${prefix}/terms`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <WebPageSchema
        title={t("terms.title")}
        description={t("meta.termsDesc")}
        url={url}
        breadcrumbs={[
          { name: t("common.home"), url: siteUrl() },
          { name: t("terms.title"), url },
        ]}
      />
      <BreadcrumbListSchema
        items={[
          { name: "Home", url: "/" },
          { name: t("terms.title"), url: "/terms" },
        ]}
      />
      <h1 className="mb-2 text-3xl font-bold tracking-tight text-foreground">
        {t("terms.title")}
      </h1>
      <p className="mb-8 text-sm text-muted-foreground">
        {t("terms.lastUpdated")}
      </p>

      <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            {t("terms.acceptance.title")}
          </h2>
          <p>{t("terms.acceptance.text")}</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            {t("terms.useOfService.title")}
          </h2>
          <p>{t("terms.useOfService.text")}</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>{t("terms.useOfService.items.0")}</li>
            <li>{t("terms.useOfService.items.1")}</li>
            <li>{t("terms.useOfService.items.2")}</li>
            <li>{t("terms.useOfService.items.3")}</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            {t("terms.medicalDisclaimer.title")}
          </h2>
          <p>{t("terms.medicalDisclaimer.text")}</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            {t("terms.aiLimitations.title")}
          </h2>
          <p>{t("terms.aiLimitations.text")}</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>{t("terms.aiLimitations.items.0")}</li>
            <li>{t("terms.aiLimitations.items.1")}</li>
            <li>{t("terms.aiLimitations.items.2")}</li>
            <li>{t("terms.aiLimitations.items.3")}</li>
            <li>{t("terms.aiLimitations.items.4")}</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            {t("terms.intellectualProperty.title")}
          </h2>
          <p>{t("terms.intellectualProperty.text")}</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            {t("terms.limitation.title")}
          </h2>
          <p>{t("terms.limitation.text")}</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            {t("terms.userContent.title")}
          </h2>
          <p>{t("terms.userContent.text")}</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            {t("terms.serviceAvailability.title")}
          </h2>
          <p>{t("terms.serviceAvailability.text")}</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            {t("terms.changes.title")}
          </h2>
          <p>{t("terms.changes.text")}</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            {t("terms.contact.title")}
          </h2>
          <p>{t("terms.contact.text")}</p>
          <p className="mt-4 flex flex-wrap gap-4 text-xs">
            <Link
              href="/editorial-policy"
              className="text-primary hover:underline"
            >
              {t("footer.editorialPolicy")}
            </Link>
            <Link href="/disclaimer" className="text-primary hover:underline">
              {t("footer.disclaimer")}
            </Link>
            <Link href="/privacy" className="text-primary hover:underline">
              {t("footer.privacy")}
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
