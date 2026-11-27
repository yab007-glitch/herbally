import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  IntlError,
  IntlErrorCode,
  NextIntlClientProvider,
  useTranslations,
} from "next-intl";
import {
  getClientGroupMessages,
  type ClientMessageGroup,
} from "@/lib/i18n/client-messages";
import { enDict, frDict } from "@/lib/i18n/dictionaries";
import { mergeClientMessages } from "@/lib/i18n/merge-messages";
import enClinical from "@/lib/i18n/dictionaries/en/clinical.json";
import enCore from "@/lib/i18n/dictionaries/en/core.json";
import enHerbs from "@/lib/i18n/dictionaries/en/herbs.json";
import enMarketing from "@/lib/i18n/dictionaries/en/marketing.json";
import enServer from "@/lib/i18n/dictionaries/en/server.json";
import enTools from "@/lib/i18n/dictionaries/en/tools.json";
import frClinical from "@/lib/i18n/dictionaries/fr/clinical.json";
import frCore from "@/lib/i18n/dictionaries/fr/core.json";
import frHerbs from "@/lib/i18n/dictionaries/fr/herbs.json";
import frMarketing from "@/lib/i18n/dictionaries/fr/marketing.json";
import frServer from "@/lib/i18n/dictionaries/fr/server.json";
import frTools from "@/lib/i18n/dictionaries/fr/tools.json";

function hasPath(obj: unknown, keyPath: string): boolean {
  let cur = obj;
  for (const seg of keyPath.split(".")) {
    if (!cur || typeof cur !== "object" || !(seg in cur)) return false;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur !== undefined;
}

function collectLeafPaths(obj: unknown, prefix = ""): string[] {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return prefix ? [prefix] : [];
  }
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out.push(...collectLeafPaths(v, next));
    } else {
      out.push(next);
    }
  }
  return out;
}

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkTsFiles(full));
    } else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !/\.test\.|\.spec\./.test(entry.name)
    ) {
      out.push(full);
    }
  }
  return out;
}

function resolveImport(fromFile: string, spec: string): string | null {
  let base: string | null = null;
  if (spec.startsWith("@/")) base = path.join("src", spec.slice(2));
  else if (spec.startsWith(".")) base = path.join(path.dirname(fromFile), spec);
  if (!base) return null;

  for (const cand of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ]) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
  }
  return null;
}

const ROUTE_GROUP_MAP: Record<string, ClientMessageGroup> = {
  "src/app/[locale]/(herb-detail)/herbs/[slug]/page.tsx": "herbs",
  "src/app/[locale]/(main)/herbs/page.tsx": "herbs",
  "src/app/[locale]/(main)/symptoms/[symptom]/page.tsx": "herbs",
  "src/app/[locale]/(main)/garden/page.tsx": "herbs",
  "src/app/[locale]/(main)/compare/page.tsx": "herbs",
  "src/app/[locale]/(main)/compare/[slug1]/vs/[slug2]/page.tsx": "herbs",
  "src/app/[locale]/(marketing)/methodology/page.tsx": "herbs",
  "src/app/[locale]/(main)/symptoms/page.tsx": "tools",
  "src/app/[locale]/(marketing)/herb-drug-interactions/page.tsx": "tools",
  "src/app/[locale]/(main)/profile/page.tsx": "tools",
  "src/app/[locale]/(main)/calculator/page.tsx": "tools",
  "src/app/[locale]/(main)/herbalist/page.tsx": "tools",
  "src/app/[locale]/(marketing)/npn-checker/page.tsx": "tools",
  "src/app/[locale]/embed/checker/page.tsx": "tools",
  "src/app/[locale]/(marketing)/faq/page.tsx": "marketing",
  "src/app/[locale]/(marketing)/widgets/page.tsx": "marketing",
  "src/app/[locale]/(marketing)/donate/page.tsx": "marketing",
  "src/app/[locale]/(marketing)/privacy/page.tsx": "marketing",
};

function extractLiteralTranslationKeys(source: string): string[] {
  const keys: string[] = [];
  const decls = [
    ...source.matchAll(
      /const\s+(\w+)\s*=\s*useTranslations\(\s*(?:["']([^"']*)["'])?\s*\)/g
    ),
  ];
  for (const m of decls) {
    const varName = m[1];
    const ns = m[2] || "";
    const callRe = new RegExp(
      `\\b${varName}(?:\\.raw|\\.rich|\\.markup|\\.has)?\\(\\s*(["'\`])([^"'\`\\n]+)\\1`,
      "g"
    );
    for (const call of source.matchAll(callRe)) {
      const arg = call[2];
      if (arg.includes("${")) continue;
      keys.push(ns ? `${ns}.${arg}` : arg);
    }
  }
  return keys;
}

describe("client-messages cacheable i18n slices", () => {
  it("keeps the six dictionary slices disjoint with full EN/FR leaf parity", () => {
    const slicesByLocale = {
      en: {
        core: enCore,
        clinical: enClinical,
        herbs: enHerbs,
        tools: enTools,
        marketing: enMarketing,
        server: enServer,
      },
      fr: {
        core: frCore,
        clinical: frClinical,
        herbs: frHerbs,
        tools: frTools,
        marketing: frMarketing,
        server: frServer,
      },
    } as const;

    const leafSetsByLocale: Record<"en" | "fr", Record<string, string[]>> = {
      en: {},
      fr: {},
    };

    for (const locale of ["en", "fr"] as const) {
      const seen = new Map<string, string>();
      for (const [sliceName, sliceObj] of Object.entries(
        slicesByLocale[locale]
      )) {
        const leaves = collectLeafPaths(sliceObj).sort();
        leafSetsByLocale[locale][sliceName] = leaves;
        for (const leaf of leaves) {
          expect(
            seen.has(leaf),
            `[${locale}] duplicate leaf "${leaf}" in "${sliceName}" and "${seen.get(leaf)}"`
          ).toBe(false);
          seen.set(leaf, sliceName);
        }
      }
      const fullDict = locale === "en" ? enDict : frDict;
      expect(seen.size).toBe(collectLeafPaths(fullDict).length);
    }

    for (const sliceName of Object.keys(slicesByLocale.en)) {
      expect(leafSetsByLocale.fr[sliceName]).toEqual(
        leafSetsByLocale.en[sliceName]
      );
    }
  });

  it("prevents client components from reading keys outside their mounted group", () => {
    const coreMessages = getClientGroupMessages("en", "core");
    const herbMessages = mergeClientMessages(
      coreMessages,
      getClientGroupMessages("en", "herbs")
    );

    const OutsideReader = ({ keyPath }: { keyPath: string }) => {
      const t = useTranslations();
      return <span>{t(keyPath as never)}</span>;
    };

    const outsideKeys = [
      "privacy.title",
      "methodologyContent.title",
      "sponsorship.title",
      "meta.homeTitle",
      "faqContent.title",
      "terms.title",
      "calculatorForm.title",
      "herbalistPage.subtitle",
    ];

    for (const keyPath of outsideKeys) {
      expect(hasPath(coreMessages, keyPath)).toBe(false);
      expect(hasPath(herbMessages, keyPath)).toBe(false);

      const errors: IntlError[] = [];
      renderToStaticMarkup(
        <NextIntlClientProvider
          locale="en"
          messages={herbMessages}
          timeZone="America/Toronto"
          onError={(err) => errors.push(err)}
        >
          <OutsideReader keyPath={keyPath} />
        </NextIntlClientProvider>
      );
      expect(errors.some((e) => e.code === IntlErrorCode.MISSING_MESSAGE)).toBe(
        true
      );
    }
  });

  it("includes every literal key used by client components on every route in both locales", () => {
    const files = walkTsFiles("src");
    const importsOf = new Map<string, string[]>();
    const isClientFile = new Set<string>();
    const sources = new Map<string, string>();

    for (const f of files) {
      const src = fs.readFileSync(f, "utf8");
      sources.set(f, src);
      if (/^\s*["']use client["']/.test(src)) isClientFile.add(f);
      const deps: string[] = [];
      for (const m of src.matchAll(/(?:from|import\()\s*["']([^"']+)["']/g)) {
        const resolved = resolveImport(f, m[1]);
        if (resolved) deps.push(resolved);
      }
      importsOf.set(f, deps);
    }

    const inClientGraph = new Set<string>();
    const markClient = (f: string) => {
      if (inClientGraph.has(f)) return;
      inClientGraph.add(f);
      for (const d of importsOf.get(f) ?? []) markClient(d);
    };
    for (const f of isClientFile) markClient(f);

    const layoutCoreRoots = [
      "src/app/[locale]/layout.tsx",
      "src/app/[locale]/error.tsx",
      "src/app/[locale]/not-found.tsx",
      "src/app/[locale]/(main)/layout.tsx",
      "src/app/[locale]/(main)/error.tsx",
      "src/app/[locale]/(main)/not-found.tsx",
      "src/app/[locale]/(marketing)/layout.tsx",
      "src/app/[locale]/(marketing)/error.tsx",
      "src/app/[locale]/(auth)/layout.tsx",
    ];

    const collectClientIntlFiles = (roots: string[]): string[] => {
      const seen = new Set<string>();
      const stack = [...roots];
      while (stack.length > 0) {
        const cur = stack.pop()!;
        if (seen.has(cur)) continue;
        seen.add(cur);
        for (const d of importsOf.get(cur) ?? []) stack.push(d);
      }
      return [...seen].filter(
        (f) =>
          inClientGraph.has(f) &&
          /from\s+["']next-intl["']/.test(sources.get(f) ?? "") &&
          /useTranslations/.test(sources.get(f) ?? "")
      );
    };

    const appEntries = files.filter(
      (f) =>
        f.startsWith("src/app/[locale]/") &&
        /(?:page|error|loading|not-found)\.tsx$/.test(f)
    );

    const missing: string[] = [];
    for (const locale of ["en", "fr"] as const) {
      const fullDict = locale === "en" ? enDict : frDict;
      const core = getClientGroupMessages(locale, "core");

      for (const f of collectClientIntlFiles(layoutCoreRoots)) {
        for (const k of extractLiteralTranslationKeys(sources.get(f)!)) {
          if (hasPath(fullDict, k) && !hasPath(core, k)) {
            missing.push(`[${locale}] core <- ${f}: ${k}`);
          }
        }
      }

      for (const entry of appEntries) {
        const group = ROUTE_GROUP_MAP[entry];
        const effective = group
          ? mergeClientMessages(core, getClientGroupMessages(locale, group))
          : core;
        for (const f of collectClientIntlFiles([entry])) {
          for (const k of extractLiteralTranslationKeys(sources.get(f)!)) {
            if (hasPath(fullDict, k) && !hasPath(effective, k)) {
              missing.push(
                `[${locale}] ${entry} (group=${group ?? "core"}) <- ${f}: ${k}`
              );
            }
          }
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it("includes every dynamic key family in its route group for both locales", () => {
    const dynamicChecks: Array<{
      group: ClientMessageGroup;
      keys: string[];
    }> = [
      {
        group: "core",
        keys: [
          "common.switchToFrench",
          "common.switchToEnglish",
          "common.languageSwitchedFr",
          "common.languageSwitchedEn",
          "mobileTabs.interactions",
          "mobileTabs.explore",
          "mobileTabs.herbalist",
          "mobileTabs.calc",
          "mobileTabs.garden",
          "nav.interactions",
          "nav.explore",
          "nav.herbalist",
          "nav.garden",
          "nav.calculator",
          "nav.medications",
          "nav.npnChecker",
          "nav.surgeryPlanner",
          "nav.symptoms",
          "herbalistPage.greeting.bubbleText",
          "herbalistPage.greeting.bubbleDismiss",
          "herbalistPage.greeting.bubbleOpen",
          "herbalistPage.widgetQ1",
          "herbalistPage.widgetQ2",
          "herbalistPage.widgetQ3",
          "home.suggestionsTitle",
          "herbs.browseAll",
          "profile.welcomeRegistered",
          "profile.welcomeBack",
          "errors.500.title",
          "errors.404.title",
        ],
      },
      {
        group: "herbs",
        keys: [
          "herbTabs.overview",
          "herbTabs.uses",
          "herbTabs.science",
          "herbTabs.dosage",
          "herbTabs.safety",
          "interactions.severity.contraindicated",
          "interactions.severity.severe",
          "interactions.severity.moderate",
          "interactions.severity.mild",
          "safetyGlance.severityCount.severe",
          "pubmedSheet.level.A",
          "evidence.A.label",
          "evidence.trad.shortDesc",
          "herbFaq.q1",
          "interactionExplainer.warfarinName",
          "provenance.primarySource",
          "chipLegend.gradeADesc",
          "herbs.title",
          "search.placeholder",
          "recentSearches.title",
        ],
      },
      {
        group: "tools",
        keys: [
          "calculatorForm.rangeLow",
          "calculatorForm.rangeMid",
          "calculatorForm.rangeHigh",
          "calculatorForm.explanations.standard",
          "profile.self",
          "stackChecker.severity.severe",
          "herbDrugInteractionsPage.embedLabel",
          "interactionExplainer.warfarinName",
          "herbalistPage.greeting.quickCheckHerb",
          "herbalistPage.greeting.quickCheckHerbPrompt",
          "interactions.severity.severe",
          "pharmacist.error",
          "npnCheckerPage.sample1Label",
        ],
      },
      {
        group: "marketing",
        keys: [
          "donateButtons.coffee",
          "donateButtons.coffeeDesc",
          "donateButtons.supporter",
          "donateButtons.champion",
          "widgetsPage.citationKit.links.herbs.title",
          "widgetsPage.citationKit.links.herbs.desc",
          "privacy.localStorageSection.clearButton",
        ],
      },
    ];

    for (const locale of ["en", "fr"] as const) {
      const fullDict = locale === "en" ? enDict : frDict;
      const core = getClientGroupMessages(locale, "core");
      for (const { group, keys } of dynamicChecks) {
        const effective =
          group === "core"
            ? core
            : mergeClientMessages(core, getClientGroupMessages(locale, group));
        for (const key of keys) {
          if (hasPath(fullDict, key)) {
            expect(
              hasPath(effective, key),
              `[${locale}] group=${group} missing ${key}`
            ).toBe(true);
          }
        }
      }
    }
  });

  it("keeps client message groups small, never bundles server messages on the client, and passes zero message props across the Server->Client boundary", () => {
    for (const locale of ["en", "fr"] as const) {
      const coreBytes = Buffer.byteLength(
        JSON.stringify(getClientGroupMessages(locale, "core"))
      );
      const herbsBytes = Buffer.byteLength(
        JSON.stringify(
          mergeClientMessages(
            getClientGroupMessages(locale, "core"),
            getClientGroupMessages(locale, "herbs")
          )
        )
      );
      expect(coreBytes).toBeLessThan(15 * 1024);
      expect(herbsBytes).toBeLessThan(35 * 1024);
    }

    for (const serverSwitch of [
      "src/components/i18n/locale-provider.tsx",
      "src/components/i18n/herbs-messages-provider.tsx",
      "src/components/i18n/tools-messages-provider.tsx",
      "src/components/i18n/marketing-messages-provider.tsx",
    ]) {
      const src = fs.readFileSync(serverSwitch, "utf8");
      expect(src).not.toMatch(/messages\s*=/);
      expect(src).not.toMatch(/dictionaries/);
    }

    const files = walkTsFiles("src");
    const importsOf = new Map<string, string[]>();
    const isClientFile = new Set<string>();
    const sources = new Map<string, string>();
    for (const f of files) {
      const src = fs.readFileSync(f, "utf8");
      sources.set(f, src);
      if (/^\s*["']use client["']/.test(src)) isClientFile.add(f);
      const deps: string[] = [];
      for (const m of src.matchAll(/(?:from|import\()\s*["']([^"']+)["']/g)) {
        const resolved = resolveImport(f, m[1]);
        if (resolved) deps.push(resolved);
      }
      importsOf.set(f, deps);
    }

    const inClientGraph = new Set<string>();
    const markClient = (f: string) => {
      if (inClientGraph.has(f)) return;
      inClientGraph.add(f);
      for (const d of importsOf.get(f) ?? []) markClient(d);
    };
    for (const f of isClientFile) markClient(f);

    for (const cf of inClientGraph) {
      const src = sources.get(cf) ?? "";
      expect(src).not.toMatch(/dictionaries\/(en|fr)\.json/);
      expect(src).not.toMatch(/dictionaries\/(en|fr)\/server\.json/);
      expect(src).not.toMatch(/from\s+["']@\/lib\/i18n\/dictionaries["']/);
    }
  });
});
