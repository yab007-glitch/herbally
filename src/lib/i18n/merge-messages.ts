import type { AbstractIntlMessages } from "next-intl";

function isPlainObject(
  value: unknown
): value is Record<string, AbstractIntlMessages | string> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Deep-merges two `next-intl` message trees without mutating either input.
 * Used by client message scopes so a route-level subset extends `core`
 * without clobbering sibling keys in shared namespaces.
 */
export function mergeClientMessages(
  base: AbstractIntlMessages,
  extra: AbstractIntlMessages
): AbstractIntlMessages {
  const out: Record<string, AbstractIntlMessages | string> = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    const existing = out[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      out[key] = mergeClientMessages(
        existing as AbstractIntlMessages,
        value as AbstractIntlMessages
      );
    } else {
      out[key] = value as AbstractIntlMessages | string;
    }
  }
  return out as AbstractIntlMessages;
}
