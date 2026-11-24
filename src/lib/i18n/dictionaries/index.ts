import type { AbstractIntlMessages } from "next-intl";
import type { Locale } from "../config";
import { mergeClientMessages } from "../merge-messages";
import enClinical from "./en/clinical.json";
import enCore from "./en/core.json";
import enHerbs from "./en/herbs.json";
import enMarketing from "./en/marketing.json";
import enServer from "./en/server.json";
import enTools from "./en/tools.json";
import frClinical from "./fr/clinical.json";
import frCore from "./fr/core.json";
import frHerbs from "./fr/herbs.json";
import frMarketing from "./fr/marketing.json";
import frServer from "./fr/server.json";
import frTools from "./fr/tools.json";

export type FullEnDictionary = typeof enCore &
  typeof enClinical &
  typeof enHerbs &
  typeof enTools &
  typeof enMarketing &
  typeof enServer;

export type FullFrDictionary = typeof frCore &
  typeof frClinical &
  typeof frHerbs &
  typeof frTools &
  typeof frMarketing &
  typeof frServer;

function assembleDictionary<T>(slices: readonly Record<string, unknown>[]): T {
  let out: AbstractIntlMessages = {};
  for (const slice of slices) {
    out = mergeClientMessages(out, slice as AbstractIntlMessages);
  }
  return out as unknown as T;
}

/**
 * Full assembled dictionaries for server rendering (`i18n/request.ts`) and tests.
 * Client components must NEVER import this module; they import only their
 * route-group client slices under `src/components/i18n/providers/`.
 */
export const enDict: FullEnDictionary = assembleDictionary<FullEnDictionary>([
  enCore,
  enClinical,
  enHerbs,
  enTools,
  enMarketing,
  enServer,
]);

export const frDict: FullFrDictionary = assembleDictionary<FullFrDictionary>([
  frCore,
  frClinical,
  frHerbs,
  frTools,
  frMarketing,
  frServer,
]);

export const DICTIONARIES: Record<Locale, Record<string, unknown>> = {
  en: enDict as unknown as Record<string, unknown>,
  fr: frDict as unknown as Record<string, unknown>,
};

export function getFullDictionary(locale: Locale): Record<string, unknown> {
  return DICTIONARIES[locale] ?? DICTIONARIES.en;
}
