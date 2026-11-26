import { isDangerousHerb } from "@/lib/data/dangerous-herbs";

export type SafetyVerdict = "safe" | "not_recommended" | "unknown";

export interface RouteSafetyInput {
  slug: string;
  pregnancy_safe: boolean | null | undefined;
  nursing_safe: boolean | null | undefined;
  pregnancy_safe_oral?: boolean | null | undefined;
  pregnancy_safe_topical?: boolean | null | undefined;
  nursing_safe_oral?: boolean | null | undefined;
  nursing_safe_topical?: boolean | null | undefined;
}

export interface CanonicalPregnancyNursingStatus {
  isDangerous: boolean;
  pregnancy: SafetyVerdict;
  nursing: SafetyVerdict;
  pregnancyRouteSplit: { oral: boolean; topical: boolean } | null;
  nursingRouteSplit: { oral: boolean; topical: boolean } | null;
}

function toVerdict(val: boolean | null | undefined): SafetyVerdict {
  if (val === true) return "safe";
  if (val === false) return "not_recommended";
  return "unknown";
}

function toRouteSplit(
  oral: boolean | null | undefined,
  topical: boolean | null | undefined
): { oral: boolean; topical: boolean } | null {
  if (
    oral === null ||
    oral === undefined ||
    topical === null ||
    topical === undefined ||
    oral === topical
  ) {
    return null;
  }
  return { oral, topical };
}

export function resolvePregnancyNursingStatus(
  herb: RouteSafetyInput
): CanonicalPregnancyNursingStatus {
  const isDangerous = isDangerousHerb(herb.slug);
  if (isDangerous) {
    return {
      isDangerous: true,
      pregnancy: "not_recommended",
      nursing: "not_recommended",
      pregnancyRouteSplit: null,
      nursingRouteSplit: null,
    };
  }

  return {
    isDangerous: false,
    pregnancy: toVerdict(herb.pregnancy_safe),
    nursing: toVerdict(herb.nursing_safe),
    pregnancyRouteSplit: toRouteSplit(
      herb.pregnancy_safe_oral,
      herb.pregnancy_safe_topical
    ),
    nursingRouteSplit: toRouteSplit(
      herb.nursing_safe_oral,
      herb.nursing_safe_topical
    ),
  };
}
