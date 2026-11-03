/**
 * Shared taxonomy predicates for the herb fact guard and the name-correction
 * applier. Both scripts must agree on what "drifted" and "phantom" mean, or a
 * record the guard rejects can never be repaired by the applier.
 */

/**
 * A stored `current_name` that disagrees with the row's scientific name.
 * `null`/`undefined` means the record makes no claim, which is not drift.
 */
export function hasCurrentNameDrift(tax, scientificName) {
  return (
    Boolean(tax) &&
    tax.current_name !== null &&
    tax.current_name !== undefined &&
    tax.current_name !== scientificName
  );
}

/**
 * A second source claimed with no record behind it. Empty strings count as
 * missing, matching the guard: `""` is how a trimmed export drops a value, not
 * evidence of a source.
 */
export function hasPhantomSecondSource(tax) {
  return (
    Boolean(tax) &&
    Boolean(tax.second_source) &&
    !tax.second_source_name &&
    !tax.second_source_taxid
  );
}
