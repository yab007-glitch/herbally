import { PubmedMonographSheetView } from "@/components/herbs/pubmed-monograph-sheet-view";

export interface ClinicalEvidence {
  condition?: string;
  finding?: string;
  evidenceLevel?: string;
  pmids?: string[];
}
export interface SheetContent {
  title?: string;
  summary?: string;
  background?: string;
  traditionalUses?: string;
  activeCompounds?: string;
  mechanismOfAction?: string;
  clinicalEvidence?: ClinicalEvidence[];
  safetyAndAdverseEffects?: string;
  pregnancyAndLactation?: string;
  drugInteractions?: string;
  dosageAndAdministration?: string;
  evidenceSummary?: string;
}
export interface Citation {
  pmid?: string;
  title?: string;
  journal?: string;
  year?: string | null;
  pubtype?: string[];
  url?: string;
  evidenceLevel?: string;
}
interface Props {
  content: SheetContent;
  citations: Citation[];
  articleCount: number;
  status: string | null;
  isDangerous?: boolean;
}

export function PubmedMonographSheet({
  content,
  citations,
  articleCount,
  status,
  isDangerous = false,
}: Props) {
  return (
    <PubmedMonographSheetView
      content={content}
      citations={citations}
      articleCount={articleCount}
      status={status}
      isDangerous={isDangerous}
    />
  );
}
