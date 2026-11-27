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
                ? "Tableau récapitulatif des prestataires techniques utilisés par HerbAlly, de leur rôle exact et des durées de conservation applicables (Loi 25 du Québec et LPRPDE). Également publié en JSON lisible par machine :"
                : "Transparent register of the infrastructure and third-party processors HerbAlly relies on, the limited data each receives, and retention/deletion rules under Quebec Law 25 and PIPEDA. Also published as a machine-readable JSON manifest:"}{" "}
              <a
                href="/open-data/privacy-manifest.json"
                className="font-mono text-xs font-medium text-primary underline underline-offset-4"
              >
                /open-data/privacy-manifest.json
              </a>
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
                      Supabase (PostgreSQL — Montreal, QC)
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "Base de référence (plantes/interactions), comptes optionnels, sessions invitées pseudonymes de chat, requêtes LinkedIn SSO et journal d'incidents (aucun dossier médical nominatif permis)."
                        : "Reference DB, optional signed-in accounts, pseudonymous guest chat sessions, LinkedIn SSO edit requests, and incident logs (no patient PHI permitted)."}
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "Comptes conservés jusqu'à suppression (privacy@herbally.app) ; sessions invitées sur échéance explicite de 30 jours (retention_expires_at) ; cache public sans identifiant (ai_response_cache) expirant sous 7 jours."
                        : "Account data retained until deletion request (privacy@herbally.app); guest chat sessions carry an explicit 30-day retention_expires_at schedule; unlinked single-turn public ai_response_cache expires in 7 days."}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium text-foreground">
                      Cloudflare (Edge CDN / WAF · Cross-border)
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "DNS, pare-feu applicatif (WAF), protection DDoS et mise en cache CDN des pages publiques (adresse IP et métadonnées TLS)."
                        : "DNS, WAF, DDoS mitigation, and CDN caching of public pages (request IP & TLS metadata; processed across edge nodes outside Quebec)."}
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "Journaux sécurité transitoires selon la fenêtre Cloudflare ; aucune conservation d'historique de chat ou de symptôme."
                        : "Transient edge security logs per Cloudflare window; zero retention of herbal or symptom query bodies."}
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
                        ? "Exécution des routes SSR et API ; les textes symptomatiques et questions de chat sont purgés des journaux applicatifs."
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
                      Ollama Cloud (AI Processor · Cross-border)
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "Inférence IA pour l'Herboriste Virtuel et l'extraction de mots-clés symptomatiques (requêtes soumises sans nom, courriel ni identifiant de compte)."
                        : "LLM inference for Virtual Herbalist & symptom keyword extraction (relayed outside Quebec without user name, email, or account ID)."}
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "Sous-traitant d'inférence sans conservation par HerbAlly au-delà de l'appel API (session invitée stockée 30 jours dans Supabase ci-dessus ou supprimée immédiatement par l'utilisateur ; réglages locaux effaçables dans le navigateur)."
                        : "Infers ephemerally per request (provider policy governs transit); saved guest sessions follow Supabase's 30-day schedule above and immediate Delete Chat removes them sooner."}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium text-foreground">
                      Upstash Redis (Rate Limiting · Cross-border)
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "Compteurs de limitation de débit (empreinte IP/route hachée à court terme) pour protéger les API."
                        : "Short-lived hashed rate-limit counters preventing abuse on chat, search, and NPN endpoints."}
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "Expiration automatique par fenêtre glissante (60 secondes à quelques heures)."
                        : "Expires automatically on sliding TTL windows (seconds to hours)."}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium text-foreground">
                      {locale === "fr"
                        ? "Santé Canada LNHPD API (Canada — Tiers indépendant)"
                        : "Health Canada LNHPD API (Canada — Independent Registry)"}
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "Numéro NPN à 8 chiffres transmis côté serveur pour consulter la licence publique officielle."
                        : "8-digit NPN sent server-side to query the official public Natural Health Products database."}
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "Réponse publique mise en cache 1 heure côté serveur ; aucun identifiant personnel transmis."
                        : "Public licence metadata cached up to 1 hour; no personal identifier transmitted."}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium text-foreground">
                      Sentry (Telemetry · Cross-border)
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "Rapports d'erreurs techniques nettoyés de toute donnée personnelle, paramètre URL sensible ou corps de requête santé."
                        : "Runtime error diagnostics pre-scrubbed to strip cookies, query strings, health terms, and personal fields."}
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "Fenêtre de rétention standard des erreurs techniques (sans historique utilisateur)."
                        : "Standard technical error window; zero user profile or chat storage."}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium text-foreground">
                      Stripe (Payments · Cross-border)
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "Traitement sécurisé des dons volontaires sur /donate ; HerbAlly ne stocke aucun numéro de carte."
                        : "Processes voluntary donations on /donate only; HerbAlly never receives or stores payment card numbers."}
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "Pièces comptables conservées selon les obligations fiscales applicables."
                        : "Donation ledger metadata retained only as required for tax/accounting compliance."}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium text-foreground">
                      Zoho Mail (Support Email)
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "Boîte de réception et réponses lorsque vous écrivez à info@herbally.app ou privacy@herbally.app."
                        : "Handles inbound support and privacy correspondence sent to info@herbally.app or privacy@herbally.app."}
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "Conservé le temps du suivi du dossier puis supprimé sur demande."
                        : "Retained only for issue resolution and deleted upon verified request."}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium text-foreground">
                      LinkedIn OpenID Connect (SSO · Cross-border)
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "Nom, identifiant OpenID et courriel vérifié uniquement lorsque vous choisissez de vous connecter sur /clinical-review."
                        : "Name, OpenID subject, and verified email only when you opt in to authenticate on /clinical-review."}
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "Jeton de session chiffré HttpOnly de courte durée ; suppression sur demande à privacy@herbally.app."
                        : "Short-lived HttpOnly encrypted session cookie only; edit records deleted on request to privacy@herbally.app."}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-medium text-foreground">
                      Google AdSense (Independent Third Party · Consent-Gated)
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "Actuellement inactif. Si activé ultérieurement après consentement explicite, limité aux pages publiques standard de plantes ; strictement désactivé sur tous les outils de santé, tous les widgets intégrables (/embed/*) et toutes les pages de plantes toxiques en quarantaine."
                        : "Not currently active (launch gate off). If enabled in future after explicit cookie consent, restricted to standard public herb reference pages only; permanently suppressed on all clinical/health-input tools, all embedded widgets (/embed/*), and all quarantined toxic botanical pages."}
                    </td>
                    <td className="px-3 py-2">
                      {locale === "fr"
                        ? "Révocable à tout moment via la réinitialisation du consentement."
                        : "Revocable anytime via cookie consent controls and Clear Local Data below."}
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
              <Link href="/trust" className="text-primary hover:underline">
                {locale === "fr"
                  ? "Sécurité et vérification"
                  : "Security & Verification"}
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
