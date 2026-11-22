/** The regulator's own record for a herb (Health Canada LNHPD today). */
export interface VerifiedRegulatory {
  source: string;
  purposes: string[];
  doses: string[];
  risks: string[];
  urls: string[];
}

/** An imported regulator monograph (NCCIH, EMA HMPC, LiverTox, …). */
export interface VerifiedMonograph {
  source: string;
  licence: string | null;
  claims: string[];
  safety: string[];
  doses: string[];
  url: string | null;
}

/**
 * The compiled information sheet (herb_pubmed_monographs), written from PubMed
 * abstracts. Derived, not a regulator — the prompt says so — but for the ~2,000
 * herbs with no imported monograph it is the only record of what the clinical
 * literature says, which is exactly what the herbalist kept missing.
 */
export interface VerifiedInformationSheet {
  summary: string | null;
  traditional_uses: string | null;
  dosage: string | null;
  safety: string | null;
  pregnancy: string | null;
  drug_interactions: string | null;
  article_count: number | null;
  pmids: string[];
}

export interface VerifiedHerb {
  slug: string;
  name: string;
  scientific_name: string;
  description: string;
  traditional_uses: string[];
  modern_uses: string[];
  contraindications: string[];
  side_effects: string[];
  drug_interactions: string[];
  dosage_adult: string | null;
  pregnancy_safe: boolean | null;
  nursing_safe: boolean | null;
  pregnancy_safe_oral: boolean | null;
  pregnancy_safe_topical: boolean | null;
  nursing_safe_oral: boolean | null;
  nursing_safe_topical: boolean | null;
  evidence_level: string | null;
  active_compounds: string[];
  provenance_method: string | null;
  /** The regulator's own record, when one exists (Health Canada LNHPD). */
  regulatory: VerifiedRegulatory | null;
  /** Imported monographs for this herb (EMA HMPC, NCCIH, LiverTox, …). */
  monographs: VerifiedMonograph[];
  /** PubMed-compiled information sheet, when the database has one. */
  information_sheet: VerifiedInformationSheet | null;
}

export interface VerifiedInteraction {
  herb_name: string;
  drug_name: string;
  severity: string;
  mechanism: string;
  evidence: string;
  recommendation: string;
}

export interface VerifiedContext {
  herbs: VerifiedHerb[];
  interactions: VerifiedInteraction[];
  medicationsMentioned: string[];
  source: "database" | "none";
  note: string;
}
