/**
 * Central reviewer registry.
 *
 * Named, credentialed human reviewers are the single strongest E-E-A-T trust
 * signal for a YMYL herbal-medicine site. Keeping them in one registry (rather
 * than free-text per herb) guarantees consistent, verifiable, linked
 * attribution wherever a reviewed herb is rendered — the herb page citation
 * box, structured data, and (future) a reviewer masthead.
 *
 * A herb is linked to a reviewer by storing the reviewer `id` (e.g.
 * "dawn-wong") OR the display `name` in the `herbs.reviewed_by` column.
 * `getReviewer()` resolves either form so existing free-text values keep
 * working, while new reviews should prefer the stable id.
 *
 * Only reviewers who have actually reviewed content appear here. Do NOT add a
 * reviewer until they have agreed and contributed — fabricated reviewer
 * attribution destroys the very trust this system is meant to build.
 */

import { getAnonClient } from "@/lib/supabase/anonymous";

function sanitizeFilterValue(value: string): string {
  return value.replace(/[,().*\\]/g, "").trim();
}

export interface ReviewerAffiliation {
  name: string;
  url?: string;
}

export type ReviewerRole = "editorial" | "clinical";

export interface Reviewer {
  id: string;
  /** Display name, e.g. "Dr. Dawn Wong". */
  name: string;
  /** Distinct role separating editorial curation from clinical sign-off. */
  role: ReviewerRole;
  /** Whether written public attribution consent is recorded in governance logs. */
  consentRecorded: boolean;
  /** Fail-closed gate: only reviewers with consent and verified review scope surface publicly. */
  publicAttributionAllowed: boolean;
  /** Whether regulatory/professional clinical licence was independently verified. */
  licenceNumberVerified?: boolean;
  /** Licensing board / jurisdiction (e.g. "CPSO Ontario"). */
  licenceJurisdiction?: string | null;
  /** ISO date when clinical licence expires. */
  licenceExpiresAt?: string | null;
  /** Short credential line shown inline, e.g. "MLT, OPTMQ · CSMLS". */
  credentials: string;
  /** Full qualification list for the reviewer profile/tooltip. */
  qualifications: string[];
  /** Primary affiliation summary line. */
  affiliation: string;
  /** Structured affiliations for rich rendering + schema.org. */
  affiliations: ReviewerAffiliation[];
  /** Clinical / research focus areas. */
  expertise: string[];
  languages?: string[];
  /** Authoritative external profile (the link we surface publicly). */
  profileUrl: string;
  /** Additional research profile, e.g. ResearchGate. */
  researchUrl?: string;
  bio: string;
}

export const REVIEWERS: Record<string, Reviewer> = {
  "yasser-bheekun": {
    id: "yasser-bheekun",
    name: "Yasser Bheekun",
    role: "editorial",
    consentRecorded: true,
    publicAttributionAllowed: true,
    credentials: "MLT, OPTMQ · CSMLS",
    qualifications: [
      "DEC in Biomedical Laboratory Technology, Dawson College (2016–2019)",
      "Diploma in Science (Biomedical Sciences), University of Mauritius (2007–2011)",
      "Medical Laboratory Technologist, OPTMQ — Ordre professionnel des technologistes médicaux du Québec",
      "Medical Laboratory Technologist, CSMLS — Canadian Society for Medical Laboratory Science",
    ],
    affiliation:
      "Hospital laboratory, McGill University Health Centre, Montreal",
    affiliations: [
      { name: "McGill University Health Centre — hospital laboratory" },
    ],
    expertise: [
      "Clinical laboratory science",
      "Herbal safety and drug interactions",
      "Evidence grading",
      "English/French medical writing",
    ],
    languages: ["English", "French"],
    profileUrl: "https://herbally.app/editorial-policy",
    bio: "Yasser Bheekun is a medical laboratory technologist certified with the OPTMQ and the CSMLS, with a DEC in Biomedical Laboratory Technology from Dawson College. He writes and maintains HerbAlly and is its editor and reviewer of record: he is answerable for what the site publishes, decides what may be stated as sourced, and labels anything that has not been clinically reviewed. He is not a licensed physician or herbalist, and the site does not claim clinical review it has not had.",
  },
  "dawn-wong": {
    id: "dawn-wong",
    name: "Dr. Dawn Wong",
    role: "clinical",
    consentRecorded: false,
    publicAttributionAllowed: false,
    credentials: "PhD (Health Sciences), BM (Chinese Medicine)",
    qualifications: [
      "Bachelor of Medicine (Chinese Medicine), Beijing University of Chinese Medicine",
      "PhD (Health Sciences), RMIT University",
      "Graduate Certificate in Mental Health Practice, Griffith University",
      "Accredited Mental Health First Aider, Mental Health First Aid",
    ],
    affiliation:
      "Hope Acupuncture & Chinese Medicine; RMIT University (Chinese Medicine programs)",
    affiliations: [
      {
        name: "Hope Acupuncture & Chinese Medicine",
        url: "https://www.hope-tcm.com",
      },
      {
        name: "RMIT University — Chinese Medicine programs",
        url: "https://www.rmit.edu.au",
      },
    ],
    expertise: [
      "Traditional Chinese Medicine",
      "Acupuncture for chronic musculoskeletal pain",
      "Digestive health",
      "Sleep & mental health",
    ],
    languages: ["English", "French", "Mandarin"],
    profileUrl: "https://www.hope-tcm.com/dr-dawn-wong",
    researchUrl: "https://www.researchgate.net/profile/Dawn-Wong-Lit-Wan",
    bio: "Dr. Dawn Wong is a Chinese medicine practitioner and educator. She graduated from Beijing University of Chinese Medicine and holds a PhD in Health Sciences from RMIT University, where her research explored the management of chronic musculoskeletal pain with acupuncture. She has taught in RMIT's undergraduate and postgraduate Chinese medicine programs since 2014 and practises at Hope Acupuncture & Chinese Medicine in Melbourne. Her clinical interests include chronic musculoskeletal pain, digestive issues, sleep and mental health.",
  },
};

/**
 * Resolve a publicly attributable reviewer from a `reviewed_by` reference.
 * Fails closed unless consent and public attribution are explicitly recorded.
 */
export function getPublicReviewer(ref?: string | null): Reviewer | null {
  if (!ref) return null;
  const key = ref.trim().toLowerCase();
  const candidate =
    REVIEWERS[key] ??
    Object.values(REVIEWERS).find((r) => r.name.toLowerCase() === key);
  if (!candidate) return null;
  if (!candidate.consentRecorded || !candidate.publicAttributionAllowed) {
    return null;
  }
  return candidate;
}

/**
 * Resolve a reviewer from a `reviewed_by` value that may be either the stable
 * registry id or the display name. Fails closed when consent/verification is absent.
 */
export function getReviewer(ref?: string | null): Reviewer | undefined {
  return getPublicReviewer(ref) ?? undefined;
}

interface ReviewerRegistryRow {
  reviewer_id?: string | null;
  display_name?: string | null;
  credentials?: string | null;
  reviewer_role?: string | null;
  consent_recorded?: boolean | null;
  public_attribution_allowed?: boolean | null;
  licence_number_verified?: boolean | null;
  licence_jurisdiction?: string | null;
  licence_expires_at?: string | null;
  verified_at?: string | null;
}

function isUnexpiredLicence(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return true;
  const parsed = Date.parse(expiresAt);
  return Number.isFinite(parsed) && parsed > Date.now();
}

function mapRegistryRowToReviewer(
  row: ReviewerRegistryRow,
  requireClinical: boolean
): Reviewer | null {
  if (!row.reviewer_id || !row.display_name) return null;
  if (row.consent_recorded !== true || !row.verified_at) return null;
  if (!requireClinical && row.public_attribution_allowed !== true) return null;

  const role: ReviewerRole =
    row.reviewer_role === "clinical" ? "clinical" : "editorial";
  if (requireClinical && role !== "clinical") return null;

  if (role === "clinical") {
    if (
      row.licence_number_verified !== true ||
      !isUnexpiredLicence(row.licence_expires_at)
    ) {
      return null;
    }
  }

  const staticBase = REVIEWERS[row.reviewer_id.trim().toLowerCase()];
  return {
    id: row.reviewer_id,
    name: row.display_name,
    role,
    consentRecorded: true,
    publicAttributionAllowed: Boolean(row.public_attribution_allowed),
    licenceNumberVerified: Boolean(row.licence_number_verified),
    licenceJurisdiction: row.licence_jurisdiction ?? null,
    licenceExpiresAt: row.licence_expires_at ?? null,
    credentials: row.credentials?.trim() || staticBase?.credentials || role,
    qualifications: staticBase?.qualifications ?? [],
    affiliation:
      row.licence_jurisdiction?.trim() || staticBase?.affiliation || "",
    affiliations: row.licence_jurisdiction?.trim()
      ? [{ name: row.licence_jurisdiction.trim() }]
      : (staticBase?.affiliations ?? []),
    expertise: staticBase?.expertise ?? [],
    languages: staticBase?.languages,
    profileUrl:
      staticBase?.profileUrl ?? "https://herbally.app/editorial-policy",
    researchUrl: staticBase?.researchUrl,
    bio: staticBase?.bio ?? "",
  };
}

async function queryReviewerRegistryRow(
  ref: string,
  client: unknown
): Promise<{ row: ReviewerRegistryRow | null; queried: boolean }> {
  const safe = sanitizeFilterValue(ref.trim());
  if (!safe) return { row: null, queried: false };
  try {
    const db = client as {
      from: (table: string) => {
        select: (cols: string) => {
          or: (filter: string) => {
            limit: (n: number) => {
              maybeSingle: () => Promise<{
                data: ReviewerRegistryRow | null;
                error: { code?: string; message?: string } | null;
              }>;
            };
          };
        };
      };
    };
    const { data, error } = await db
      .from("reviewer_registry")
      .select(
        "reviewer_id, display_name, credentials, reviewer_role, consent_recorded, public_attribution_allowed, licence_number_verified, licence_jurisdiction, licence_expires_at, verified_at"
      )
      .or(`reviewer_id.eq.${safe},display_name.ilike.${safe}`)
      .limit(1)
      .maybeSingle();

    if (error) return { row: null, queried: false };
    return { row: data ?? null, queried: true };
  } catch {
    return { row: null, queried: false };
  }
}

/**
 * Resolve a publicly attributable reviewer from `reviewer_registry` in DB,
 * falling back to consented static editorial metadata only when DB lookup is
 * unavailable/unseeded for a pre-consented entry (never bypassing consent or
 * clinical licence expiry on DB rows).
 */
export async function resolvePublicReviewerFromDb(
  ref?: string | null,
  client?: unknown
): Promise<Reviewer | null> {
  if (!ref || !ref.trim()) return null;
  const db = client ?? getAnonClient();
  if (db) {
    const { row, queried } = await queryReviewerRegistryRow(ref, db);
    if (queried && row) {
      return mapRegistryRowToReviewer(row, false);
    }
    if (queried && !row) {
      return getPublicReviewer(ref);
    }
  }
  return getPublicReviewer(ref);
}

/**
 * Verify a clinical reviewer against `reviewer_registry` before stamping
 * clinical sign-off (PubMed sheets or interactions). Requires explicit consent,
 * clinical role, verified licence number, verified timestamp, and non-expired licence.
 */
export async function resolveVerifiedClinicalReviewer(
  ref?: string | null,
  client?: unknown
): Promise<Reviewer | null> {
  if (!ref || !ref.trim() || !client) return null;
  const { row, queried } = await queryReviewerRegistryRow(ref, client);
  if (!queried || !row) return null;
  return mapRegistryRowToReviewer(row, true);
}
