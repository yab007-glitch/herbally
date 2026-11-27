import type { Metadata } from "next";
import { ShieldCheck, FileCheck2, Users } from "lucide-react";
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
  type SubmittedEditSummary,
} from "@/components/review/clinical-edit-request-client";
import {
  EDIT_FIELD_SCOPES,
  EDIT_TARGET_TYPES,
  type EditFieldScope,
  type EditTargetType,
} from "@/lib/governance/clinical-edits";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  targetType?: string;
  slug?: string;
  drug?: string;
  field?: string;
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
    sp.targetType || sp.slug || sp.drug || sp.field || sp.authError
  );

  const title = fr
    ? "Suggérer une modification via LinkedIn SSO"
    : "Suggest a Herb or Interaction Edit (LinkedIn SSO)";
  const description = fr
    ? "Tout utilisateur ou clinicien peut se connecter avec LinkedIn SSO pour proposer des améliorations ou références sur nos fiches de plantes et d'interactions."
    : "Sign in with LinkedIn SSO to suggest edits, clarity improvements, or source citations for any HerbAlly herb monograph or interaction page.";

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

  const [session, linkedinConfigured] = await Promise.all([
    getLinkedInReviewerSession(),
    Promise.resolve(isLinkedInOidcConfigured()),
  ]);

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
          {fr
            ? "Contributions ouvertes et gouvernance"
            : "Open Herb Edit Portal"}
        </p>
        <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {fr
            ? "Suggérer une modification (SSO LinkedIn)"
            : "Suggest a Herb or Content Edit"}
        </h1>
        <p className="max-w-3xl text-base leading-relaxed text-muted-foreground">
          {fr
            ? "Tout utilisateur HerbAlly ainsi que les pharmaciens, médecins et chercheurs peuvent se connecter avec LinkedIn OpenID Connect pour suggérer des améliorations ou signaler une erreur sur une plante ou une interaction médicamenteuse."
            : "Anyone can sign in with LinkedIn OpenID Connect to suggest edits, flag inaccuracies, or add primary sources to any HerbAlly herb profile or interaction page. Clinicians and researchers can optionally include credentials to prioritize clinical triage."}
        </p>

        <div className="grid gap-3 pt-2 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-muted/30 p-3.5 text-xs">
            <p className="flex items-center gap-1.5 font-semibold text-foreground">
              <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
              {fr ? "Identité vérifiée par LinkedIn" : "LinkedIn SSO identity"}
            </p>
            <p className="mt-1 text-muted-foreground">
              {fr
                ? "Relie chaque suggestion à un profil LinkedIn réel et limite le spam."
                : "Anchors each suggestion to an authenticated LinkedIn account."}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3.5 text-xs">
            <p className="flex items-center gap-1.5 font-semibold text-foreground">
              <FileCheck2 className="size-4 text-primary" aria-hidden="true" />
              {fr
                ? "Sources et titres optionnels"
                : "Sources & credentials optional"}
            </p>
            <p className="mt-1 text-muted-foreground">
              {fr
                ? "Ajoutez une URL, un PMID ou DOI si disponible — nos éditeurs vérifient chaque source."
                : "Include a PMID, DOI, URL, or clinical credentials if applicable."}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3.5 text-xs">
            <p className="flex items-center gap-1.5 font-semibold text-foreground">
              <Users className="size-4 text-primary" aria-hidden="true" />
              {fr ? "Aucune publication automatique" : "Human triage gate"}
            </p>
            <p className="mt-1 text-muted-foreground">
              {fr
                ? "Toute suggestion est relue et vérifiée avant mise en ligne dans la base."
                : "Edits are queued for editorial & clinical verification before going live."}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          <Link
            href="/methodology#governance-coverage"
            className="font-medium text-primary underline underline-offset-4"
          >
            {fr
              ? "Voir les compteurs de couverture de révision et le journal public des corrections →"
              : "View live review coverage metrics and public corrections log →"}
          </Link>
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
        />
      </div>
    </div>
  );
}
