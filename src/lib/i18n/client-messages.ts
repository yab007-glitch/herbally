import type { AbstractIntlMessages } from "next-intl";
import type { Locale } from "./config";
import { mergeClientMessages } from "./merge-messages";
import enClinical from "./dictionaries/en/clinical.json";
import enCore from "./dictionaries/en/core.json";
import enHerbs from "./dictionaries/en/herbs.json";
import enMarketing from "./dictionaries/en/marketing.json";
import enTools from "./dictionaries/en/tools.json";
import frClinical from "./dictionaries/fr/clinical.json";
import frCore from "./dictionaries/fr/core.json";
import frHerbs from "./dictionaries/fr/herbs.json";
import frMarketing from "./dictionaries/fr/marketing.json";
import frTools from "./dictionaries/fr/tools.json";

export type ClientMessageGroup = "core" | "herbs" | "tools" | "marketing";

const CLIENT_GROUPS: Record<
  Locale,
  Record<ClientMessageGroup, AbstractIntlMessages>
> = {
  en: {
    core: enCore as unknown as AbstractIntlMessages,
    herbs: mergeClientMessages(
      enClinical as unknown as AbstractIntlMessages,
      enHerbs as unknown as AbstractIntlMessages
    ),
    tools: mergeClientMessages(
      enClinical as unknown as AbstractIntlMessages,
      enTools as unknown as AbstractIntlMessages
    ),
    marketing: enMarketing as unknown as AbstractIntlMessages,
  },
  fr: {
    core: frCore as unknown as AbstractIntlMessages,
    herbs: mergeClientMessages(
      frClinical as unknown as AbstractIntlMessages,
      frHerbs as unknown as AbstractIntlMessages
    ),
    tools: mergeClientMessages(
      frClinical as unknown as AbstractIntlMessages,
      frTools as unknown as AbstractIntlMessages
    ),
    marketing: frMarketing as unknown as AbstractIntlMessages,
  },
};

/**
 * Returns the client-only message group for a given locale without touching
 * `server.json` or the full dictionary index. Used by unit tests and budget
 * checks; runtime routes mount the corresponding client provider directly.
 */
export function getClientGroupMessages(
  locale: Locale,
  group: ClientMessageGroup
): AbstractIntlMessages {
  const byLocale = CLIENT_GROUPS[locale] ?? CLIENT_GROUPS.en;
  return byLocale[group];
}
