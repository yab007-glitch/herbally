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

export interface ReviewerAffiliation {
  name: string;
  url?: string;
}

export interface Reviewer {
  id: string;
  /** Display name, e.g. "Dr. Dawn Wong". */
  name: string;
  /** Short credential line shown inline, e.g. "PhD, BM (Chinese Medicine)". */
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
  "dawn-wong": {
    id: "dawn-wong",
    name: "Dr. Dawn Wong",
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
 * Resolve a reviewer from a `reviewed_by` value that may be either the stable
 * registry id or the display name. Returns undefined for unregistered values
 * (e.g. the generic "Editorial Team" fallback), so callers can fall back to
 * the existing free-text rendering.
 */
export function getReviewer(ref?: string | null): Reviewer | undefined {
  if (!ref) return undefined;
  const key = ref.trim().toLowerCase();
  if (REVIEWERS[key]) return REVIEWERS[key];
  return Object.values(REVIEWERS).find((r) => r.name.toLowerCase() === key);
}
