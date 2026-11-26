"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  LogOut,
  ExternalLink,
  Search,
  Send,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import {
  PROFESSIONAL_ROLES,
  EDIT_TARGET_TYPES,
  EDIT_FIELD_SCOPES,
  type ProfessionalRole,
  type EditTargetType,
  type EditFieldScope,
} from "@/lib/governance/clinical-edits";

export interface ReviewerSessionSummary {
  name: string;
  email: string;
  emailVerified: boolean;
}

export interface SubmittedEditSummary {
  id: string;
  target_type: string;
  herb_slug: string | null;
  drug_name: string | null;
  field_scope: string;
  summary: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

export interface ClinicalEditInitialTarget {
  targetType: EditTargetType;
  herbSlug: string;
  herbName: string;
  drugName: string;
  fieldScope: EditFieldScope;
  surfaceUrl: string;
}

interface HerbOption {
  slug: string;
  name: string;
  scientific_name: string;
}

const ROLE_LABELS: Record<ProfessionalRole, { en: string; fr: string }> = {
  pharmacist: {
    en: "Pharmacist (PharmD / BPharm / RPh)",
    fr: "Pharmacien(ne) (PharmD / BPharm)",
  },
  physician: { en: "Physician (MD / DO)", fr: "Médecin (MD / DO)" },
  nurse_practitioner_rn: {
    en: "Nurse Practitioner / Registered Nurse",
    fr: "Infirmier(ère) praticien(ne) / autorisé(e)",
  },
  naturopathic_doctor: {
    en: "Naturopathic Doctor (ND)",
    fr: "Naturopathe agréé(e) (ND)",
  },
  clinical_pharmacologist: {
    en: "Clinical Pharmacologist / Toxicologist",
    fr: "Pharmacologue / toxicologue clinique",
  },
  medical_lab_technologist: {
    en: "Medical Laboratory Technologist (MLT)",
    fr: "Technologiste médical(e) (TM)",
  },
  registered_dietitian: {
    en: "Registered Dietitian (RD)",
    fr: "Diététiste / nutritionniste agréé(e)",
  },
  clinical_herbalist: {
    en: "Clinical Herbalist / Pharmacognosist",
    fr: "Herboriste clinicien(ne) / pharmacognoste",
  },
  other_clinician: {
    en: "Other credentialed healthcare clinician",
    fr: "Autre clinicien(ne) diplômé(e)",
  },
};

const TARGET_LABELS: Record<EditTargetType, { en: string; fr: string }> = {
  herb: { en: "Herb monograph", fr: "Monographie de plante" },
  interaction: {
    en: "Herb–drug interaction pair",
    fr: "Paire d'interaction plante–médicament",
  },
  medication: { en: "Medication summary", fr: "Fiche médicament" },
  general: {
    en: "General safety / policy",
    fr: "Sécurité générale / politique",
  },
};

const SCOPE_LABELS: Record<EditFieldScope, { en: string; fr: string }> = {
  dosage_safety: {
    en: "Adult dosage & safety",
    fr: "Posologie adulte et sécurité",
  },
  drug_interaction: {
    en: "Drug interaction & severity",
    fr: "Interaction et gravité",
  },
  evidence_grade: {
    en: "Evidence grade & certainty",
    fr: "Niveau et certitude des preuves",
  },
  contraindications_pregnancy: {
    en: "Contraindications / pregnancy & lactation",
    fr: "Contre-indications / grossesse et allaitement",
  },
  monograph_narrative: {
    en: "Monograph narrative / uses",
    fr: "Texte de monographie / usages",
  },
  citations_sources: {
    en: "Primary citations / sources",
    fr: "Citations et sources primaires",
  },
  translation_fr: {
    en: "French clinical translation",
    fr: "Traduction clinique en français",
  },
  other: { en: "Other clinical accuracy fix", fr: "Autre correction clinique" },
};

const STATUS_BADGE: Record<string, { en: string; fr: string; cls: string }> = {
  pending: {
    en: "Pending admin triage",
    fr: "En attente d'examen",
    cls: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  },
  under_review: {
    en: "Under review",
    fr: "En cours d'examen",
    cls: "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200",
  },
  needs_info: {
    en: "More detail requested",
    fr: "Précisions demandées",
    cls: "border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-200",
  },
  approved: {
    en: "Approved for publication",
    fr: "Approuvé pour publication",
    cls: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  },
  applied: {
    en: "Applied to live database",
    fr: "Appliqué à la base",
    cls: "border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200",
  },
  rejected: {
    en: "Declined",
    fr: "Refusé",
    cls: "border-border bg-muted text-muted-foreground",
  },
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function authErrorMessage(code: string | null, fr: boolean): string | null {
  if (!code) return null;
  switch (code) {
    case "not_configured":
      return fr
        ? "L'authentification unique LinkedIn OIDC n'est pas encore activée sur cet environnement (LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET requis)."
        : "LinkedIn OIDC SSO is not yet enabled on this environment (awaiting LinkedIn Developer app credentials).";
    case "cancelled":
      return fr
        ? "La connexion LinkedIn a été annulée avant validation."
        : "LinkedIn sign-in was cancelled before verification completed.";
    case "invalid_state":
      return fr
        ? "Le jeton de sécurité de la session LinkedIn a expiré ou est invalide. Réessayez."
        : "Your LinkedIn sign-in state expired or could not be verified. Please try again.";
    case "rate_limited":
      return fr
        ? "Trop de tentatives de connexion. Patientez une minute avant de réessayer."
        : "Too many sign-in attempts. Please wait a minute and try again.";
    case "exchange_failed":
    case "provider_error":
      return fr
        ? "LinkedIn n'a pas pu finaliser la validation du compte. Veuillez réessayer."
        : "LinkedIn could not complete account validation. Please try again.";
    default:
      return fr ? "Erreur de connexion LinkedIn." : "LinkedIn sign-in failed.";
  }
}

export function ClinicalEditRequestClient({
  locale,
  linkedinConfigured,
  session,
  authError,
  initialTarget,
  initialRequests,
}: {
  locale: "en" | "fr";
  linkedinConfigured: boolean;
  session: ReviewerSessionSummary | null;
  authError: string | null;
  initialTarget: ClinicalEditInitialTarget;
  initialRequests: SubmittedEditSummary[];
}) {
  const fr = locale === "fr";
  const router = useRouter();

  const [requests, setRequests] =
    useState<SubmittedEditSummary[]>(initialRequests);
  const [linkedinProfileUrl, setLinkedinProfileUrl] = useState("");
  const [professionalRole, setProfessionalRole] =
    useState<ProfessionalRole>("pharmacist");
  const [credentials, setCredentials] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [licenceNumber, setLicenceNumber] = useState("");
  const [licenceJurisdiction, setLicenceJurisdiction] = useState("");
  const [conflictOfInterest, setConflictOfInterest] = useState("None");
  const [attributionConsent, setAttributionConsent] = useState(false);
  const [noPhiAttested, setNoPhiAttested] = useState(false);

  const [targetType, setTargetType] = useState<EditTargetType>(
    initialTarget.targetType
  );
  const [herbSlug, setHerbSlug] = useState(initialTarget.herbSlug);
  const [herbLookup, setHerbLookup] = useState(initialTarget.herbName || "");
  const [herbSuggestions, setHerbSuggestions] = useState<HerbOption[]>([]);
  const [drugName, setDrugName] = useState(initialTarget.drugName);
  const [surfaceUrl, setSurfaceUrl] = useState(initialTarget.surfaceUrl);
  const [fieldScope, setFieldScope] = useState<EditFieldScope>(
    initialTarget.fieldScope
  );
  const [summary, setSummary] = useState("");
  const [currentText, setCurrentText] = useState("");
  const [proposedChange, setProposedChange] = useState("");
  const [clinicalRationale, setClinicalRationale] = useState("");
  const [citationsText, setCitationsText] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccessId, setSubmitSuccessId] = useState<string | null>(null);

  useEffect(() => {
    const q = herbLookup.trim();
    if (!session || q.length < 2) {
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/herbs/search?q=${encodeURIComponent(q)}`,
          { signal: ctrl.signal }
        );
        if (!res.ok) return;
        const json = (await res.json()) as HerbOption[];
        if (Array.isArray(json)) {
          setHerbSuggestions(json.slice(0, 6));
        }
      } catch {
        // Ignore aborted or offline lookup
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [herbLookup, session]);

  const reviewBase = fr ? "/fr/clinical-review" : "/clinical-review";
  const nextParams = new URLSearchParams();
  if (targetType !== "general") nextParams.set("targetType", targetType);
  if (herbSlug.trim()) nextParams.set("slug", herbSlug.trim());
  if (drugName.trim()) nextParams.set("drug", drugName.trim());
  const nextUrl = nextParams.toString()
    ? `${reviewBase}?${nextParams.toString()}`
    : reviewBase;
  const linkedinStartHref = `/api/auth/linkedin/start?next=${encodeURIComponent(nextUrl)}`;

  const authErrorText = authErrorMessage(authError, fr);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/linkedin/logout", { method: "POST" });
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccessId(null);

    try {
      const res = await fetch("/api/clinical-edits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkedinProfileUrl,
          professionalRole,
          credentials,
          affiliation,
          licenceNumber,
          licenceJurisdiction,
          conflictOfInterest,
          attributionConsent,
          noPhiAttested,
          targetType,
          herbSlug,
          drugName,
          surfaceUrl,
          fieldScope,
          summary,
          currentText,
          proposedChange,
          clinicalRationale,
          citations: citationsText,
          locale,
        }),
      });
      const json = (await res.json()) as {
        accepted?: boolean;
        id?: string;
        status?: string;
        createdAt?: string;
        error?: string;
      };
      if (!res.ok || !json.accepted || !json.id) {
        setSubmitError(
          json.error ||
            (fr
              ? "Impossible d'enregistrer votre demande."
              : "Could not submit your edit request.")
        );
        return;
      }

      setSubmitSuccessId(json.id);
      setRequests((prev) => [
        {
          id: json.id!,
          target_type: targetType,
          herb_slug: herbSlug.trim() || null,
          drug_name: drugName.trim() || null,
          field_scope: fieldScope,
          summary: summary.trim(),
          status: json.status ?? "pending",
          admin_notes: null,
          created_at: json.createdAt ?? new Date().toISOString(),
        },
        ...prev,
      ]);
      setSummary("");
      setCurrentText("");
      setProposedChange("");
      setClinicalRationale("");
      setCitationsText("");
      setNoPhiAttested(false);
    } catch {
      setSubmitError(
        fr
          ? "Erreur réseau lors de l'envoi."
          : "Network error while submitting your request."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Step 1: LinkedIn OIDC SSO Validation */}
      <section
        aria-labelledby="linkedin-sso-heading"
        className="rounded-2xl border border-border bg-card p-6 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              {fr
                ? "Étape 1 · Validation d'identité par SSO LinkedIn"
                : "Step 1 · LinkedIn SSO Identity Validation"}
            </p>
            <h2
              id="linkedin-sso-heading"
              className="text-xl font-semibold text-foreground"
            >
              {fr
                ? "Validez votre identité de réviseur clinique"
                : "Validate your clinical reviewer identity"}
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {fr
                ? "HerbAlly utilise LinkedIn OpenID Connect (openid, profile, email) pour vérifier l'identité du réviseur avant d'enregistrer une proposition de modification. Cela reste distinct de tout compte lecteur HerbAlly et ne modifie jamais automatiquement une fiche publiée."
                : "HerbAlly uses LinkedIn OpenID Connect (openid, profile, email) to verify reviewer identity before accepting proposed clinical edits. This session is separate from standard reader accounts and never auto-edits published pages."}
            </p>
          </div>

          {session && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loggingOut}
              onClick={handleLogout}
              className="gap-1.5"
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              {fr ? "Déconnexion LinkedIn" : "Sign out of LinkedIn"}
            </Button>
          )}
        </div>

        {authErrorText && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{authErrorText}</span>
          </div>
        )}

        {session ? (
          <div className="mt-5 flex flex-wrap items-center gap-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/25">
            <div
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#0A66C2] text-sm font-bold text-white"
            >
              {getInitials(session.name)}
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-foreground">
                  {session.name}
                </span>
                <Badge
                  variant="secondary"
                  className="border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                >
                  <CheckCircle2 className="mr-1 size-3" aria-hidden="true" />
                  {fr
                    ? "Validé via LinkedIn SSO"
                    : "Validated via LinkedIn SSO"}
                </Badge>
                {session.emailVerified && (
                  <Badge variant="outline" className="text-xs">
                    {fr ? "Courriel vérifié" : "Verified email"}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{session.email}</p>
            </div>
          </div>
        ) : linkedinConfigured ? (
          <div className="mt-5 flex flex-wrap items-center gap-4">
            {/* Anchor avoids CSP form-action 'self' blocking cross-origin OAuth redirect */}
            <a
              href={linkedinStartHref}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#0A66C2] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#004182] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A66C2]/50"
            >
              <ShieldCheck className="size-4" aria-hidden="true" />
              {fr
                ? "Continuer avec LinkedIn SSO"
                : "Continue with LinkedIn SSO"}
            </a>
            <span className="text-xs text-muted-foreground">
              {fr
                ? "Portée minimale demandée : identité et adresse courriel."
                : "Minimal OIDC scope requested: name and email address only."}
            </span>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50/70 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="font-medium">
              {fr
                ? "Activation LinkedIn SSO en attente de configuration serveur"
                : "LinkedIn SSO setup pending server credentials"}
            </p>
            <p className="mt-1 text-xs leading-relaxed">
              {fr
                ? "L'authentification unique LinkedIn attend les identifiants OAuth du portail développeur sur le serveur. En attendant, vous pouvez envoyer toute correction clinique sourcée à "
                : "LinkedIn OAuth client credentials have not been added to this deployment yet. In the meantime, credentialed reviewers can send source-backed corrections directly to "}
              <a
                href="mailto:info@herbally.app"
                className="font-semibold underline underline-offset-2"
              >
                info@herbally.app
              </a>
              .
            </p>
          </div>
        )}
      </section>

      {/* Step 2: Structured Clinical Edit Submission Form */}
      <section
        aria-labelledby="edit-request-form-heading"
        className="rounded-2xl border border-border bg-card p-6 shadow-sm"
      >
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {fr
              ? "Étape 2 · Demande de modification sourcée"
              : "Step 2 · Source-Backed Edit Request"}
          </p>
          <h2
            id="edit-request-form-heading"
            className="text-xl font-semibold text-foreground"
          >
            {fr
              ? "Proposer une correction clinique ou bibliographique"
              : "Submit a clinical or evidence edit request"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {fr
              ? "Chaque soumission entre dans la file de vérification éditoriale et clinique (/admin/edit-requests) avec votre identité LinkedIn, vos titres professionnels et vos citations primaires."
              : "Every submission enters our editorial & clinical triage queue with your verified LinkedIn identity, credentials, and primary citations for review before publication."}
          </p>
        </div>

        {!session ? (
          <div className="mt-5 rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            {fr
              ? "Connectez-vous avec LinkedIn SSO ci-dessus pour déverrouiller le formulaire de demande de modification clinique."
              : "Sign in with LinkedIn SSO above to unlock the structured clinical edit request form."}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            {submitSuccessId && (
              <div
                role="status"
                className="flex items-start gap-2.5 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
              >
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-semibold">
                    {fr
                      ? "Demande enregistrée dans la file d'examen"
                      : "Edit request recorded in the triage queue"}
                  </p>
                  <p className="mt-0.5 text-xs">
                    {fr ? "Référence : " : "Reference ID: "}
                    <code>{submitSuccessId}</code>
                  </p>
                </div>
              </div>
            )}

            {submitError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Reviewer qualifications */}
            <div className="space-y-4 rounded-xl border border-border/80 bg-muted/20 p-4">
              <h3 className="text-sm font-semibold text-foreground">
                {fr
                  ? "Profil et titres professionnels"
                  : "Reviewer credentials & disclosure"}
              </h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="linkedin-profile-url">
                    {fr
                      ? "URL du profil LinkedIn *"
                      : "Public LinkedIn profile URL *"}
                  </Label>
                  <Input
                    id="linkedin-profile-url"
                    type="url"
                    required
                    value={linkedinProfileUrl}
                    onChange={(e) => setLinkedinProfileUrl(e.target.value)}
                    placeholder="https://www.linkedin.com/in/your-handle"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="professional-role">
                    {fr ? "Rôle clinique *" : "Clinical discipline *"}
                  </Label>
                  <select
                    id="professional-role"
                    value={professionalRole}
                    onChange={(e) =>
                      setProfessionalRole(e.target.value as ProfessionalRole)
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {PROFESSIONAL_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role][locale]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reviewer-credentials">
                    {fr ? "Titres et diplômes *" : "Post-nominal credentials *"}
                  </Label>
                  <Input
                    id="reviewer-credentials"
                    required
                    value={credentials}
                    onChange={(e) => setCredentials(e.target.value)}
                    placeholder={
                      fr ? "ex. PharmD, BCPS" : "e.g. PharmD, RPh, BCPS"
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reviewer-affiliation">
                    {fr
                      ? "Établissement / pratique (optionnel)"
                      : "Affiliation / practice setting (optional)"}
                  </Label>
                  <Input
                    id="reviewer-affiliation"
                    value={affiliation}
                    onChange={(e) => setAffiliation(e.target.value)}
                    placeholder={
                      fr
                        ? "ex. Pharmacie hospitalière, CUSM"
                        : "e.g. Community Pharmacy / Hospital Outpatient"
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="licence-number">
                    {fr
                      ? "Numéro de permis professionnel (privé, optionnel)"
                      : "Regulatory licence / registration number (private, optional)"}
                  </Label>
                  <Input
                    id="licence-number"
                    value={licenceNumber}
                    onChange={(e) => setLicenceNumber(e.target.value)}
                    placeholder={
                      fr ? "Jamais publié publiquement" : "Never shown publicly"
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="licence-jurisdiction">
                    {fr
                      ? "Ordre professionnel / juridiction (optionnel)"
                      : "Licensing body / jurisdiction (optional)"}
                  </Label>
                  <Input
                    id="licence-jurisdiction"
                    value={licenceJurisdiction}
                    onChange={(e) => setLicenceJurisdiction(e.target.value)}
                    placeholder="e.g. OCP Ontario / OPQ Quebec"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="conflict-of-interest">
                  {fr
                    ? "Déclaration de conflits d'intérêts *"
                    : "Conflict of interest disclosure *"}
                </Label>
                <Input
                  id="conflict-of-interest"
                  required
                  value={conflictOfInterest}
                  onChange={(e) => setConflictOfInterest(e.target.value)}
                  placeholder={
                    fr
                      ? "Aucun, ou précisez tout lien avec un fabricant"
                      : "None, or disclose any supplement/pharma financial ties"
                  }
                />
              </div>
            </div>

            {/* Target and proposed change */}
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="target-type">
                    {fr ? "Type de contenu *" : "Target record type *"}
                  </Label>
                  <select
                    id="target-type"
                    value={targetType}
                    onChange={(e) =>
                      setTargetType(e.target.value as EditTargetType)
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {EDIT_TARGET_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {TARGET_LABELS[type][locale]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="field-scope">
                    {fr ? "Section visée *" : "Field or section scope *"}
                  </Label>
                  <select
                    id="field-scope"
                    value={fieldScope}
                    onChange={(e) =>
                      setFieldScope(e.target.value as EditFieldScope)
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {EDIT_FIELD_SCOPES.map((sc) => (
                      <option key={sc} value={sc}>
                        {SCOPE_LABELS[sc][locale]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {(targetType === "herb" || targetType === "interaction") && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="herb-lookup">
                      {fr
                        ? "Rechercher une plante (assistant)"
                        : "Find herb slug (quick lookup)"}
                    </Label>
                    <div className="relative">
                      <Search
                        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Input
                        id="herb-lookup"
                        value={herbLookup}
                        onChange={(e) => {
                          const nextVal = e.target.value;
                          setHerbLookup(nextVal);
                          if (nextVal.trim().length < 2) {
                            setHerbSuggestions([]);
                          }
                        }}
                        placeholder={
                          fr
                            ? "ex. gingembre, curcuma..."
                            : "e.g. ginger, turmeric..."
                        }
                        className="pl-9"
                      />
                    </div>
                    {herbLookup.trim().length >= 2 &&
                      herbSuggestions.length > 0 && (
                        <ul className="divide-y divide-border rounded-lg border bg-background text-xs">
                          {herbSuggestions.map((h) => (
                            <li key={h.slug}>
                              <button
                                type="button"
                                onClick={() => {
                                  setHerbSlug(h.slug);
                                  setHerbLookup(h.name);
                                  setHerbSuggestions([]);
                                }}
                                className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted"
                              >
                                <span className="font-medium text-foreground">
                                  {h.name}{" "}
                                  <span className="italic text-muted-foreground">
                                    ({h.scientific_name})
                                  </span>
                                </span>
                                <span className="text-muted-foreground">
                                  {h.slug}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="herb-slug">
                      {fr ? "Slug de la plante *" : "Herb slug *"}
                    </Label>
                    <Input
                      id="herb-slug"
                      required
                      value={herbSlug}
                      onChange={(e) => setHerbSlug(e.target.value)}
                      placeholder="e.g. ginger"
                    />
                  </div>
                </div>
              )}

              {(targetType === "interaction" ||
                targetType === "medication") && (
                <div className="space-y-1.5">
                  <Label htmlFor="drug-name">
                    {fr
                      ? "Médicament ou classe *"
                      : "Medication or drug class *"}
                  </Label>
                  <Input
                    id="drug-name"
                    required
                    value={drugName}
                    onChange={(e) => setDrugName(e.target.value)}
                    placeholder={
                      fr ? "ex. Warfarin" : "e.g. Warfarin (Coumadin)"
                    }
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="surface-url">
                  {fr
                    ? "URL de la page concernée (optionnel)"
                    : "Page URL (optional)"}
                </Label>
                <Input
                  id="surface-url"
                  value={surfaceUrl}
                  onChange={(e) => setSurfaceUrl(e.target.value)}
                  placeholder="/interactions/ginger/warfarin"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-summary">
                  {fr ? "Résumé de la demande *" : "Concise change summary *"}
                </Label>
                <Input
                  id="edit-summary"
                  required
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder={
                    fr
                      ? "ex. Corriger le libellé contradictoire sur Ginger + Warfarine"
                      : "e.g. Reconcile Ginger + Warfarin severity & Br J Clin Pharmacol 2005 note"
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="current-text">
                  {fr
                    ? "Texte ou classement actuel (optionnel)"
                    : "Current published text or grade (optional)"}
                </Label>
                <textarea
                  id="current-text"
                  rows={2}
                  value={currentText}
                  onChange={(e) => setCurrentText(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder={
                    fr
                      ? "Copiez l'énoncé actuel à corriger..."
                      : "Paste the current wording or grade you are flagging..."
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="proposed-change">
                  {fr
                    ? "Modification proposée (texte ou niveau) *"
                    : "Proposed edit / corrected classification *"}
                </Label>
                <textarea
                  id="proposed-change"
                  required
                  rows={4}
                  value={proposedChange}
                  onChange={(e) => setProposedChange(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder={
                    fr
                      ? "Décrivez précisément la nouvelle formulation, la préparation et la gravité ou note de preuve..."
                      : "Provide exact replacement wording, preparation distinctions (food vs extract), or proposed classification..."
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="clinical-rationale">
                  {fr
                    ? "Justification clinique et limites *"
                    : "Clinical rationale & certainty limits *"}
                </Label>
                <textarea
                  id="clinical-rationale"
                  required
                  rows={4}
                  value={clinicalRationale}
                  onChange={(e) => setClinicalRationale(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder={
                    fr
                      ? "Expliquez les données humaines vs précliniques et pourquoi cette modification améliore la sécurité..."
                      : "Summarize human vs preclinical data, study sample/dose limitations, and clinical safety reasoning..."
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="citations-text">
                  {fr
                    ? "Citations primaires (1 par ligne : URL https://, PMID:... ou DOI:...) *"
                    : "Primary citations (one per line: https:// URL, PMID:..., or DOI:...) *"}
                </Label>
                <textarea
                  id="citations-text"
                  required
                  rows={3}
                  value={citationsText}
                  onChange={(e) => setCitationsText(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder={
                    "PMID:16097960\nhttps://pubmed.ncbi.nlm.nih.gov/32478963/"
                  }
                />
              </div>
            </div>

            {/* Attestations */}
            <div className="space-y-3 rounded-xl border border-border/80 bg-muted/20 p-4 text-xs">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={noPhiAttested}
                  onChange={(e) => setNoPhiAttested(e.target.checked)}
                  required
                  className="mt-0.5 size-4 rounded border-border"
                />
                <span className="text-foreground">
                  {fr
                    ? "Je confirme que cette soumission ne contient aucun renseignement de santé personnel ou identifiable d'un patient (requis)."
                    : "I confirm this submission contains no personal or patient-identifiable health information (required)."}
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={attributionConsent}
                  onChange={(e) => setAttributionConsent(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-border"
                />
                <span className="text-muted-foreground">
                  {fr
                    ? "Optionnel : j'autorise HerbAlly à mentionner mon nom et mes titres dans le journal public des corrections si cette modification est approuvée et publiée."
                    : "Optional: I consent to public credit (name and credentials) in the corrections log if this edit is approved and applied."}
                </span>
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {fr
                  ? "Les demandes sont relues manuellement avant toute publication."
                  : "Requests are manually verified before any live page changes."}
              </p>
              <Button type="submit" disabled={submitting} className="gap-2">
                <Send className="size-4" aria-hidden="true" />
                {submitting
                  ? fr
                    ? "Envoi en cours..."
                    : "Submitting..."
                  : fr
                    ? "Soumettre la demande"
                    : "Submit edit request"}
              </Button>
            </div>
          </form>
        )}
      </section>

      {/* Step 3: Reviewer's own submission history */}
      {session && (
        <section
          aria-labelledby="reviewer-history-heading"
          className="rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <h2
            id="reviewer-history-heading"
            className="flex items-center gap-2 text-lg font-semibold text-foreground"
          >
            <Clock className="size-4 text-primary" aria-hidden="true" />
            {fr
              ? "Vos demandes soumises avec ce profil LinkedIn"
              : "Your submitted edit requests"}
          </h2>

          {requests.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {fr
                ? "Aucune demande enregistrée pour cette session LinkedIn pour l'instant."
                : "No edit requests submitted from this LinkedIn account yet."}
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {requests.map((req) => {
                const badge = STATUS_BADGE[req.status] ?? STATUS_BADGE.pending;
                return (
                  <li
                    key={req.id}
                    className="rounded-xl border border-border/80 bg-background p-4 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">
                        {req.summary}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}
                      >
                        {fr ? badge.fr : badge.en}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[
                        req.target_type,
                        req.herb_slug,
                        req.drug_name,
                        req.field_scope,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      {" · "}
                      {new Date(req.created_at).toLocaleDateString(
                        fr ? "fr-CA" : "en-CA"
                      )}
                    </p>
                    {req.admin_notes && (
                      <p className="mt-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-foreground">
                        <span className="font-semibold">
                          {fr ? "Note éditoriale : " : "Editorial note: "}
                        </span>
                        {req.admin_notes}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <p className="mt-4 text-xs text-muted-foreground">
            <Link
              href="/methodology"
              className="inline-flex items-center gap-1 underline hover:text-foreground"
            >
              {fr
                ? "Consulter la méthodologie et les licences sources"
                : "Read HerbAlly methodology and source licences"}
              <ExternalLink className="size-3" aria-hidden="true" />
            </Link>
          </p>
        </section>
      )}
    </div>
  );
}
