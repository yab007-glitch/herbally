import type { Metadata } from "next";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { getLocale } from "@/lib/i18n/page-locale";
import { siteUrl } from "@/lib/seo/site-url";
import { addLocalePrefix } from "@/lib/i18n/routing";
import { WebPageSchema } from "@/components/seo/webpage-schema";
import { BreadcrumbListSchema } from "@/components/seo/breadcrumb-list-schema";
import { getGovernanceCoverageStats } from "@/lib/governance/coverage-stats";
import { getAllDangerousHerbs } from "@/lib/data/dangerous-herbs";

export const revalidate = 3600;

const GITHUB_REPO = "https://github.com/yab007-glitch/herbally";

const TEST_SUITES = [
  {
    id: "A1",
    scopeEn: "Toxic botanical quarantine across all 115 registry records",
    scopeFr:
      "Quarantaine toxicologique sur l'ensemble des 115 plantes du registre",
    assertionEn:
      "Verifies ToxicQuarantineShell, Poison Control numbers (1-800-222-1222 / 1-844-764-7669 / 911), zero FAQ/dose/editorial/ad chrome, and Thing JSON-LD for every slug.",
    assertionFr:
      "Vérifie ToxicQuarantineShell, les numéros antipoison, l'absence de FAQ/dose/publicité et le balisage Thing JSON-LD pour chaque fiche.",
    file: "src/lib/safety/__tests__/quarantine-all-botanicals.test.ts",
  },
  {
    id: "A2",
    scopeEn: "Full EN/FR dictionary key-parity across all 6 i18n namespaces",
    scopeFr: "Parité complète des clés EN/FR sur les 6 dictionnaires i18n",
    assertionEn:
      "Recursive key-equality and non-empty string verification across core, clinical, herbs, marketing, server, and tools dictionaries.",
    assertionFr:
      "Égalité récursive des clés et validation des chaînes non vides sur les 6 fichiers JSON EN et FR.",
    file: "src/lib/i18n/__tests__/dictionary-parity.test.ts",
  },
  {
    id: "A3/A4",
    scopeEn:
      "Open Data CORS JSON catalog, medications, interactions, quarantine & OpenAPI 3.1 schema",
    scopeFr:
      "API Open Data JSON CORS (catalogue, médicaments, interactions, quarantaine, schéma OpenAPI 3.1)",
    assertionEn:
      "Verifies CORS headers, Poison Control metadata, honest clinicianSigned=false flags, and OpenAPI 3.1.0 path definitions.",
    assertionFr:
      "Vérifie les en-têtes CORS, les contacts antipoison, le statut clinicianSigned=false honnête et les routes OpenAPI 3.1.0.",
    file: "src/app/open-data/open-data.test.ts",
  },
  {
    id: "A5",
    scopeEn: "Interaction checker & multi-herb stack API edge cases",
    scopeFr: "Cas limites API du vérificateur simple et multi-plantes",
    assertionEn:
      "Tests 400 validation, 413 payload caps, 429 Retry-After rate limits, 503 DB fail-closed behavior, withheld retracted citations, and unknown pairs never marked safe.",
    assertionFr:
      "Teste validations 400, limites 413, limitation de débit 429, indisponibilité 503, rétention de citations retirées et absence != innocuité.",
    file: "src/app/api/interactions/check/route.test.ts",
  },
  {
    id: "A5-stack",
    scopeEn: "Multi-herb × multi-medication stack API route",
    scopeFr: "Route API d'analyse simultanée multi-plantes × médicaments",
    assertionEn:
      "Validates duplicate deduplication, collision handling, 10-item array caps, retracted holds, and severity sorting.",
    assertionFr:
      "Valide la déduplication, la gestion de collisions, la limite de 10 éléments, les citations retirées et le tri par gravité.",
    file: "src/app/api/interactions/check-stack/route.test.ts",
  },
  {
    id: "A7",
    scopeEn: "PostgreSQL RLS, approval-reset triggers & pediatric lockdown SQL",
    scopeFr:
      "Verrous PostgreSQL RLS, réinitialisation d'approbation et blocage pédiatrique",
    assertionEn:
      "Verifies AAL2 MFA admin RLS, interaction publication triggers, clinical edit review-reset triggers, and adult-only dosage constraints.",
    assertionFr:
      "Vérifie les politiques RLS AAL2, déclencheurs de publication et de révision clinique, et la contrainte adulte 18+.",
    file: "src/lib/db/__tests__/db-governance-triggers.test.ts",
  },
  {
    id: "A6/E2E",
    scopeEn:
      "Cross-surface acceptance, ad-exclusion & red-flag emergency escalation",
    scopeFr:
      "Invariants transversaux, exclusion publicitaire et signaux d'urgence",
    assertionEn:
      "Verifies zero ad scripts/cookies on embeds, toxic botanicals & health tools, plus WCAG 2.1 AA Axe & Chromium/Firefox Playwright verification.",
    assertionFr:
      "Vérifie l'absence de publicité sur /embed/*, fiches toxiques et outils, plus les tests Playwright WCAG 2.1 AA.",
    file: "src/lib/safety/__tests__/audit-acceptance-invariants.test.ts",
  },
] as const;

const MIGRATIONS = [
  {
    file: "00097_admin_aal2_rls.sql",
    summaryEn:
      "Enforces AAL2 MFA verification alongside admin role in PostgreSQL RLS policies for catalog and telemetry tables.",
    summaryFr:
      "Exige une session MFA AAL2 en plus du rôle administrateur dans les politiques RLS PostgreSQL.",
  },
  {
    file: "00101_interaction_publication_contract.sql",
    summaryEn:
      "Separates normalized single-ingredient drug entities vs drug classes, enforces clinician approval before clinical action flags, and auto-holds interactions on retracted citations.",
    summaryFr:
      "Sépare molécules individuelles et classes thérapeutiques, exige une validation clinicienne pour les conduites cliniques et retient les fiches sur citation rétractée.",
  },
  {
    file: "00102_scientific_governance_and_incidents.sql",
    summaryEn:
      "Creates immutable clinical revision logs, triggers resetting review badges upon clinical field edits, verified reviewer registry, and SLA-tracked safety incident logs.",
    summaryFr:
      "Crée l'historique immuable des révisions cliniques, réinitialise le statut de révision lors de modifications et suit les incidents de sécurité avec SLA.",
  },
  {
    file: "00103_privacy_minimization_controls.sql",
    summaryEn:
      "Adds explicit opt-in consent ledger and 30-day retention expiration timestamps for guest chat and lookup records.",
    summaryFr:
      "Ajoute le registre de consentement explicite et les délais de conservation de 30 jours pour les sessions invitées.",
  },
  {
    file: "00104_pediatric_boundary_contract.sql",
    summaryEn:
      "Locks dosage storage to confirmed adults (age 18–120) with adult_reference formula only and revokes direct anon SELECT access on raw pediatric columns.",
    summaryFr:
      "Verrouille le stockage posologique aux adultes (18–120 ans) et révoque l'accès direct aux colonnes pédiatriques brutes.",
  },
  {
    file: "00105_clinical_edit_requests.sql",
    summaryEn:
      "Stores LinkedIn OIDC-authenticated clinician edit suggestions in a fail-closed triage queue without mutating live tables.",
    summaryFr:
      "Enregistre les suggestions de révision authentifiées via LinkedIn OIDC dans une file de triage sans modification directe.",
  },
  {
    file: "00108_perioperative_and_toxic_safety_reconciliation.sql",
    summaryEn:
      "Replaces unqualified perioperative stoppage directives with clinician-coordinated disclosure language and reinforces lethal abrin non-ingestion warnings.",
    summaryFr:
      "Remplace les directives d'arrêt préopératoire non nuancées par une divulgation coordonnée et renforce les avertissements toxicologiques mortels.",
  },
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) === "fr" ? "fr" : "en";
  const path = addLocalePrefix("/trust", locale);
  const title =
    locale === "fr"
      ? "Centre de sécurité, vérification automatisée et architecture"
      : "Security, Engineering & Automated Verification Center";
  const description =
    locale === "fr"
      ? "Preuves vérifiables publiquement : code source GitHub, pipelines CI/CD, contrôles de sécurité HTTP, déclencheurs PostgreSQL, tests automatisés et limites d'audit clinique d'HerbAlly."
      : "Publicly verifiable engineering evidence: open GitHub source and CI pipelines, HTTP security headers, PostgreSQL governance triggers, automated safety tests, backup architecture, and honest clinical review boundaries.";

  return {
    title,
    description,
    alternates: {
      canonical: `${siteUrl()}${path}`,
      languages: {
        en: `${siteUrl()}/trust`,
        fr: `${siteUrl()}/fr/trust`,
        "x-default": `${siteUrl()}/trust`,
      },
    },
    openGraph: {
      title,
      description,
      url: `${siteUrl()}${path}`,
      type: "website",
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
  };
}

export default async function TrustCenterPage() {
  const locale = (await getLocale()) === "fr" ? "fr" : "en";
  const fr = locale === "fr";
  const baseUrl = siteUrl();
  const pageUrl = `${baseUrl}${fr ? "/fr" : ""}/trust`;
  const [stats, dangerousCount] = await Promise.all([
    getGovernanceCoverageStats(),
    Promise.resolve(getAllDangerousHerbs().length),
  ]);

  const title = fr
    ? "Centre de sécurité, vérification automatisée et architecture"
    : "Security, Engineering & Automated Verification Center";
  const description = fr
    ? "Dépôt GitHub public, pipelines CI/CD, suites de tests de sécurité A1–A7, en-têtes HTTP, verrous PostgreSQL, sauvegardes chiffrées et limites transparentes."
    : "Public GitHub source, CI/CD verification pipelines, automated safety test suites, HTTP security headers, fail-closed PostgreSQL triggers, encrypted backups, and transparent audit boundaries.";

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <WebPageSchema title={title} description={description} url={pageUrl} />
      <BreadcrumbListSchema
        items={[
          { name: fr ? "Accueil" : "Home", url: "/" },
          {
            name: fr ? "Sécurité et vérification" : "Security & Verification",
            url: "/trust",
          },
        ]}
      />

      <header className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          {fr
            ? "Vérification technique publique"
            : "Public Technical Verification"}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
          {description}
        </p>
      </header>

      <div className="mt-10 space-y-10 text-sm leading-relaxed text-muted-foreground">
        {/* 1. Live Governance & Dataset Verification Snapshot */}
        <section
          id="live-snapshot"
          aria-labelledby="live-snapshot-heading"
          className="rounded-xl border border-border bg-card p-5 sm:p-6"
        >
          <h2
            id="live-snapshot-heading"
            className="text-xl font-semibold text-foreground"
          >
            {fr
              ? "1. Compteurs en direct et jeux de données ouverts"
              : "1. Live Governance & Open Data Snapshot"}
          </h2>
          <p className="mt-2">
            {fr
              ? "Tous les compteurs ci-dessous sont lus directement depuis la base de données PostgreSQL et le registre toxicologique en production."
              : "All counters below are queried live from the production PostgreSQL views and static toxicology quarantine registry."}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border/80 bg-background p-3">
              <p className="text-xs text-muted-foreground">
                {fr ? "Fiches de plantes publiées" : "Published Herb Profiles"}
              </p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {stats.available
                  ? stats.totalHerbs.toLocaleString(fr ? "fr-CA" : "en-US")
                  : "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {stats.available
                  ? fr
                    ? `${stats.sourceCheckedHerbs.toLocaleString("fr-CA")} vérifiées sur sources`
                    : `${stats.sourceCheckedHerbs.toLocaleString("en-US")} primary-source checked`
                  : "DB metrics unavailable"}
              </p>
            </div>
            <div className="rounded-lg border border-border/80 bg-background p-3">
              <p className="text-xs text-muted-foreground">
                {fr ? "Paires plante–médicament" : "Curated Interaction Pairs"}
              </p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {stats.available
                  ? stats.totalInteractions.toLocaleString(
                      fr ? "fr-CA" : "en-US"
                    )
                  : "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {stats.available
                  ? fr
                    ? `${stats.totalMedications} médicaments et classes`
                    : `${stats.totalMedications} medications & drug classes`
                  : "DB metrics unavailable"}
              </p>
            </div>
            <div className="rounded-lg border border-border/80 bg-background p-3">
              <p className="text-xs text-muted-foreground">
                {fr
                  ? "Quarantaine toxique & validation clinique"
                  : "Toxic Quarantine & Clinician Sign-Off"}
              </p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {dangerousCount} / {stats.clinicianApprovedInteractions}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {fr
                  ? `${dangerousCount} plantes en quarantaine · ${stats.clinicianApprovedInteractions} validations cliniciennes externes`
                  : `${dangerousCount} quarantined plants · ${stats.clinicianApprovedInteractions} external clinician sign-offs`}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs font-medium">
            <a
              href="/open-data/catalog.json"
              className="text-primary underline underline-offset-4"
            >
              /open-data/catalog.json
            </a>
            <a
              href="/open-data/medications.json"
              className="text-primary underline underline-offset-4"
            >
              /open-data/medications.json
            </a>
            <a
              href="/open-data/interactions.json"
              className="text-primary underline underline-offset-4"
            >
              /open-data/interactions.json
            </a>
            <a
              href="/open-data/quarantine.json"
              className="text-primary underline underline-offset-4"
            >
              /open-data/quarantine.json
            </a>
            <a
              href="/open-data/schema.json"
              className="text-primary underline underline-offset-4"
            >
              /open-data/schema.json (OpenAPI 3.1)
            </a>
          </div>
        </section>

        {/* 2. Open Source & Continuous Verification */}
        <section id="open-source-ci" aria-labelledby="open-source-ci-heading">
          <h2
            id="open-source-ci-heading"
            className="text-xl font-semibold text-foreground"
          >
            {fr
              ? "2. Code source public et intégration continue (CI/CD)"
              : "2. Public Source Code & Continuous Verification (CI/CD)"}
          </h2>
          <p className="mt-2">
            {fr
              ? "L'ensemble du code applicatif, des migrations PostgreSQL et des suites de tests automatisés est publiquement consultable sur GitHub. Aucune mise en production sur main n'est exécutée sans validation préalable des contrôles CI."
              : "All application source code, PostgreSQL migrations, and automated test suites are publicly inspectable on GitHub. Every production deploy from main is gated on green GitHub Actions CI checks."}
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <a
                href={GITHUB_REPO}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline underline-offset-4"
              >
                {GITHUB_REPO}
              </a>{" "}
              —{" "}
              {fr
                ? "Dépôt source public Next.js / TypeScript / PostgreSQL"
                : "Public Next.js / TypeScript / PostgreSQL source repository"}
            </li>
            <li>
              <a
                href={`${GITHUB_REPO}/blob/main/.github/workflows/ci.yml`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline underline-offset-4"
              >
                .github/workflows/ci.yml
              </a>{" "}
              —{" "}
              {fr
                ? "Détection de secrets (Gitleaks), vérification SQL, relecture complète PostgreSQL 16 (00001–00108), lint, typecheck, Prettier, Vitest, build Next.js, E2E Playwright (Chromium et Firefox) et accessibilité Axe WCAG 2.1 AA."
                : "Secret scan, SQL migration linter, targeted & full PostgreSQL 16 migration replay, ESLint, TypeScript check, Prettier format check, Vitest unit/integration suite, Next.js production build, Playwright Chromium/Firefox E2E, and Axe WCAG checks."}
            </li>
            <li>
              <a
                href={`${GITHUB_REPO}/blob/main/.github/workflows/deploy.yml`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline underline-offset-4"
              >
                .github/workflows/deploy.yml
              </a>{" "}
              —{" "}
              {fr
                ? "Déploiement en production déclenché uniquement sur CI vert sur main, sauvegarde d'image herbally-app:rollback et bascule atomique."
                : "Production deploy triggered only after green main CI, tagging herbally-app:rollback before atomic container replacement and health checks."}
            </li>
            <li>
              <a
                href={`${GITHUB_REPO}/blob/main/.github/workflows/uptime-watch.yml`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline underline-offset-4"
              >
                .github/workflows/uptime-watch.yml
              </a>{" "}
              —{" "}
              {fr
                ? "Surveillance périodique de disponibilité des routes publiques."
                : "Scheduled availability checks across public production endpoints."}
            </li>
          </ul>
        </section>

        {/* 3. Automated Safety & Parity Test Matrix */}
        <section id="automated-tests" aria-labelledby="automated-tests-heading">
          <h2
            id="automated-tests-heading"
            className="text-xl font-semibold text-foreground"
          >
            {fr
              ? "3. Matrice des tests automatisés de sécurité et parité"
              : "3. Automated Safety & Parity Test Matrix"}
          </h2>
          <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-foreground">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">ID</th>
                  <th className="px-3 py-2.5 font-semibold">
                    {fr ? "Portée vérifiée" : "Verified Scope"}
                  </th>
                  <th className="px-3 py-2.5 font-semibold">
                    {fr ? "Fichier de test public" : "Public Test File"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {TEST_SUITES.map((suite) => (
                  <tr key={suite.id}>
                    <td className="px-3 py-2.5 font-mono font-semibold text-foreground">
                      {suite.id}
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-foreground">
                        {fr ? suite.scopeFr : suite.scopeEn}
                      </p>
                      <p className="mt-0.5 text-muted-foreground">
                        {fr ? suite.assertionFr : suite.assertionEn}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <a
                        href={`${GITHUB_REPO}/blob/main/${suite.file}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-primary underline underline-offset-4"
                      >
                        {suite.file}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 4. Security Controls, HTTP Headers & Privacy Architecture */}
        <section
          id="security-architecture"
          aria-labelledby="security-architecture-heading"
        >
          <h2
            id="security-architecture-heading"
            className="text-xl font-semibold text-foreground"
          >
            {fr
              ? "4. Architecture de sécurité applicative et confidentialité"
              : "4. Application Security Controls & Privacy Architecture"}
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground">
                {fr
                  ? "En-têtes HTTP stricts :"
                  : "Strict HTTP Security Headers:"}
              </strong>{" "}
              {fr
                ? "HSTS preload (max-age=63072000), X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, Permissions-Policy désactivant caméra/micro/géolocalisation, X-Frame-Options: DENY par défaut et Content-Security-Policy dynamique dans src/proxy.ts (frame-ancestors * autorisé uniquement sur /embed/*)."
                : "HSTS preload (max-age=63072000; includeSubDomains; preload), X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, Permissions-Policy disabling camera/microphone/geolocation, X-Frame-Options: DENY across main pages, and per-request Content-Security-Policy in src/proxy.ts granting frame-ancestors * exclusively to /embed/*."}
            </li>
            <li>
              <strong className="text-foreground">
                {fr
                  ? "Isolation publicitaire et zéro témoin traceur :"
                  : "Ad Exclusion & Zero Marketing Cookies:"}
              </strong>{" "}
              {fr
                ? "ADS_LAUNCH_GATE est codé en dur à false dans src/lib/ads/policy.ts. De plus, la liste SENSITIVE_PREFIXES bloque définitivement tout hôte publicitaire dans la CSP des outils de santé (/calculator, /symptoms, /surgery-planner, /npn-checker, /interactions, /medications, /herbalist), des widgets /embed/* et des fiches toxiques en quarantaine."
                : "ADS_LAUNCH_GATE is hard-coded false in src/lib/ads/policy.ts. Even at the CSP layer, SENSITIVE_PREFIXES excludes ad hosts from health tools (/calculator, /symptoms, /surgery-planner, /npn-checker, /interactions, /medications, /herbalist), /embed/* iframes, and ToxicQuarantineShell toxic pages."}
            </li>
            <li>
              <strong className="text-foreground">
                {fr
                  ? "Limitation de débit et validation Zod :"
                  : "Rate Limiting & Input Validation:"}
              </strong>{" "}
              {fr
                ? "Limitation à fenêtre glissante via Upstash Redis (30 req/min sur /api/interactions/check et /api/interactions/check-stack, 10–20 req/min sur /api/chat), plafonds JSON de 16 Ko et schémas Zod avec journalisation expurgée sans PHI."
                : "Upstash Redis sliding-window rate limits (30 req/min on interaction routes, 10–20 req/min on chat), 16 KB JSON payload ceiling on stack checks, strict Zod validation, and PHI-free server logging."}
            </li>
            <li>
              <strong className="text-foreground">
                {fr
                  ? "Authentification LinkedIn OIDC SSO :"
                  : "LinkedIn OIDC SSO Session Security:"}
              </strong>{" "}
              {fr
                ? "Jetons de session signés et chiffrés AES-GCM dans des témoins HttpOnly / Secure / SameSite=Lax uniquement pour la soumission de révisions sur /clinical-review."
                : "AES-GCM encrypted session cookies with HttpOnly, Secure, and SameSite=Lax flags scoped to reviewer intake on /clinical-review."}
            </li>
          </ul>
        </section>

        {/* 5. PostgreSQL Fail-Closed Governance Triggers */}
        <section id="db-governance" aria-labelledby="db-governance-heading">
          <h2
            id="db-governance-heading"
            className="text-xl font-semibold text-foreground"
          >
            {fr
              ? "5. Verrous de gouvernance PostgreSQL (fail-closed)"
              : "5. PostgreSQL Fail-Closed Governance Migrations"}
          </h2>
          <div className="mt-3 space-y-2.5">
            {MIGRATIONS.map((m) => (
              <div
                key={m.file}
                className="rounded-lg border border-border bg-card p-3.5"
              >
                <a
                  href={`${GITHUB_REPO}/blob/main/supabase/migrations/${m.file}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs font-semibold text-primary underline underline-offset-4"
                >
                  supabase/migrations/{m.file}
                </a>
                <p className="mt-1 text-xs text-muted-foreground">
                  {fr ? m.summaryFr : m.summaryEn}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 6. Backup & Disaster Recovery */}
        <section id="backup-dr" aria-labelledby="backup-dr-heading">
          <h2
            id="backup-dr-heading"
            className="text-xl font-semibold text-foreground"
          >
            {fr
              ? "6. Sauvegardes chiffrées et reprise après sinistre"
              : "6. Encrypted Backups & Non-Destructive Restore Strategy"}
          </h2>
          <p className="mt-2">
            {fr
              ? "La base de données PostgreSQL 17 auto-hébergée (herbally-db) est sauvegardée quotidiennement en format personnalisé pg_dump -Fc vérifié par pg_restore --list, chiffrée en AES-256 GPG, conservée 14 jours sur trois emplacements (hôte local, miroir hôte et copie hors site) et testée au moyen d'un script de restauration non destructif dans herbally_restore_test."
              : "Production PostgreSQL 17 (herbally-db) runs daily pg_dump -Fc backups verified with pg_restore --list, encrypted with AES-256 symmetric GPG, retained for 14 days across three storage layers (local host, secondary host mirror, and off-site Mac pull), and validated via non-destructive restore drills into a temporary herbally_restore_test database."}
          </p>
          <p className="mt-2">
            <a
              href={`${GITHUB_REPO}/blob/main/docs/database-backup-strategy.md`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs font-medium text-primary underline underline-offset-4"
            >
              docs/database-backup-strategy.md
            </a>
          </p>
        </section>

        {/* 7. Transparent Boundaries */}
        <section
          id="boundaries"
          aria-labelledby="boundaries-heading"
          className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 sm:p-6"
        >
          <h2
            id="boundaries-heading"
            className="text-xl font-semibold text-foreground"
          >
            {fr
              ? "7. Limites explicites de vérification et signalement"
              : "7. Explicit Audit Boundaries & Security Disclosure"}
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground">
                {fr
                  ? "Validation clinique externe :"
                  : "Independent Licensed Clinical Sign-Off:"}
              </strong>{" "}
              {fr
                ? `${stats.clinicianApprovedInteractions} / ${stats.totalInteractions || 509} paires d'interactions et 0 / 3 sièges du comité consultatif sont actuellement pourvus. HerbAlly ne prétend à aucune validation clinique tant que des signatures licenciées ne sont pas enregistrées.`
                : `${stats.clinicianApprovedInteractions} / ${stats.totalInteractions || 509} interaction pairs and 0 / 3 Clinical Advisory Board seats are currently filled. HerbAlly never claims clinical sign-off before verified licensed review.`}
            </li>
            <li>
              <strong className="text-foreground">
                {fr
                  ? "Tests d'intrusion tiers / SOC 2 :"
                  : "Third-Party Pentest & Formal Compliance Attestations:"}
              </strong>{" "}
              {fr
                ? "HerbAlly publie ses contrôles techniques en code ouvert sans prétendre à une certification SOC 2 ou ISO 27001 externe."
                : "HerbAlly publishes verifiable engineering controls in open source and does not claim third-party SOC 2, ISO 27001, or paid penetration-test certification."}
            </li>
            <li>
              <strong className="text-foreground">
                {fr
                  ? "Signalement de vulnérabilité ou d'erreur :"
                  : "Vulnerability & Safety Reporting:"}
              </strong>{" "}
              {fr
                ? "Écrivez à info@herbally.app (contenu scientifique) ou privacy@herbally.app (sécurité / confidentialité). Les SLA complets figurent dans la charte éditoriale."
                : "Contact info@herbally.app (safety/content corrections) or privacy@herbally.app (security/privacy reports). Triage SLAs (24h Critical / 72h High) are published in our Clinical Governance Charter."}
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-4 text-xs font-medium">
            <Link
              href="/editorial-policy#clinical-governance-protocol"
              className="text-primary underline underline-offset-4"
            >
              {fr
                ? "Charte de gouvernance clinique"
                : "Clinical Governance Charter"}
            </Link>
            <Link
              href="/clinical-review"
              className="text-primary underline underline-offset-4"
            >
              {fr
                ? "Portail des réviseurs cliniques"
                : "Clinical Review Portal"}
            </Link>
            <Link
              href="/privacy"
              className="text-primary underline underline-offset-4"
            >
              {fr ? "Politique de confidentialité" : "Privacy Policy"}
            </Link>
            <Link
              href="/methodology"
              className="text-primary underline underline-offset-4"
            >
              {fr ? "Méthodologie" : "Methodology"}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
