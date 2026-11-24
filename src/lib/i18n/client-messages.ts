import type { AbstractIntlMessages } from "next-intl";
import type { Locale } from "./config";
import enDict from "./dictionaries/en.json";
import frDict from "./dictionaries/fr.json";

export type PickSpec = string | { readonly [key: string]: readonly PickSpec[] };

const DICTIONARIES: Record<Locale, Record<string, unknown>> = {
  en: enDict as Record<string, unknown>,
  fr: frDict as Record<string, unknown>,
};

/**
 * Exact message namespaces and narrow sub-trees required by client components
 * (`"use client"` files and helpers reachable from them). Server Components read
 * the full dictionary via `next-intl/server` and never serialize these scopes.
 */
export const CLIENT_MESSAGE_SCOPES = {
  core: [
    "common",
    "nav",
    "footer",
    "donate",
    "fda",
    "mobileTabs",
    "ads",
    "errors",
    "notFound",
    "auth",
    {
      herbalistPage: [
        "title",
        "widgetQ1",
        "widgetQ2",
        "widgetQ3",
        "widgetOpen",
        "widgetClose",
        "widgetPlaceholder",
        { greeting: ["bubbleText", "bubbleDismiss", "bubbleOpen"] },
      ],
      home: ["suggestionsTitle"],
      herbs: ["browseAll"],
    },
  ],
  home: [{ profile: ["welcomeRegistered", "welcomeBack"] }],
  herbDetail: [
    "citations",
    "evidence",
    "garden",
    "herbBadges",
    "herbDetail",
    "herbDetailContent",
    "herbFaq",
    "herbHero",
    "herbTabs",
    "interactionExplainer",
    "interactions",
    "provenance",
    "pubmedSheet",
    "safety",
    "safetyGlance",
  ],
  herbList: [
    "chipLegend",
    "evidence",
    "garden",
    "herbBadges",
    "herbHero",
    "herbs",
    "provenance",
    "recentSearches",
    "safetyGlance",
    "search",
  ],
  symptoms: ["symptomsPage"],
  symptomDetail: ["evidence", "safety"],
  interactionsHub: [
    "herbDrugInteractionsPage",
    "interactionExplainer",
    "stackChecker",
  ],
  garden: ["garden"],
  profile: ["profile"],
  calculator: ["calculator", "calculatorForm", "profile"],
  herbalist: ["evidence", "herbalistPage", "interactions", "pharmacist"],
  faq: ["faqContent"],
  widgets: ["widgetsPage"],
  donate: ["donateButtons"],
  npnChecker: ["npnCheckerPage"],
  privacy: [{ privacy: ["localStorageSection"] }],
  embed: ["embed"],
  compare: ["citations", "evidence", "safety"],
  methodology: ["chipLegend", "evidence", "provenance"],
} as const satisfies Record<string, readonly PickSpec[]>;

export type ClientMessageScope = keyof typeof CLIENT_MESSAGE_SCOPES;

function pickFromNode(
  source: Record<string, unknown>,
  specs: readonly PickSpec[],
  pathPrefix: string,
  locale: Locale
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const spec of specs) {
    if (typeof spec === "string") {
      if (!(spec in source)) {
        throw new Error(
          `[i18n] Missing client message key "${pathPrefix}${spec}" in "${locale}" dictionary`
        );
      }
      result[spec] = source[spec];
      continue;
    }

    for (const [key, nestedSpecs] of Object.entries(spec)) {
      const child = source[key];
      if (!child || typeof child !== "object" || Array.isArray(child)) {
        throw new Error(
          `[i18n] Missing client message object "${pathPrefix}${key}" in "${locale}" dictionary`
        );
      }
      const pickedChild = pickFromNode(
        child as Record<string, unknown>,
        nestedSpecs,
        `${pathPrefix}${key}.`,
        locale
      );
      const existing = result[key];
      result[key] =
        existing && typeof existing === "object" && !Array.isArray(existing)
          ? { ...(existing as Record<string, unknown>), ...pickedChild }
          : pickedChild;
    }
  }
  return result;
}

/**
 * Returns only the subset of dictionary messages needed by client components
 * for a given locale and scope.
 */
export function pickClientMessages(
  locale: Locale,
  scope: ClientMessageScope
): AbstractIntlMessages {
  const dict = DICTIONARIES[locale] ?? DICTIONARIES.en;
  const specs = CLIENT_MESSAGE_SCOPES[scope];
  return pickFromNode(dict, specs, "", locale) as AbstractIntlMessages;
}
