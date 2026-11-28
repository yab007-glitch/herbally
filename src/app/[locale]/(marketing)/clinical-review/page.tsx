import type { Metadata } from "next";
import {
  ShieldCheck,
  Users,
  Stethoscope,
  Lock,
  ExternalLink,
} from "lucide-react";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { getLocale } from "@/lib/i18n/page-locale";
import { addLocalePrefix } from "@/lib/i18n/routing";
import { siteUrl } from "@/lib/seo/site-url";
import { fitTitle } from "@/lib/seo/fit-title";
import {
  getLinkedInReviewerSession,
  isLinkedInOidcConfigured,
} from "@/lib/auth/linkedin-oidc";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAnonClient } from "@/lib/supabase/anonymous";
import { WebPageSchema } from "@/components/seo/webpage-schema";
import { BreadcrumbListSchema } from "@/components/seo/breadcrumb-list-schema";
import {
  ClinicalEditRequestClient,
  type ClinicalEditInitialTarget,
  type ReviewIntentMode,
  type SubmittedEditSummary,
} from "@/components/review/clinical-edit-request-client";
import {
  EDIT_FIELD_SCOPES,
  EDIT_TARGET_TYPES,
  type EditFieldScope,
  type EditTargetType,
} from "@/lib/governance/clinical-edits";
import { getOpenDataSnapshot } from "@/lib/open-data/snapshot";
import { buildReviewQueuePayload } from "@/lib/open-data/builders";
import { ClinicalAdvisoryBoardCallout } from "@/components/review/clinical-advisory-board-callout";
import { PriorityReviewQueueClient } from "@/components/review/priority-review-queue-client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  targetType?: string;
  slug?: string;
  drug?: string;
  field?: string;
  intent?: string;
  authError?: string;
}>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const sp = await searchParams;
  const locale = (await getLocale()) === "fr" ? "fr" : "en";
  const fr = locale === "fr";
  const baseUrl = siteUrl();
  const canonical = `${baseUrl}${addLocalePrefix("/clinical-review", locale)}`;
  const hasQuery = Boolean(
    sp.targetType || sp.slug || sp.drug || sp.field || sp.intent || sp.authError
  );

  const title = fr
    ? "Validation clinique & suggestions via LinkedIn SSO"
    : "Licensed Clinician Sign-Off & Edit Portal (LinkedIn SSO)";
  const description = fr
    ? "Les pharmaciens, médecins, cliniciens et contributeurs peuvent se connecter via LinkedIn SSO pour signer cliniquement ou améliorer nos fiches de plantes et d'interactions."
    : "Licensed pharmacists (PharmD/RPh), physicians (MD/DO), clinicians, and contributors can sign in via LinkedIn SSO to clinically sign off or suggest cited edits to HerbAlly records.";

  return {
    title: fitTitle([title]),
    description,
    ...(hasQuery ? { robots: { index: false, follow: true } } : {}),
    alternates: {
      canonical,
      languages: {
        en: `${baseUrl}/clinical-review`,
        fr: `${baseUrl}/fr/clinical-review`,
        "x-default": `${baseUrl}/clinical-review`,
      },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      siteName: "HerbAlly",
      locale: fr ? "fr_FR" : "en_US",
    },
  };
}

export default async function ClinicalReviewPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const locale = (await getLocale()) === "fr" ? "fr" : "en";
  const fr = locale === "fr";

  const targetType: EditTargetType = EDIT_TARGET_TYPES.includes(
    sp.targetType as EditTargetType
  )
    ? (sp.targetType as EditTargetType)
    : sp.slug && sp.drug
      ? "interaction"
      : sp.slug
        ? "herb"
        : sp.drug
          ? "medication"
          : "herb";

  const herbSlug =
    typeof sp.slug === "string" && /^[a-z0-9-]+$/i.test(sp.slug.trim())
      ? sp.slug.trim().toLowerCase()
      : "";
  const drugName =
    typeof sp.drug === "string" ? sp.drug.trim().slice(0, 120) : "";
  const fieldScope: EditFieldScope = EDIT_FIELD_SCOPES.includes(
    sp.field as EditFieldScope
  )
    ? (sp.field as EditFieldScope)
    : targetType === "interaction" || targetType === "medication"
      ? "drug_interaction"
      : "monograph_narrative";

  let herbName = "";
  if (herbSlug) {
    try {
      const anon = getAnonClient();
      if (anon) {
        const { data } = await anon
          .from("herbs_public" as never)
          .select("name, name_fr")
          .eq("slug", herbSlug)
          .eq("is_published", true)
          .maybeSingle();
        if (data) {
          const row = data as { name?: string; name_fr?: string | null };
          herbName = fr && row.name_fr?.trim() ? row.name_fr : (row.name ?? "");
        }
      }
    } catch {
      // Optional display hint only
    }
  }

  const surfaceUrl =
    herbSlug && drugName
      ? `/interactions/${herbSlug}/${encodeURIComponent(drugName.toLowerCase())}`
      : herbSlug
        ? `/herbs/${herbSlug}`
        : drugName
          ? `/medications/${encodeURIComponent(drugName.toLowerCase())}`
          : "";

  const initialTarget: ClinicalEditInitialTarget = {
    targetType,
    herbSlug,
    herbName,
    drugName,
    fieldScope,
    surfaceUrl,
  };

  const initialIntent: ReviewIntentMode =
    sp.intent === "advisory"
      ? "advisory"
      : sp.intent === "signoff"
        ? "signoff"
        : "edit";
  const isSignOffIntent = initialIntent === "signoff";
  const isAdvisoryIntent = initialIntent === "advisory";

  const [session, linkedinConfigured, reviewQueue] = await Promise.all([
    getLinkedInReviewerSession(),
    Promise.resolve(isLinkedInOidcConfigured()),
    getOpenDataSnapshot()
      .then((snap) => buildReviewQueuePayload(snap, siteUrl()))
      .catch(() => null),
  ]);

  // Provide up to 40 diverse high-risk unreviewed pairs to the interactive filterable queue
  const queueItems = (() => {
    if (!reviewQueue) return [];
    return reviewQueue.priorityQueue.slice(0, 40).map((item) => ({
      id: item.id,
      herbSlug: item.herbSlug,
      herbName: item.herbName,
      drugName: item.drugName,
      severity: item.severity as "contraindicated" | "severe",
      evidenceLevel: item.evidenceLevel,
      source: item.source,
    }));
  })();

  const targetDisplayLabel =
    herbName && drugName
      ? `${herbName} + ${drugName}`
      : herbSlug && drugName
        ? `${herbSlug} + ${drugName}`
        : herbName || herbSlug || drugName || "";

  let initialRequests: SubmittedEditSummary[] = [];
  if (session) {
    try {
      const admin = createAdminClient();
      const { data } = await admin
        .from("clinical_edit_requests")
        .select(
          "id, target_type, herb_slug, drug_name, field_scope, summary, status, admin_notes, created_at"
        )
        .eq("linkedin_sub", session.sub)
        .order("created_at", { ascending: false })
        .limit(50);
      initialRequests = (data ?? []) as SubmittedEditSummary[];
    } catch {
      initialRequests = [];
    }
  }

  const pageUrl = `${siteUrl()}${addLocalePrefix("/clinical-review", locale)}`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <WebPageSchema
        title={
          fr
            ? "Portail des réviseurs cliniques — HerbAlly"
            : "Clinical Reviewer Edit Portal — HerbAlly"
        }
        description={
          fr
            ? "Soumettez des demandes de modification clinique sourcées après validation LinkedIn SSO."
            : "Submit evidence-backed clinical edit requests validated through LinkedIn SSO."
        }
        url={pageUrl}
      />
      <BreadcrumbListSchema
        items={[
          { name: "Home", url: "/" },
          {
            name: fr ? "Révision clinique" : "Clinical Review",
            url: "/clinical-review",
          },
        ]}
      />

      <header className="space-y-4">
        <p className="eyebrow">
          {isAdvisoryIntent
            ? fr
              ? "Comité consultatif clinique · 0 / 3 sièges"
              : "Founding Clinical Advisory Board · 0 / 3 Seats"
            : isSignOffIntent
              ? fr
                ? "Révision par les pairs · Cliniciens licenciés"
                : "Licensed Clinician Peer-Review Sign-Off"
              : fr
                ? "Contributions ouvertes et gouvernance"
                : "Open Herb Edit & Clinical Sign-Off Portal"}
        </p>
        <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {isAdvisoryIntent
            ? fr
              ? "Rejoindre le comité consultatif clinique (SSO LinkedIn)"
              : "Apply for HerbAlly's Clinical Advisory Board (LinkedIn SSO)"
            : isSignOffIntent
              ? fr
                ? "Valider cliniquement une fiche HerbAlly (SSO LinkedIn)"
                : "Clinically Sign Off a HerbAlly Record (LinkedIn SSO)"
              : fr
                ? "Validation clinique ou suggestion de modification (SSO LinkedIn)"
                : "Clinical Sign-Off & Content Edit Portal"}
        </h1>
        <p className="max-w-3xl text-base leading-relaxed text-muted-foreground">
          {isSignOffIntent
            ? fr
              ? "Vous êtes pharmacien(ne) (PharmD/RPh), médecin (MD/DO), infirmier(ère) praticien(ne), naturopathe agréé(e) ou toxicologue clinique ? Connectez-vous via LinkedIn SSO pour valider l'exactitude d'une interaction ou d'une monographie en ~2 minutes, avec crédit public optionnel après vérification manuelle de votre permis. Trois sièges du comité consultatif clinique (0 / 3) sont également ouverts."
              : "Are you a licensed pharmacist (PharmD/RPh), physician (MD/DO), NP, ND, or clinical toxicologist? Sign in via LinkedIn SSO to verify and sign off an interaction pair or herb monograph in ~2 minutes — with optional public reviewer credit once credentials are manually verified. Three Clinical Advisory Board seats (0 / 3) are also open."
            : fr
              ? "Les cliniciens licenciés peuvent valider nos fiches en ~2 minutes via LinkedIn OpenID Connect, et tout lecteur ou chercheur peut suggérer des corrections ou ajouter des sources primaires sur n'importe quelle plante ou interaction médicamenteuse."
              : "Licensed clinicians can sign off herb monographs and drug interaction pairs in ~2 minutes via LinkedIn OpenID Connect, and any reader or researcher can suggest cited edits or flag inaccuracies across HerbAlly."}
        </p>

        <div className="grid gap-3 pt-2 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-muted/30 p-3.5 text-xs">
            <p className="flex items-center gap-1.5 font-semibold text-foreground">
              <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
              {fr ? "Identité vérifiée (~2 min)" : "LinkedIn SSO (~2 min)"}
            </p>
            <p className="mt-1 text-muted-foreground">
              {fr
                ? "Relie chaque validation ou suggestion à un profil LinkedIn réel sans créer de compte lecteur."
                : "Anchors each clinical sign-off or edit to an authenticated LinkedIn identity with no extra account."}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3.5 text-xs">
            <p className="flex items-center gap-1.5 font-semibold text-foreground">
              <Stethoscope className="size-4 text-primary" aria-hidden="true" />
              {fr
                ? "Crédit clinique public (optionnel)"
                : "Optional public clinician credit"}
            </p>
            <p className="mt-1 text-muted-foreground">
              {fr
                ? "Affichez votre nom et vos titres (ex. PharmD, MD) sur la fiche validée et le journal des révisions."
                : "Optionally display 'Clinically reviewed by Name, PharmD/MD' on signed records and the audit log."}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3.5 text-xs">
            <p className="flex items-center gap-1.5 font-semibold text-foreground">
              <Users className="size-4 text-primary" aria-hidden="true" />
              {fr
                ? "Vérification manuelle du permis"
                : "Manual licence verification"}
            </p>
            <p className="mt-1 text-muted-foreground">
              {fr
                ? "Aucune fiche n'est publiée ou marquée « révisée » avant contrôle manuel des titres et sources."
                : "Nothing publishes automatically — every licence and citation is manually verified before going live."}
            </p>
          </div>
        </div>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <Link
            href="/methodology#governance-coverage"
            className="font-medium text-primary underline underline-offset-4"
          >
            {fr
              ? "Voir les compteurs de couverture de révision et le journal public des corrections →"
              : "View live review coverage metrics and public corrections log →"}
          </Link>
          <Link
            href="/editorial-policy#clinical-governance-protocol"
            className="font-medium text-primary underline underline-offset-4"
          >
            {fr
              ? "Consulter le protocole d'intégration et de gouvernance clinique →"
              : "Read the Clinical Reviewer Onboarding & Governance Protocol →"}
          </Link>
          <a
            href="/open-data/review-queue.json"
            className="font-medium text-primary underline underline-offset-4"
          >
            {fr
              ? "File prioritaire JSON (paires contre-indiquées / graves à réviser) →"
              : "Machine-readable Priority Review Queue JSON (contraindicated & severe) →"}
          </a>
        </p>
        <p className="text-xs text-muted-foreground">
          {fr
            ? "Contact éditorial ou demandes institutionnelles en texte clair : "
            : "Direct editorial or institutional review inquiries (plaintext): "}
          <a
            href="mailto:info@herbally.app"
            className="font-medium text-primary underline underline-offset-4"
          >
            info@herbally.app
          </a>
          {fr
            ? " (ne transmettez jamais de renseignements personnels de santé)."
            : " (never send patient-identifying health information)."}
        </p>
      </header>

      {/* Target record preview BEFORE requesting authentication (D06/D07) */}
      {targetDisplayLabel && surfaceUrl && (
        <section
          aria-labelledby="target-record-preview-heading"
          className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm"
        >
          <div className="space-y-0.5">
            <p
              id="target-record-preview-heading"
              className="text-xs font-semibold uppercase tracking-wide text-primary"
            >
              {fr
                ? "Fiche ciblée pour cette validation"
                : "Target record you are reviewing"}
            </p>
            <p className="font-semibold text-foreground">
              {targetDisplayLabel}
            </p>
            <p className="text-xs text-muted-foreground">
              {fr
                ? "Attestation demandée : confirmer l'exactitude clinique des niveaux, mécanismes et sources citées, ou signaler les ajustements nécessaires."
                : "What you are attesting: accuracy of published severity, mechanism, preparation scope, and cited primary sources — or noting any refinements."}
            </p>
          </div>
          <Link
            href={surfaceUrl}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <span>
              {fr
                ? "Inspecter la fiche avant connexion"
                : "Inspect record before signing in"}
            </span>
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </Link>
        </section>
      )}

      {/* Clear 5-Step Onboarding & Licence Privacy Sequence (D34/D35/D38) */}
      <section
        aria-labelledby="onboarding-sequence-heading"
        className="mt-6 rounded-2xl border border-border bg-card p-4 text-xs sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            id="onboarding-sequence-heading"
            className="text-sm font-semibold text-foreground"
          >
            {fr
              ? "Comment fonctionne la validation clinique (en 5 étapes)"
              : "How clinical sign-off works (5-step onboarding & privacy)"}
          </h2>
          <span className="inline-flex items-center gap-1 font-medium text-muted-foreground">
            <Lock className="size-3.5 text-primary" aria-hidden="true" />
            {fr
              ? "Numéro de permis privé — jamais publié"
              : "Licence number stays private — never published"}
          </span>
        </div>
        <ol className="mt-3 grid gap-2 sm:grid-cols-5">
          {(fr
            ? [
                "1. Vérifiez la fiche et ses citations",
                "2. Identifiez-vous via LinkedIn SSO",
                "3. Indiquez titre, permis privé et COI",
                "4. Confirmez ou proposez un correctif",
                "5. Vérification manuelle avant publication",
              ]
            : [
                "1. Inspect the record & citations",
                "2. Verify identity via LinkedIn SSO",
                "3. Enter private licence & COI",
                "4. Confirm accuracy or suggest edits",
                "5. Manual credential check before publish",
              ]
          ).map((step) => (
            <li
              key={step}
              className="rounded-lg border border-border/70 bg-muted/20 p-2.5 font-medium text-foreground"
            >
              {step}
            </li>
          ))}
        </ol>
        <p className="mt-2.5 text-muted-foreground">
          {fr
            ? "Après soumission : votre demande entre dans la file de vérification (/admin/edit-requests). Nous vérifions l'inscription active auprès de l'ordre professionnel avant d'activer tout badge « Révisé par un clinicien » ou crédit public optionnel."
            : "What happens after submission: your sign-off enters our manual triage queue (/admin/edit-requests). We verify active regulatory standing before enabling any 'Clinically reviewed' badge or optional public reviewer credit."}
        </p>
      </section>

      <div className="mt-8">
        <ClinicalEditRequestClient
          locale={locale}
          linkedinConfigured={linkedinConfigured}
          session={
            session
              ? {
                  name: session.name,
                  email: session.email,
                  emailVerified: session.emailVerified,
                }
              : null
          }
          authError={sp.authError ?? null}
          initialTarget={initialTarget}
          initialRequests={initialRequests}
          initialIntent={initialIntent}
        />
      </div>

      <div className="mt-10">
        <ClinicalAdvisoryBoardCallout locale={locale} />
      </div>

      {/* Live Filterable High-Priority Clinical Sign-Off Queue */}
      {reviewQueue && queueItems.length > 0 && (
        <PriorityReviewQueueClient
          locale={locale}
          items={queueItems}
          totalPriorityCount={reviewQueue.summary.priorityQueueCount}
          totalActivePairs={reviewQueue.summary.totalActivePairs}
          clinicianSignedPairs={reviewQueue.summary.clinicianSignedPairs}
          seatsFilled={reviewQueue.advisoryBoard.seatsFilled}
          seatsTotal={reviewQueue.advisoryBoard.seatsTotal}
          generatedAt={reviewQueue.generatedAt}
        />
      )}
    </div>
  );
}
