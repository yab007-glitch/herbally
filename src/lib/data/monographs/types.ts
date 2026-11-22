export interface Monograph {
  slug: string;
  summary: string;
  mechanism: string;
  claims: {
    claim: string;
    evidence: "A" | "B" | "C" | "D" | "trad";
    note?: string;
  }[];
  safetyNotes: string[];
  drugInteractions: {
    drug: string;
    severity: "mild" | "moderate" | "severe" | "contraindicated";
    detail: string;
  }[];
  pregnancyCategory: "safe" | "caution" | "unsafe" | "insufficient";
  keyCitations: {
    source: string;
    title: string;
    url?: string;
    year?: number;
  }[];
}
