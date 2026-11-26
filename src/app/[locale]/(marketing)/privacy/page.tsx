import { buildPageMetadata } from "@/lib/i18n/metadata";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { WebPageSchema } from "@/components/seo/webpage-schema";
import { BreadcrumbListSchema } from "@/components/seo/breadcrumb-list-schema";
import { siteUrl } from "@/lib/seo/site-url";
import { getTranslations } from "next-intl/server";
import { getLocale } from "@/lib/i18n/page-locale";
import { MarketingMessagesProvider } from "@/components/i18n/marketing-messages-provider";
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
    <MarketingMessagesProvider locale={locale}>
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <WebPageSchema
          title={t("privacy.title")}
          description={t("meta.privacyDesc")}
          url={url}
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
              <li>{t("privacy.thirdParty.linkedinSso")}</li>
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
              <li>{t("privacy.cookiesSection.linkedinCookie")}</li>
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

          <section aria-labelledby="subprocessors-heading">
            <h2
              id="subprocessors-heading"
              className="mb-3 text-lg font-semibold text-foreground"
            >
              {locale === "fr"
                ? "Sous-traitants, données traitées, conservation et suppression"
                : "Sub-processors, data flows, retention, and deletion controls"}
            </h2>
            <p className="mb-3">
              {locale === "fr"
                ? "Tableau récapitulatif des prestataires techniques utilisés par HerbAlly, de leur rôle exact et des durées de conservation applicables (Loi 25 du Québec et LPRPDE)."
                : "Transparent register of the infrastructure and third-party processors HerbAlly relies on, the limited data each receives, and retention/deletion rules under Quebec Law 25 and PIPEDA."}
            </p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="border-b border-border bg-muted/40 text-foreground">
                  <tr>
                    <th className="px-3 py-2 font-semibold">
                      {locale === "fr" ? "Prestataire" : "Processor"}
                    </th>
                    <th className="px-3 py-2 font-semibold">
                      {locale === "fr"
                        ? "Finalité et données"
                        : "Purpose & Data Sent"}
                    </th>
                    <th className="px-3 py-2 font-semibold">
                      {locale === "fr"
                        ? "Conservation / Suppression"
                        : "Retention & Deletion"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  <tr>
                    <td className="px-3 py-2 font-medium text-foreground">
                      Supabase (PostgreSQL)
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "Base de données des plantes/interactions, comptes utilisateurs optionnels, requêtes LinkedIn SSO et incidents (aucun dossier médical nominatif permis)."
                        : "Reference botanical/interaction DB, optional signed-in accounts, LinkedIn SSO edit requests, and safety incident triage logs (no patient PHI permitted)."}
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "Compte conservé jusqu'à suppression sur demande à privacy@herbally.app ; journaux de limitation de débit à court terme."
                        : "Account data retained until deletion request to privacy@herbally.app; transient rate-limit records expire automatically."}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium text-foreground">
                      Cloudflare
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "DNS, pare-feu applicatif (WAF), protection DDoS et mise en cache CDN des pages publiques."
                        : "DNS, WAF, DDoS mitigation, and CDN caching of public pages (request IP & TLS metadata)."}
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "Journaux sécurité transitoires selon la fenêtre Cloudflare ; aucune conservation d'historique clinique."
                        : "Transient edge security logs per Cloudflare window; zero storage of herbal or health queries."}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium text-foreground">
                      {locale === "fr"
                        ? "Serveur d'hébergement Next.js (KVM)"
                        : "Application Runtime Server (KVM)"}
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "Exécution des routes applicatives ; les textes de recherche symptomatique et de chat ne sont pas consignés dans les journaux applicatifs."
                        : "Executes SSR & API routes; symptom search terms and chat messages are scrubbed from server error logs."}
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "Journaux opérationnels sans données personnelles conservés en rotation limitée."
                        : "Rotating operational logs without personal query strings."}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium text-foreground">
                      Ollama Cloud
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "Inférence IA pour l'Herboriste Virtuel et l'extraction de mots-clés symptomatiques (requêtes soumises sans identifiant nominatif)."
                        : "LLM inference for Virtual Herbalist & symptom keyword extraction (sent without user name, email, or account ID)."}
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "Cache anonyme court de réponses éducatives générales ; aucun historique de conversation associé à votre identité."
                        : "Anonymous cached general Q&A only; personal conversations remain in your browser until you clear local data."}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium text-foreground">
                      {locale === "fr"
                        ? "Santé Canada LNHPD API"
                        : "Health Canada LNHPD API"}
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "Numéro NPN à 8 chiffres transmis côté serveur pour consulter la licence publique officielle."
                        : "8-digit NPN sent server-side to query the official public Natural Health Products database."}
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "Réponse mise en cache 1 heure côté serveur ; aucun identifiant personnel transmis."
                        : "Public licence metadata cached up to 1 hour; no personal identifier transmitted."}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium text-foreground">
                      LinkedIn OpenID Connect
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "Nom, identifiant OpenID et courriel vérifié uniquement lorsque vous choisissez de vous connecter pour suggérer une correction."
                        : "Name, OpenID subject, and verified email only when you explicitly sign in to submit a monograph or interaction edit suggestion."}
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "Jeton de session chiffré HttpOnly (courte durée) ; retrait sur demande à privacy@herbally.app."
                        : "HttpOnly encrypted session cookie only; attribution/request records deleted on verified request to privacy@herbally.app."}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium text-foreground">
                      Google AdSense
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "Chargé uniquement après consentement explicite via la bannière de cookies ; désactivé sur les pages outils cliniques sensibles."
                        : "Loaded only after explicit cookie consent on eligible content pages; suppressed on sensitive clinical tool flows."}
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "Révocable à tout moment via la réinitialisation du consentement."
                        : "Controlled via browser consent settings and Clear Local Data control below."}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium text-foreground">
                      Resend (Email)
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "Courriels transactionnels de contact ou notifications administratives lorsque vous nous écrivez."
                        : "Transactional contact/notification email delivery when contacting support."}
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "Conservé selon la durée de traitement du dossier puis supprimé sur demande."
                        : "Retained only for support resolution and deleted upon request."}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="law25-governance-heading">
            <h2
              id="law25-governance-heading"
              className="mb-3 text-lg font-semibold text-foreground"
            >
              {locale === "fr"
                ? "Responsable de la protection des renseignements personnels (Loi 25)"
                : "Privacy Officer & Incident Response (Quebec Law 25 / PIPEDA)"}
            </h2>
            <p>
              {locale === "fr"
                ? "Responsable désigné : Yasser Bheekun — contact direct à privacy@herbally.app pour toute demande d'accès, de rectification ou de suppression (réponse visée sous 30 jours). En cas d'incident de confidentialité présentant un risque de préjudice sérieux, HerbAlly documente l'incident, applique les mesures d'atténuation immédiates et avise sans délai la Commission d'accès à l'information (CAI) ainsi que les personnes concernées."
                : "Designated Privacy Officer: Yasser Bheekun (privacy@herbally.app). Access, correction, or deletion requests are handled within 30 days. If a confidentiality incident creates a risk of serious injury, HerbAlly logs the incident, mitigates exposure immediately, and notifies affected individuals and the Commission d'accès à l'information du Québec (CAI) / relevant regulator without undue delay."}
            </p>
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
    </MarketingMessagesProvider>
  );
}
