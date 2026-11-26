import type { Metadata } from "next";
import { ShieldCheck, FileCheck2, Users } from "lucide-react";
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
    ? "Portail des réviseurs cliniques (SSO LinkedIn)"
    : "Clinical Reviewer Edit Portal (LinkedIn SSO)";
  const description = fr
    ? "Les pharmaciens, médecins et chercheurs qualifiés peuvent valider leur identité via LinkedIn SSO et soumettre des demandes de modification sourcées."
    : "Credentialed clinicians, pharmacists, and researchers can validate via LinkedIn SSO and submit evidence-backed edit requests for HerbAlly.";

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
          : "general";

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
          {fr ? "Gouvernance clinique ouverte" : "Open Clinical Governance"}
        </p>
        <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {fr
            ? "Portail de révision clinique (SSO LinkedIn)"
            : "Clinical Reviewer Edit Requests"}
        </h1>
        <p className="max-w-3xl text-base leading-relaxed text-muted-foreground">
          {fr
            ? "Tout pharmacien, médecin, infirmier(ère), chercheur ou clinicien diplômé peut s'authentifier avec LinkedIn OpenID Connect pour signaler une incohérence, proposer une nuance clinique ou soumettre des références primaires sur une fiche de plante ou d'interaction."
            : "Any qualified pharmacist, physician, nurse, dietitian, or herbal medicine researcher can sign in with LinkedIn SSO to flag discrepancies, refine clinical nuance, or submit primary citations for any HerbAlly herb or interaction record."}
        </p>

        <div className="grid gap-3 pt-2 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-muted/30 p-3.5 text-xs">
            <p className="flex items-center gap-1.5 font-semibold text-foreground">
              <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
              {fr ? "Identité vérifiée par LinkedIn" : "LinkedIn SSO identity"}
            </p>
            <p className="mt-1 text-muted-foreground">
              {fr
                ? "Relie chaque demande à un profil LinkedIn réel et limite le spam."
                : "Anchors each submission to an authenticated LinkedIn account."}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3.5 text-xs">
            <p className="flex items-center gap-1.5 font-semibold text-foreground">
              <FileCheck2 className="size-4 text-primary" aria-hidden="true" />
              {fr ? "Citations obligatoires" : "Citations required"}
            </p>
            <p className="mt-1 text-muted-foreground">
              {fr
                ? "PMID, DOI ou monographie réglementaire exigée à chaque envoi."
                : "PMID, DOI, or primary monograph source required per edit."}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3.5 text-xs">
            <p className="flex items-center gap-1.5 font-semibold text-foreground">
              <Users className="size-4 text-primary" aria-hidden="true" />
              {fr ? "Aucune publication automatique" : "Human triage gate"}
            </p>
            <p className="mt-1 text-muted-foreground">
              {fr
                ? "Toute modification est vérifiée avant mise en ligne dans la base."
                : "Edits are queued for editorial/clinical verification before going live."}
            </p>
          </div>
        </div>
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
