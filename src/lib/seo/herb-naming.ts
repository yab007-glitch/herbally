/**
 * Latin binomials are recorded as the herb's own name for 1,134 of the 2,699
 * published herbs (there is no common name in either language for most obscure
 * species). Interpolating both fields then renders the binomial twice:
 * "Silybum marianum (Silybum marianum) : bienfaits…", which reads as machine
 * output and burns ~40 characters of a 60-character snippet.
 */
export interface HerbNaming {
  name: string;
  scientific_name: string;
}

/** True when the herb has a name of its own, not just its Latin binomial. */
export function hasDistinctCommonName(herb: HerbNaming): boolean {
  return (
    herb.name.trim().toLowerCase() !== herb.scientific_name.trim().toLowerCase()
  );
}
