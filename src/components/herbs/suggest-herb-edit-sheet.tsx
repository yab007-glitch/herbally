"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  LogOut,
  Pencil,
  Send,
  ShieldCheck,
} from "lucide-react";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  EDIT_FIELD_SCOPES,
  PROFESSIONAL_ROLES,
  type EditFieldScope,
  type ProfessionalRole,
} from "@/lib/governance/clinical-edits";

interface SessionUser {
  name: string;
  email: string;
  emailVerified: boolean;
}

interface SubmittedHerbSuggestion {
  id: string;
  field_scope: string;
  summary: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

const SCOPE_LABELS: Record<EditFieldScope, { en: string; fr: string }> = {
  monograph_narrative: {
    en: "Uses, description, or overview",
    fr: "Usages, description ou aperçu",
  },
  dosage_safety: {
    en: "Adult dosage & preparation",
    fr: "Posologie adulte et préparation",
  },
  drug_interaction: {
    en: "Drug interaction details",
    fr: "Interactions médicamenteuses",
  },
  contraindications_pregnancy: {
    en: "Contraindications / pregnancy & nursing",
    fr: "Contre-indications / grossesse et allaitement",
  },
  citations_sources: {
    en: "Sources & primary citations",
    fr: "Sources et citations primaires",
  },
  evidence_grade: {
    en: "Evidence level note",
    fr: "Niveau de preuve",
  },
  translation_fr: {
    en: "French wording / translation",
    fr: "Formulation ou traduction en français",
  },
  other: {
    en: "Other accuracy fix",
    fr: "Autre correction",
  },
};

const ROLE_LABELS: Record<ProfessionalRole, { en: string; fr: string }> = {
  community_user: {
    en: "General user / contributor",
    fr: "Utilisateur / contributeur",
  },
  researcher_educator: {
    en: "Herbal researcher / educator",
    fr: "Chercheur / éducateur en phytothérapie",
  },
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
    en: "Other credentialed clinician",
    fr: "Autre clinicien(ne) diplômé(e)",
  },
};

const STATUS_LABEL: Record<string, { en: string; fr: string }> = {
  pending: { en: "Pending review", fr: "En attente" },
  under_review: { en: "Under review", fr: "En cours d'examen" },
  needs_info: { en: "Needs info", fr: "Précisions demandées" },
  approved: { en: "Approved", fr: "Approuvé" },
  applied: { en: "Applied", fr: "Appliqué" },
  rejected: { en: "Declined", fr: "Refusé" },
};

function authErrorCopy(code: string | null, fr: boolean): string | null {
  if (!code) return null;
  switch (code) {
    case "not_configured":
      return fr
        ? "LinkedIn SSO n'est pas encore configuré sur ce serveur."
        : "LinkedIn SSO is awaiting OAuth credentials on this server.";
    case "cancelled":
      return fr
        ? "Connexion LinkedIn annulée avant la fin."
        : "LinkedIn sign-in was cancelled before completion.";
    case "invalid_state":
      return fr
        ? "La session LinkedIn a expiré. Veuillez réessayer."
        : "Your LinkedIn sign-in session expired. Please try again.";
    case "rate_limited":
      return fr
        ? "Trop de tentatives. Réessayez dans une minute."
        : "Too many sign-in attempts. Please wait a minute.";
    default:
      return fr
        ? "Impossible de finaliser la connexion LinkedIn."
        : "Could not complete LinkedIn sign-in.";
  }
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

async function fetchSessionAndHistory(herbSlug: string): Promise<{
  configured: boolean;
  session: SessionUser | null;
  requests: SubmittedHerbSuggestion[];
}> {
  try {
    const res = await fetch("/api/auth/linkedin/session", {
      cache: "no-store",
    });
    if (!res.ok) {
      return { configured: true, session: null, requests: [] };
    }
    const json = (await res.json()) as {
      configured?: boolean;
      authenticated?: boolean;
      reviewer?: SessionUser | null;
    };
    const configured = Boolean(json.configured);
    const session = json.authenticated && json.reviewer ? json.reviewer : null;
    if (!session) {
      return { configured, session: null, requests: [] };
    }

    const histRes = await fetch(
      `/api/clinical-edits?herbSlug=${encodeURIComponent(herbSlug)}`,
      { cache: "no-store" }
    );
    if (!histRes.ok) {
      return { configured, session, requests: [] };
    }
    const histJson = (await histRes.json()) as {
      requests?: SubmittedHerbSuggestion[];
    };
    return {
      configured,
      session,
      requests: Array.isArray(histJson.requests) ? histJson.requests : [],
    };
  } catch {
    return { configured: false, session: null, requests: [] };
  }
}

export function SuggestHerbEditSheet({
  herbSlug,
  herbName,
}: {
  herbSlug: string;
  herbName: string;
}) {
  const fr = useLocale() === "fr";
  const [open, setOpen] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [linkedinConfigured, setLinkedinConfigured] = useState(true);
  const [session, setSession] = useState<SessionUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [requests, setRequests] = useState<SubmittedHerbSuggestion[]>([]);

  const [fieldScope, setFieldScope] = useState<EditFieldScope>(
    "monograph_narrative"
  );
  const [summary, setSummary] = useState("");
  const [proposedChange, setProposedChange] = useState("");
  const [currentText, setCurrentText] = useState("");
  const [citationsText, setCitationsText] = useState("");

  const [professionalRole, setProfessionalRole] =
    useState<ProfessionalRole>("community_user");
  const [credentials, setCredentials] = useState("");
  const [linkedinProfileUrl, setLinkedinProfileUrl] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [licenceNumber, setLicenceNumber] = useState("");
  const [licenceJurisdiction, setLicenceJurisdiction] = useState("");
  const [conflictOfInterest, setConflictOfInterest] = useState("");
  const [attributionConsent, setAttributionConsent] = useState(false);
  const [noPhiAttested, setNoPhiAttested] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccessId, setSubmitSuccessId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("suggestEdit") !== "1") return;
    const err = params.get("authError");
    const fieldParam = params.get("field");
    let cancelled = false;
    void (async () => {
      const status = await fetchSessionAndHistory(herbSlug);
      if (cancelled) return;
      if (err) setAuthError(err);
      if (
        fieldParam &&
        EDIT_FIELD_SCOPES.includes(fieldParam as EditFieldScope)
      ) {
        setFieldScope(fieldParam as EditFieldScope);
      }
      setLinkedinConfigured(status.configured);
      setSession(status.session);
      setRequests(status.requests);
      setLoadingStatus(false);
      setOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [herbSlug]);

  async function handleOpenDrawer() {
    setOpen(true);
    setLoadingStatus(true);
    const status = await fetchSessionAndHistory(herbSlug);
    setLinkedinConfigured(status.configured);
    setSession(status.session);
    setRequests(status.requests);
    setLoadingStatus(false);
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/linkedin/logout", { method: "POST" });
      setSession(null);
      setRequests([]);
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

    const herbPath = `${fr ? "/fr" : ""}/herbs/${herbSlug}`;

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
          targetType: "herb",
          herbSlug,
          drugName: "",
          surfaceUrl: herbPath,
          fieldScope,
          summary,
          currentText,
          proposedChange,
          clinicalRationale: "",
          citations: citationsText,
          locale: fr ? "fr" : "en",
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
              ? "Impossible d'enregistrer votre suggestion."
              : "Could not submit your edit suggestion.")
        );
        return;
      }

      setSubmitSuccessId(json.id);
      setRequests((prev) => [
        {
          id: json.id!,
          field_scope: fieldScope,
          summary: summary.trim(),
          status: json.status ?? "pending",
          admin_notes: null,
          created_at: json.createdAt ?? new Date().toISOString(),
        },
        ...prev,
      ]);
      setSummary("");
      setProposedChange("");
      setCurrentText("");
      setCitationsText("");
      setNoPhiAttested(false);
    } catch {
      setSubmitError(
        fr
          ? "Erreur réseau lors de l'envoi."
          : "Network error while submitting your suggestion."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const nextUrl = `${fr ? "/fr" : ""}/herbs/${herbSlug}?suggestEdit=1`;
  const linkedinStartHref = `/api/auth/linkedin/start?next=${encodeURIComponent(nextUrl)}`;
  const authErrorText = authErrorCopy(authError, fr);
  const mailSubject = encodeURIComponent(
    fr
      ? `Suggestion de modification — ${herbName} (${herbSlug})`
      : `Herb edit suggestion — ${herbName} (${herbSlug})`
  );

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void handleOpenDrawer()}
        className="min-h-10 rounded-full px-4"
      >
        <Pencil className="mr-1.5 size-3.5" aria-hidden="true" />
        {fr ? "Suggérer une modification" : "Suggest an edit"}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-lg"
        >
          <SheetHeader className="border-b border-border pb-4 pr-10">
            <SheetTitle>
              {fr
                ? `Suggérer une modification — ${herbName}`
                : `Suggest an edit — ${herbName}`}
            </SheetTitle>
            <SheetDescription>
              {fr
                ? "Connectez-vous avec LinkedIn pour proposer une correction ou un ajout sur cette fiche. Toute suggestion est relue avant publication."
                : "Sign in with LinkedIn to suggest an edit or source addition for this herb. Suggestions are reviewed before updating the page."}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 p-4">
            {authErrorText && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{authErrorText}</span>
              </div>
            )}

            {loadingStatus ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {fr
                  ? "Vérification de la session LinkedIn..."
                  : "Checking LinkedIn session..."}
              </p>
            ) : !session ? (
              <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium text-foreground">
                  {fr
                    ? "Étape 1 · Continuer avec LinkedIn"
                    : "Step 1 · Continue with LinkedIn"}
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {fr
                    ? "HerbAlly utilise LinkedIn SSO pour vérifier votre nom et votre courriel afin de prévenir le spam et d'attribuer les suggestions. Vous reviendrez directement sur cette fiche."
                    : "HerbAlly uses LinkedIn SSO to verify your name and email so suggestions stay accountable and spam-free. You will return straight back to this herb page."}
                </p>

                {linkedinConfigured ? (
                  <a
                    href={linkedinStartHref}
                    className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#0A66C2] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#004182] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A66C2]/50"
                  >
                    <ShieldCheck className="size-4" aria-hidden="true" />
                    {fr
                      ? "Continuer avec LinkedIn SSO"
                      : "Continue with LinkedIn SSO"}
                  </a>
                ) : (
                  <div className="rounded-lg border border-amber-300 bg-amber-50/80 p-3 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    <p className="font-semibold">
                      {fr
                        ? "LinkedIn SSO en attente de configuration serveur"
                        : "LinkedIn SSO setup pending server credentials"}
                    </p>
                    <p className="mt-1">
                      {fr
                        ? "En attendant l'activation OAuth, envoyez votre suggestion pour cette plante à "
                        : "Until OAuth credentials are configured on the server, email your edit suggestion to "}
                      <a
                        href={`mailto:info@herbally.app?subject=${mailSubject}`}
                        className="font-semibold underline underline-offset-2"
                      >
                        info@herbally.app
                      </a>
                      .
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/25">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      aria-hidden="true"
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#0A66C2] text-xs font-bold text-white"
                    >
                      {getInitials(session.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-foreground">
                          {session.name}
                        </span>
                        <Badge
                          variant="secondary"
                          className="border-emerald-300 bg-emerald-100 text-[11px] text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                        >
                          LinkedIn
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {session.email}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loggingOut}
                    onClick={() => void handleLogout()}
                    className="h-8 gap-1 text-xs"
                  >
                    <LogOut className="size-3" aria-hidden="true" />
                    {fr ? "Déconnexion" : "Sign out"}
                  </Button>
                </div>

                <form
                  onSubmit={(e) => void handleSubmit(e)}
                  className="space-y-4"
                >
                  {submitSuccessId && (
                    <div
                      role="status"
                      className="flex items-start gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
                    >
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                      <div>
                        <p className="font-semibold">
                          {fr
                            ? "Merci ! Suggestion enregistrée pour examen."
                            : "Thanks! Your edit suggestion is queued for review."}
                        </p>
                        <p className="mt-0.5 text-[11px]">
                          {fr ? "Référence : " : "Reference: "}
                          <code>{submitSuccessId}</code>
                        </p>
                      </div>
                    </div>
                  )}

                  {submitError && (
                    <div
                      role="alert"
                      className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
                    >
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="herb-edit-scope" className="text-xs">
                      {fr ? "Section à améliorer *" : "Section to update *"}
                    </Label>
                    <select
                      id="herb-edit-scope"
                      value={fieldScope}
                      onChange={(e) =>
                        setFieldScope(e.target.value as EditFieldScope)
                      }
                      className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      {EDIT_FIELD_SCOPES.map((sc) => (
                        <option key={sc} value={sc}>
                          {SCOPE_LABELS[sc][fr ? "fr" : "en"]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="herb-edit-summary" className="text-xs">
                      {fr
                        ? "Résumé court de votre suggestion *"
                        : "Short summary *"}
                    </Label>
                    <Input
                      id="herb-edit-summary"
                      required
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      placeholder={
                        fr
                          ? `ex. Préciser la préparation sur ${herbName}`
                          : `e.g. Clarify standardized extract wording on ${herbName}`
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="herb-edit-proposed" className="text-xs">
                      {fr ? "Modification proposée *" : "Suggested edit *"}
                    </Label>
                    <textarea
                      id="herb-edit-proposed"
                      required
                      rows={4}
                      value={proposedChange}
                      onChange={(e) => setProposedChange(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder={
                        fr
                          ? "Décrivez ce qui devrait être corrigé, précisé ou ajouté sur cette fiche..."
                          : "Describe what should be corrected, clarified, or added to this herb..."
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="herb-edit-current" className="text-xs">
                      {fr
                        ? "Passage actuel concerné (optionnel)"
                        : "Current wording on the page (optional)"}
                    </Label>
                    <textarea
                      id="herb-edit-current"
                      rows={2}
                      value={currentText}
                      onChange={(e) => setCurrentText(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder={
                        fr
                          ? "Copiez la phrase actuelle si applicable..."
                          : "Paste the line you are referring to if helpful..."
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="herb-edit-citations" className="text-xs">
                      {fr
                        ? "Source à l'appui : URL https://, PMID:... ou DOI:... (optionnel)"
                        : "Supporting source link, PMID, or DOI (optional)"}
                    </Label>
                    <textarea
                      id="herb-edit-citations"
                      rows={2}
                      value={citationsText}
                      onChange={(e) => setCitationsText(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="https://pubmed.ncbi.nlm.nih.gov/... or PMID:16097960"
                    />
                  </div>

                  <details className="rounded-lg border border-border bg-muted/20 p-3 text-xs">
                    <summary className="cursor-pointer font-medium text-foreground">
                      {fr
                        ? "Optionnel : ajouter un profil ou titre clinique"
                        : "Optional: add background or clinical credentials"}
                    </summary>
                    <div className="mt-3 space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor="herb-edit-role" className="text-xs">
                          {fr ? "Rôle / contexte" : "Role / background"}
                        </Label>
                        <select
                          id="herb-edit-role"
                          value={professionalRole}
                          onChange={(e) =>
                            setProfessionalRole(
                              e.target.value as ProfessionalRole
                            )
                          }
                          className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                        >
                          {PROFESSIONAL_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role][fr ? "fr" : "en"]}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label
                            htmlFor="herb-edit-credentials"
                            className="text-xs"
                          >
                            {fr ? "Titres (optionnel)" : "Credentials"}
                          </Label>
                          <Input
                            id="herb-edit-credentials"
                            value={credentials}
                            onChange={(e) => setCredentials(e.target.value)}
                            placeholder="e.g. PharmD, RN, MSc"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label
                            htmlFor="herb-edit-affiliation"
                            className="text-xs"
                          >
                            {fr ? "Établissement" : "Affiliation"}
                          </Label>
                          <Input
                            id="herb-edit-affiliation"
                            value={affiliation}
                            onChange={(e) => setAffiliation(e.target.value)}
                            placeholder={
                              fr ? "ex. Clinique, Université" : "e.g. Clinic"
                            }
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="herb-edit-li-url" className="text-xs">
                          {fr ? "Profil LinkedIn" : "LinkedIn profile URL"}
                        </Label>
                        <Input
                          id="herb-edit-li-url"
                          type="url"
                          value={linkedinProfileUrl}
                          onChange={(e) =>
                            setLinkedinProfileUrl(e.target.value)
                          }
                          placeholder="https://www.linkedin.com/in/your-handle"
                          className="h-8 text-xs"
                        />
                      </div>

                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label
                            htmlFor="herb-edit-licence"
                            className="text-xs"
                          >
                            {fr
                              ? "No de permis (privé)"
                              : "Licence number (private)"}
                          </Label>
                          <Input
                            id="herb-edit-licence"
                            value={licenceNumber}
                            onChange={(e) => setLicenceNumber(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label
                            htmlFor="herb-edit-jurisdiction"
                            className="text-xs"
                          >
                            {fr ? "Ordre / pays" : "Jurisdiction"}
                          </Label>
                          <Input
                            id="herb-edit-jurisdiction"
                            value={licenceJurisdiction}
                            onChange={(e) =>
                              setLicenceJurisdiction(e.target.value)
                            }
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="herb-edit-coi" className="text-xs">
                          {fr ? "Conflit d'intérêts" : "Conflict of interest"}
                        </Label>
                        <Input
                          id="herb-edit-coi"
                          value={conflictOfInterest}
                          onChange={(e) =>
                            setConflictOfInterest(e.target.value)
                          }
                          placeholder={fr ? "Aucun" : "None"}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  </details>

                  <div className="space-y-2.5 rounded-lg border border-border bg-muted/20 p-3 text-xs">
                    <label className="flex cursor-pointer items-start gap-2">
                      <input
                        type="checkbox"
                        required
                        checked={noPhiAttested}
                        onChange={(e) => setNoPhiAttested(e.target.checked)}
                        className="mt-0.5 size-4 rounded border-border"
                      />
                      <span>
                        {fr
                          ? "Je confirme ne fournir aucun renseignement personnel sur un patient (requis)."
                          : "I confirm this contains no personal or patient health information (required)."}
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={attributionConsent}
                        onChange={(e) =>
                          setAttributionConsent(e.target.checked)
                        }
                        className="mt-0.5 size-4 rounded border-border"
                      />
                      <span>
                        {fr
                          ? "Optionnel : afficher mon nom dans le journal public des corrections si cette modification est appliquée."
                          : "Optional: credit my name in the public corrections log if applied."}
                      </span>
                    </label>
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full gap-2"
                  >
                    <Send className="size-4" aria-hidden="true" />
                    {submitting
                      ? fr
                        ? "Envoi..."
                        : "Submitting..."
                      : fr
                        ? "Envoyer la suggestion"
                        : "Submit edit suggestion"}
                  </Button>
                </form>

                {requests.length > 0 && (
                  <div className="space-y-2 border-t border-border pt-4">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <Clock
                        className="size-3.5 text-primary"
                        aria-hidden="true"
                      />
                      {fr
                        ? `Vos suggestions sur ${herbName}`
                        : `Your suggestions for ${herbName}`}
                    </p>
                    <ul className="space-y-2">
                      {requests.slice(0, 5).map((r) => {
                        const st = STATUS_LABEL[r.status] ?? {
                          en: r.status,
                          fr: r.status,
                        };
                        return (
                          <li
                            key={r.id}
                            className="rounded-lg border border-border bg-background p-2.5 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-foreground">
                                {r.summary}
                              </span>
                              <Badge
                                variant="secondary"
                                className="text-[11px]"
                              >
                                {fr ? st.fr : st.en}
                              </Badge>
                            </div>
                            {r.admin_notes && (
                              <p className="mt-1 text-muted-foreground">
                                {r.admin_notes}
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </>
            )}

            <p className="border-t border-border pt-3 text-xs text-muted-foreground">
              <Link
                href={`/clinical-review?targetType=herb&slug=${herbSlug}`}
                rel="nofollow"
                className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
              >
                {fr
                  ? "Ouvrir le formulaire complet (plantes & interactions)"
                  : "Open full edit portal (herbs & drug interactions)"}
                <ExternalLink className="size-3" aria-hidden="true" />
              </Link>
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
