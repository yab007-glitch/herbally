export interface Interaction {
  id: string;
  drug_name: string;
  severity: "mild" | "moderate" | "severe" | "contraindicated";
  description: string;
  /**
   * PubMed record supporting this pair, when one was found by title match.
   * Absent means no citation is recorded and the page must not imply one.
   */
  source_url?: string | null;
}
