import type { Metadata } from "next";
import {
  ShieldCheck,
  FileCheck2,
  Users,
  Stethoscope,
  ArrowRight,
  AlertOctagon,
  AlertTriangle,
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
import { pairPath } from "@/lib/interactions/pair-url";
import { buildSignOffHref } from "@/components/review/clinician-signoff-banner";
import { ClinicalAdvisoryBoardCallout } from "@/components/review/clinical-advisory-board-callout";

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

  // Select up to 8 diverse high-priority unreviewed pairs (contraindicated first)
  const featuredQueueItems = (() => {
    if (!reviewQueue) return [];
    const picked: typeof reviewQueue.priorityQueue = [];
    const seenHerbs = new Set<string>();
    for (const item of reviewQueue.priorityQueue) {
      if (picked.length >= 8) break;
      if (!seenHerbs.has(item.herbSlug)) {
        seenHerbs.add(item.herbSlug);
        picked.push(item);
      }
    }
    if (picked.length < 8) {
      for (const item of reviewQueue.priorityQueue) {
        if (picked.length >= 8) break;
        if (!picked.some((p) => p.id === item.id)) {
          picked.push(item);
        }
      }
    }
    return picked;
  })();

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

      {/* Live High-Priority Clinical Sign-Off Queue */}
      {reviewQueue && featuredQueueItems.length > 0 && (
        <section
          id="priority-queue"
          aria-labelledby="priority-queue-heading"
          className="mt-12 rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                <FileCheck2 className="size-3.5" aria-hidden="true" />
                {fr
                  ? "File prioritaire de validation clinique"
                  : "Priority Clinical Sign-Off Queue"}
              </p>
              <h2
                id="priority-queue-heading"
                className="text-xl font-semibold text-foreground"
              >
                {fr
                  ? "Interactions à haut risque en attente de validation"
                  : "High-risk interaction pairs awaiting clinician sign-off"}
              </h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                {fr
                  ? `${reviewQueue.summary.priorityQueueCount} paires contre-indiquées ou graves (sur ${reviewQueue.summary.totalActivePairs} paires actives ; ${reviewQueue.summary.clinicianSignedPairs} signées à ce jour) attendent une première révision par un pharmacien, médecin ou toxicologue.`
                  : `${reviewQueue.summary.priorityQueueCount} contraindicated or severe pairs (out of ${reviewQueue.summary.totalActivePairs} active pairs; ${reviewQueue.summary.clinicianSignedPairs} clinician-signed so far) are prioritized for first-wave PharmD / MD / toxicologist sign-off.`}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-xs">
              <p className="font-semibold text-foreground">
                {fr
                  ? `Comité consultatif : ${reviewQueue.advisoryBoard.seatsFilled} / ${reviewQueue.advisoryBoard.seatsTotal} sièges`
                  : `Advisory Board: ${reviewQueue.advisoryBoard.seatsFilled} / ${reviewQueue.advisoryBoard.seatsTotal} seats`}
              </p>
              <p className="mt-0.5 text-muted-foreground">
                {fr
                  ? "PharmD/RPh · MD/DO · Toxicologue"
                  : "PharmD/RPh · MD/DO · Clinical Toxicologist"}
              </p>
            </div>
          </div>

          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {featuredQueueItems.map((item) => {
              const isContra = item.severity === "contraindicated";
              const signOffUrl = buildSignOffHref({
                targetType: "interaction",
                herbSlug: item.herbSlug,
                drugName: item.drugName,
              });
              return (
                <li
                  key={item.id}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-border/80 bg-background p-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">
                        {item.herbName} + {item.drugName}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                          isContra
                            ? "border-red-300 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
                            : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
                        }`}
                      >
                        {isContra ? (
                          <AlertOctagon className="size-3" aria-hidden="true" />
                        ) : (
                          <AlertTriangle
                            className="size-3"
                            aria-hidden="true"
                          />
                        )}
                        {isContra
                          ? fr
                            ? "Contre-indiquée"
                            : "Contraindicated"
                          : fr
                            ? "Grave"
                            : "Severe"}
                      </span>
                    </div>
                    {item.source && (
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {fr ? "Source primaire : " : "Primary source: "}
                        {item.source}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                    <Link
                      href={pairPath(item.herbSlug, item.drugName)}
                      className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    >
                      {fr ? "Lire la fiche" : "Inspect record"}
                    </Link>
                    <Link
                      href={signOffUrl}
                      rel="nofollow"
                      className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                    >
                      {fr ? "Valider cette paire" : "Sign off this pair"}
                      <ArrowRight className="size-3" aria-hidden="true" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4 text-xs text-muted-foreground">
            <span>
              {fr
                ? "Intéressé(e) par une révision par lots ou un siège au comité consultatif clinique ? Écrivez à "
                : "Interested in batch review or one of our 3 Clinical Advisory Board seats? Email "}
              <a
                href="mailto:info@herbally.app"
                className="font-semibold text-primary underline underline-offset-2"
              >
                info@herbally.app
              </a>
              .
            </span>
            <a
              href="/open-data/review-queue.json"
              className="font-medium text-primary underline underline-offset-4"
            >
              {fr
                ? `Télécharger les ${reviewQueue.summary.priorityQueueCount} paires prioritaires (JSON) →`
                : `Download all ${reviewQueue.summary.priorityQueueCount} priority pairs (JSON) →`}
            </a>
          </div>
        </section>
      )}
    </div>
  );
}
