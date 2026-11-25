import { AlertTriangle } from "lucide-react";

interface PrintSafetyFooterProps {
  locale?: "en" | "fr";
  adultAgeYears?: number | null;
}

/**
 * Shared printed-output safety notice attached to herb monographs, the adult
 * reference checker, stack summaries, and citation kits. Ensures printed
 * sheets always state adult-only scope (18+), no pediatric dosing, and
 * educational-only provenance boundaries.
 */
export function PrintSafetyFooter({
  locale = "en",
  adultAgeYears = null,
}: PrintSafetyFooterProps) {
  const isFr = locale === "fr";
  const hasAdultAge =
    typeof adultAgeYears === "number" &&
    Number.isFinite(adultAgeYears) &&
    adultAgeYears >= 18;

  return (
    <aside
      aria-label={
        isFr ? "Avis de sécurité à l'impression" : "Printed safety notice"
      }
      className="mt-4 rounded-xl border border-amber-300 bg-amber-50/70 p-3 text-xs leading-relaxed text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" />
        <div className="space-y-1">
          {hasAdultAge && (
            <p className="font-semibold">
              {isFr
                ? `Âge adulte confirmé : ${adultAgeYears} ans (18+ uniquement)`
                : `Confirmed adult age: ${adultAgeYears} years (adults 18+ only)`}
            </p>
          )}
          <p>
            {isFr
              ? "HerbAlly est un outil de référence éducatif réservé aux adultes âgés de 18 ans et plus. Aucune posologie pédiatrique ni formule d'ajustement par poids n'est calculée ou validée. Vérifiez toujours toute plante, dose ou interaction auprès d'un pharmacien ou d'un médecin."
              : "HerbAlly is an educational reference intended solely for adults aged 18+. Pediatric herbal dosing and weight-scaling formulas are unavailable and unvalidated. Confirm any herb, dose, or drug interaction with a licensed pharmacist or physician."}
          </p>
        </div>
      </div>
    </aside>
  );
}
