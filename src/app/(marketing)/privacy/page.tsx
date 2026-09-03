import { buildPageMetadata } from "@/lib/i18n/metadata";
import { getTranslations } from "next-intl/server";
import { getLocaleFromRequest } from "@/lib/i18n/server-locale";
import { BreadcrumbListSchema } from "@/components/seo/breadcrumb-list-schema";

export const generateMetadata = () =>
  buildPageMetadata({ titleKey: "privacyPolicy", path: "/privacy" });

export default async function PrivacyPage() {
  const locale = await getLocaleFromRequest();
  const t = await getTranslations({ locale });

  const howWeUseItems = [
    t("privacy.howWeUse.items.0"),
    t("privacy.howWeUse.items.1"),
    t("privacy.howWeUse.items.2"),
    t("privacy.howWeUse.items.3"),
    t("privacy.howWeUse.items.4"),
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <BreadcrumbListSchema
        items={[
          { name: t("common.breadcrumbHome"), url: "/" },
          { name: t("privacy.title"), url: "/privacy" },
        ]}
      />
      <h1 className="mb-2 text-3xl font-bold tracking-tight text-foreground">
        {t("privacy.title")}
      </h1>
      <p className="mb-8 text-sm text-muted-foreground">
        {t("privacy.lastUpdated")}
      </p>

      <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            {t("privacy.overview.title")}
          </h2>
          <p>{t("privacy.overview.text")}</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            {t("privacy.infoWeCollect.title")}
          </h2>
          <p>{t("privacy.infoWeCollect.text")}</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>
              <strong>
                {locale === "fr"
                  ? "Messages de discussion :"
                  : "Chat messages:"}
              </strong>{" "}
              {t("privacy.infoWeCollect.chatMessages")}
            </li>
            <li>
              <strong>
                {locale === "fr"
                  ? "Analytique d\u2019utilisation :"
                  : "Usage analytics:"}
              </strong>{" "}
              {t("privacy.infoWeCollect.analytics")}
            </li>
            <li>
              <strong>{locale === "fr" ? "Cookies :" : "Cookies:"}</strong>{" "}
              {t("privacy.infoWeCollect.cookies")}
            </li>
          </ul>
          <p className="mt-3">{t("privacy.infoWeCollect.notCollect")}</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            {t("privacy.howWeUse.title")}
          </h2>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {howWeUseItems.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            {t("privacy.thirdParty.title")}
          </h2>
          <p>{t("privacy.thirdParty.text")}</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>{t("privacy.thirdParty.supabase")}</li>
            <li>{t("privacy.thirdParty.openrouter")}</li>
            <li>{t("privacy.thirdParty.vercel")}</li>
            <li>{t("privacy.thirdParty.stripe")}</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            {t("privacy.cookiesSection.title")}
          </h2>
          <p>{t("privacy.cookiesSection.onlyOne")}</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>{t("privacy.cookiesSection.localeCookie")}</li>
          </ul>
          <p className="mt-3">{t("privacy.cookiesSection.noTracking")}</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            {t("privacy.dataRetention.title")}
          </h2>
          <p>{t("privacy.dataRetention.text")}</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            {t("privacy.yourRights.title")}
          </h2>
          <p>{t("privacy.yourRights.text")}</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>{t("privacy.yourRights.access")}</li>
            <li>{t("privacy.yourRights.deletion")}</li>
            <li>{t("privacy.yourRights.complaint")}</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            {t("privacy.security.title")}
          </h2>
          <p>{t("privacy.security.text")}</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            {t("privacy.changes.title")}
          </h2>
          <p>{t("privacy.changes.text")}</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            {t("privacy.contact.title")}
          </h2>
          <p>{t("privacy.contact.text")}</p>
        </section>
      </div>
    </div>
  );
}
