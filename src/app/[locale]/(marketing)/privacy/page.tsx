import { buildPageMetadata } from "@/lib/i18n/metadata";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { WebPageSchema } from "@/components/seo/webpage-schema";
import { BreadcrumbListSchema } from "@/components/seo/breadcrumb-list-schema";
import { siteUrl } from "@/lib/seo/site-url";
import { getTranslations } from "next-intl/server";
import { getLocale } from "@/lib/i18n/page-locale";
import { IntlMessagesScope } from "@/components/i18n/intl-messages-scope";
import { ClearLocalDataButton } from "@/components/privacy/clear-local-data-button";

export const generateMetadata = () =>
  buildPageMetadata({
    titleKey: "privacyPolicy",
    descKey: "privacyDesc",
    path: "/privacy",
  });

export default async function PrivacyPage() {
  const locale = await getLocale();
  const t = await getTranslations({ locale });
  const prefix = locale === "fr" ? "/fr" : "";
  const url = `${siteUrl()}${prefix}/privacy`;

  const howWeUseItems = [0, 1, 2, 3, 4, 5, 6].map((i) =>
    t(`privacy.howWeUse.items.${i}`)
  );

  return (
    <IntlMessagesScope locale={locale} scope="privacy">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <WebPageSchema
          title={t("privacy.title")}
          description={t("meta.privacyDesc")}
          url={url}
          breadcrumbs={[
            { name: t("common.home"), url: siteUrl() },
            { name: t("privacy.title"), url },
          ]}
        />
        <BreadcrumbListSchema
          items={[
            { name: "Home", url: "/" },
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
              <li>{t("privacy.thirdParty.vercel")}</li>
              <li>{t("privacy.thirdParty.ollamaCloud")}</li>
              <li>{t("privacy.thirdParty.upstash")}</li>
              <li>{t("privacy.thirdParty.sentry")}</li>
              <li>{t("privacy.thirdParty.stripe")}</li>
              <li>{t("privacy.thirdParty.zoho")}</li>
              <li>{t("privacy.thirdParty.adsense")}</li>
            </ul>
            <p className="mt-3">{t("privacy.thirdParty.crossBorder")}</p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              {t("privacy.cookiesSection.title")}
            </h2>
            <p>{t("privacy.cookiesSection.onlyOne")}</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>{t("privacy.cookiesSection.localeCookie")}</li>
              <li>{t("privacy.cookiesSection.guestCookie")}</li>
              <li>{t("privacy.cookiesSection.authCookies")}</li>
              <li>{t("privacy.cookiesSection.adCookies")}</li>
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
              <li>{t("privacy.yourRights.portability")}</li>
              <li>{t("privacy.yourRights.complaint")}</li>
            </ul>
            <ClearLocalDataButton />
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              {t("privacy.security.title")}
            </h2>
            <p>{t("privacy.security.text")}</p>
            <p className="mt-2">{t("privacy.security.breachNotice")}</p>
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
            <p>{t("privacy.contact.officer")}</p>
            <p className="mt-2">{t("privacy.contact.text")}</p>
            <p className="mt-4 flex flex-wrap gap-4 text-xs">
              <Link
                href="/editorial-policy"
                className="text-primary hover:underline"
              >
                {t("footer.editorialPolicy")}
              </Link>
              <Link href="/terms" className="text-primary hover:underline">
                {t("footer.terms")}
              </Link>
              <Link href="/contact" className="text-primary hover:underline">
                {t("footer.contact")}
              </Link>
            </p>
          </section>
        </div>
      </div>
    </IntlMessagesScope>
  );
}
