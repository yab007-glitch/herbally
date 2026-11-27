import type { Metadata } from "next";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { getLocale } from "@/lib/i18n/page-locale";
import { siteUrl } from "@/lib/seo/site-url";
import { addLocalePrefix } from "@/lib/i18n/routing";
import { WebPageSchema } from "@/components/seo/webpage-schema";
import { BreadcrumbListSchema } from "@/components/seo/breadcrumb-list-schema";
import { getOpenDataSnapshot } from "@/lib/open-data/snapshot";

export const revalidate = 3600;

const GITHUB_REPO = "https://github.com/yab007-glitch/herbally";

const WORKFLOW_BADGES = [
  {
    name: "CI Pipeline",
    workflow: "ci.yml",
    label: "CI (Lint, Typecheck, Vitest, PG16 Replay, Chromium & Firefox E2E)",
  },
  {
    name: "Production Deploy",
    workflow: "deploy.yml",
    label: "Deploy (Self-hosted atomic release + rollback)",
  },
  {
    name: "Uptime Watchdog",
    workflow: "uptime-watch.yml",
    label: "Uptime Watchdog (Every 30 min cloud probe)",
  },
  {
    name: "Source & OpenAPI Monitor",
    workflow: "source-monitor.yml",
    label: "Source & OpenAPI Monitor (PubMed retraction & Open Data audit)",
  },
] as const;

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
      "Recursive key-equality and non-empty string verification across core, clinical, herbs, marketing, server, and tools dictionaries (1,632 keys).",
    assertionFr:
      "Égalité récursive des clés et validation des chaînes non vides sur les 6 fichiers JSON EN et FR (1 632 clés).",
    file: "src/lib/i18n/__tests__/dictionary-parity.test.ts",
  },
  {
    id: "A3",
    scopeEn: "Atomic Open Data snapshot consistency & OpenAPI 3.1 schema",
    scopeFr: "Instantané Open Data atomique et conformité OpenAPI 3.1",
    assertionEn:
      "Enforces a shared snapshotId and reconciled totals across catalog.json, medications.json, interactions.json, quarantine.json, and schema.json.",
    assertionFr:
      "Garantit un snapshotId partagé et des totaux réconciliés sur catalog.json, medications.json, interactions.json, quarantine.json et schema.json.",
    file: "src/app/open-data/open-data.test.ts",
  },
  {
    id: "A4",
    scopeEn: "All 142 medications integration matrix & matcher verification",
    scopeFr: "Matrice d'intégration complète des 142 médicaments et classes",
    assertionEn:
      "Exercises all 142 medications and 509 pairs: slug determinism, EN/FR URLs, severity counts, normalized/duplicate labels, and unknown lookup fail-closed behavior.",
    assertionFr:
      "Teste les 142 médicaments et 509 paires : déterminisme des slugs, URL EN/FR, agrégation de gravité, normalisation et absence != innocuité.",
    file: "src/lib/interactions/__tests__/all-142-medications.test.ts",
  },
  {
    id: "A5",
    scopeEn:
      "Interaction checker single-pair & multi-herb stack API edge cases",
    scopeFr: "Cas limites API du vérificateur simple et multi-plantes",
    assertionEn:
      "Tests 400 validation, 413 payload caps, 429 Retry-After rate limits, 503 DB fail-closed behavior, withheld retracted citations, and multi-herb deduplication.",
    assertionFr:
      "Teste validations 400, limites 413, limitation de débit 429, indisponibilité 503, rétention de citations retirées et déduplication multi-plantes.",
    file: "src/app/api/interactions/check/route.test.ts",
  },
  {
    id: "A6",
    scopeEn:
      "Browser network/cookie ad-exclusion across embeds, toxic plants & tools",
    scopeFr: "Preuve navigateur réseau/témoin d'exclusion publicitaire",
    assertionEn:
      "Playwright Chromium & Firefox E2E suite intercepting live network requests, DOM markers, cookies, and CSP headers across embeds, quarantine pages, and clinical tools.",
    assertionFr:
      "Suite E2E Playwright Chromium & Firefox interceptant requêtes réseau, DOM, témoins et en-têtes CSP sur widgets, plantes toxiques et outils.",
    file: "e2e/ads.spec.ts",
  },
  {
    id: "A7",
    scopeEn: "Live PG16 behavioral trigger, RLS & role integration suite",
    scopeFr: "Tests comportementaux PostgreSQL 16 (déclencheurs, RLS et rôles)",
    assertionEn:
      "Disposable PostgreSQL 16 integration suite exercising real anon/authenticated/AAL2 roles, clinical review reset triggers, pediatric lockdown, and fail-closed publication gates.",
    assertionFr:
      "Suite PostgreSQL 16 testant en conditions réelles les rôles anon/AAL2, réinitialisations de révision, verrous pédiatriques et portes de publication.",
    file: "supabase/tests/clinical-safety-integration.sql",
  },
  {
    id: "A8",
    scopeEn: "Automated PubMed retraction & regulatory citation monitor",
    scopeFr: "Moniteur automatisé de rétractations PubMed et liens sources",
    assertionEn:
      "Queries NCBI E-utilities esummary for retracted PMIDs, probes regulatory source URLs, and asserts live OpenAPI/snapshot consistency.",
    assertionFr:
      "Interroge NCBI E-utilities pour détecter les PMID rétractés, teste les URL sources réglementaires et valide la cohérence OpenAPI.",
    file: "scripts/verify-open-data-and-sources.ts",
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
      ? "Preuves vérifiables publiquement : code source GitHub, pipelines CI/CD, instantanés Open Data atomiques, tests comportementaux PostgreSQL 16, Playwright E2E et limites cliniques."
      : "Publicly verifiable engineering evidence: live GitHub Actions CI/Deploy/Monitor runs, atomic Open Data snapshots, Playwright browser tests, PostgreSQL 16 trigger tests, encrypted backups, and honest clinical review boundaries.";

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
  const snapshot = await getOpenDataSnapshot();
  const { stats, activePairs, medications, quarantinedBotanicals } = snapshot;

  const displayedInteractions =
    activePairs.length > 0 ? activePairs.length : stats.totalInteractions;
  const displayedMedications =
    medications.length > 0 ? medications.length : stats.totalMedications;

  const title = fr
    ? "Centre de sécurité, vérification automatisée et architecture"
    : "Security, Engineering & Automated Verification Center";
  const description = fr
    ? "Dépôt GitHub public, pipelines CI/CD, matrices de tests A1–A8, instantanés Open Data atomiques, en-têtes HTTP, verrous PostgreSQL 16 et limites transparentes."
    : "Public GitHub source, CI/CD & Source Monitor runs, A1–A8 automated safety matrices, atomic Open Data snapshots, HTTP security headers, fail-closed PostgreSQL 16 triggers, encrypted backups, and transparent audit boundaries.";

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
        {/* 1. Live Governance & Atomic Open Data Snapshot */}
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
              ? "1. Instantané atomique et jeux de données ouverts"
              : "1. Atomic Open Data & Live Governance Snapshot"}
          </h2>
          <p className="mt-2">
            {fr
              ? "Tous les points d'accès Open Data partagent un snapshotId et un horodatage unifiés calculés depuis une seule lecture cohérente."
              : "All Open Data JSON endpoints share a single atomic snapshotId and unified timestamp synchronized from one consistent snapshot."}
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            snapshotId:{" "}
            <strong className="text-foreground">{snapshot.snapshotId}</strong>
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
                  ? displayedInteractions.toLocaleString(fr ? "fr-CA" : "en-US")
                  : "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {stats.available
                  ? fr
                    ? `${displayedMedications} médicaments et classes`
                    : `${displayedMedications} medications & drug classes`
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
                {quarantinedBotanicals.length} /{" "}
                {stats.clinicianApprovedInteractions}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {fr
                  ? `${quarantinedBotanicals.length} plantes en quarantaine · ${stats.clinicianApprovedInteractions} validations cliniciennes externes`
                  : `${quarantinedBotanicals.length} quarantined plants · ${stats.clinicianApprovedInteractions} external clinician sign-offs`}
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

        {/* 2. Open Source & Live Continuous Verification */}
        <section id="open-source-ci" aria-labelledby="open-source-ci-heading">
          <h2
            id="open-source-ci-heading"
            className="text-xl font-semibold text-foreground"
          >
            {fr
              ? "2. Code source public et journaux CI/CD vérifiables"
              : "2. Public Source Code & Verifiable CI/CD Workflows"}
          </h2>
          <p className="mt-2">
            {fr
              ? "Tous les workflows, journaux d'exécution GitHub Actions, tests PostgreSQL 16 et suites Playwright sont publiquement inspectables."
              : "All workflow definitions and live GitHub Actions execution histories are publicly inspectable. Production deploys from main are strictly gated on green CI."}
          </p>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {WORKFLOW_BADGES.map((wf) => (
              <a
                key={wf.workflow}
                href={`${GITHUB_REPO}/actions/workflows/${wf.workflow}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3 hover:border-primary/50"
              >
                <span className="font-mono text-xs font-semibold text-primary underline underline-offset-4">
                  actions/workflows/{wf.workflow}
                </span>
                <span className="text-xs text-muted-foreground">
                  {wf.label}
                </span>
              </a>
            ))}
          </div>
          <p className="mt-3 text-xs">
            {fr ? "Dépôt complet :" : "Full source repository:"}{" "}
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono font-medium text-primary underline underline-offset-4"
            >
              {GITHUB_REPO}
            </a>{" "}
            ·{" "}
            <a
              href={`${GITHUB_REPO}/blob/main/scripts/test-migrations-postgres.sh`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono font-medium text-primary underline underline-offset-4"
            >
              scripts/test-migrations-postgres.sh
            </a>
          </p>
        </section>

        {/* 3. Automated Safety & Parity Test Matrix (A1-A8) */}
        <section id="automated-tests" aria-labelledby="automated-tests-heading">
          <h2
            id="automated-tests-heading"
            className="text-xl font-semibold text-foreground"
          >
            {fr
              ? "3. Matrice complète A1–A8 des tests automatisés et de surveillance"
              : "3. Complete A1–A8 Automated Safety, E2E & Source-Monitor Matrix"}
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
                    {fr ? "Fichier public" : "Public Repository File"}
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
          <p className="mt-3 text-xs text-muted-foreground">
            {fr
              ? "Note d'ergonomie sur la quarantaine toxique : ToxicQuarantineShell supprime toute navigation consommateur, FAQ, publicité, dosage et texte thérapeutique, tout en conservant volontairement l'accès retour au répertoire, le sélecteur EN/FR et les numéros antipoison en pied de page pour éviter une impasse de navigation."
              : "Toxic quarantine UX design note: ToxicQuarantineShell intentionally strips all consumer nav, FAQ, ads, dosing, and therapeutic prose while preserving minimal Home/Directory/Language links and Poison Control contacts so visitors never hit a dead end."}
          </p>
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
                ? "ADS_LAUNCH_GATE est codé en dur à false dans src/lib/ads/policy.ts et vérifié à l'exécution réseau sous Playwright (e2e/ads.spec.ts) sur les widgets, fiches toxiques et outils de santé."
                : "ADS_LAUNCH_GATE is hard-coded false in src/lib/ads/policy.ts and runtime-verified via network interception in e2e/ads.spec.ts across /embed/* widgets, quarantined botanicals, and clinical tools."}
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
              ? "La base de données PostgreSQL 17 auto-hébergée (herbally-db) est sauvegardée quotidiennement en format personnalisé pg_dump -Fc vérifié par pg_restore --list, chiffrée en AES-256 GPG, conservée 14 jours sur trois emplacements (hôte local, miroir hôte et copie hors site) et accompagnée d'un script de restauration non destructif dans herbally_restore_test (les journaux d'exercices sur l'hôte privé ne sont pas publiés dans ce dépôt)."
              : "Production PostgreSQL 17 (herbally-db) runs daily pg_dump -Fc backups verified with pg_restore --list, encrypted with AES-256 symmetric GPG, retained for 14 days across three storage layers (local host, secondary host mirror, and off-site Mac pull), with an atomic non-destructive restore drill script documented in Git (private host drill logs are not published in this repo)."}
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
                  ? "Validation clinique externe (Groupe B) :"
                  : "Independent Licensed Clinical Sign-Off (Group B):"}
              </strong>{" "}
              {fr
                ? `${stats.clinicianApprovedInteractions} / ${displayedInteractions || 509} paires d'interactions et 0 / 3 sièges du comité consultatif sont actuellement pourvus. HerbAlly ne prétend à aucune validation clinique tant que des signatures licenciées ne sont pas enregistrées.`
                : `${stats.clinicianApprovedInteractions} / ${displayedInteractions || 509} interaction pairs and 0 / 3 Clinical Advisory Board seats are currently filled. HerbAlly never claims clinical sign-off before verified licensed review.`}
            </li>
            <li>
              <strong className="text-foreground">
                {fr
                  ? "Tests d'intrusion tiers / SOC 2 (A9) :"
                  : "Third-Party Pentest & Formal Compliance Attestations (A9):"}
              </strong>{" "}
              {fr
                ? "HerbAlly publie ses contrôles techniques en code ouvert sans prétendre à un test d'intrusion humain indépendant, ni à une certification SOC 2 ou ISO 27001 externe."
                : "HerbAlly publishes verifiable engineering controls in open source and does not claim an external human penetration test, SOC 2, or ISO 27001 certification."}
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
