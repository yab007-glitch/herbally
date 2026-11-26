import type { VerifiedContext } from "./context/types";

export function collectAllowedPmids(
  verifiedContext?: VerifiedContext | null
): Set<string> {
  const allowed = new Set<string>();
  if (!verifiedContext) return allowed;
  for (const herb of verifiedContext.herbs) {
    for (const pmid of herb.information_sheet?.pmids ?? []) {
      const clean = String(pmid).trim();
      if (/^\d{5,9}$/.test(clean)) allowed.add(clean);
    }
  }
  return allowed;
}

/**
 * Strip LLM-invented PMIDs or PubMed article URLs whose PMID was NOT retrieved
 * from the verified HerbAlly database context, preventing hallucinated primary
 * research links from rendering as authoritative citations.
 */
export function sanitizeUnverifiedPmids(
  text: string,
  allowedPmids: ReadonlySet<string>,
  locale: "en" | "fr"
): string {
  const replacement =
    locale === "fr"
      ? "[référence PubMed non confirmée en base — à vérifier]"
      : "[unverified PubMed reference — confirm on PubMed]";

  let out = text.replace(
    /https?:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/(\d{5,9})\/?/gi,
    (match, pmid: string) => (allowedPmids.has(pmid) ? match : replacement)
  );

  out = out.replace(/\bPMID[:\s]*(\d{5,9})\b/gi, (match, pmid: string) =>
    allowedPmids.has(pmid) ? match : replacement
  );

  return out;
}

/**
 * Deterministically append database-grounded HerbAlly profile, regulator, and
 * stored PubMed links after non-blocked database-backed responses.
 */
export function buildVerifiedSourcesFooter(
  verifiedContext: VerifiedContext | null | undefined,
  locale: "en" | "fr"
): string {
  if (!verifiedContext || verifiedContext.source !== "database") return "";
  if (verifiedContext.herbs.length === 0) return "";

  const lines: string[] = [];
  const prefix = locale === "fr" ? "/fr" : "";
  const heading =
    locale === "fr"
      ? "### Sources de la base HerbAlly consultées"
      : "### HerbAlly Database Records Referenced";

  for (const herb of verifiedContext.herbs.slice(0, 3)) {
    const parts: string[] = [];
    if (herb.slug) {
      parts.push(`[HerbAlly: ${herb.name}](${prefix}/herbs/${herb.slug})`);
    } else {
      parts.push(herb.name);
    }
    const regUrl = herb.regulatory?.urls?.[0];
    if (regUrl) {
      parts.push(`[${herb.regulatory?.source || "Regulator"}](${regUrl})`);
    }
    for (const m of herb.monographs.slice(0, 2)) {
      if (m.url) parts.push(`[${m.source}](${m.url})`);
    }
    const pmids = (herb.information_sheet?.pmids ?? [])
      .filter((p) => /^\d{5,9}$/.test(String(p).trim()))
      .slice(0, 3);
    if (pmids.length > 0) {
      parts.push(
        ...pmids.map(
          (pmid) => `[PMID ${pmid}](https://pubmed.ncbi.nlm.nih.gov/${pmid}/)`
        )
      );
    }
    lines.push(`- ${parts.join(" · ")}`);
  }

  if (lines.length === 0) return "";
  const note =
    locale === "fr"
      ? "*Liens ci-dessus extraits directement de la base HerbAlly (séparés du texte de synthèse généré par l'IA).*"
      : "*Links above are retrieved directly from HerbAlly database records, separate from AI-generated prose.*";

  return `\n\n---\n${heading}\n${lines.join("\n")}\n${note}`;
}
