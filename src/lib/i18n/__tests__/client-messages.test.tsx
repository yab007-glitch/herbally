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
import enDict from "@/lib/i18n/dictionaries/en.json";
import frDict from "@/lib/i18n/dictionaries/fr.json";
import {
  CLIENT_MESSAGE_SCOPES,
  pickClientMessages,
  type ClientMessageScope,
} from "@/lib/i18n/client-messages";
import { mergeClientMessages } from "@/lib/i18n/merge-messages";

function hasPath(obj: unknown, keyPath: string): boolean {
  let cur = obj;
  for (const seg of keyPath.split(".")) {
    if (!cur || typeof cur !== "object" || !(seg in cur)) return false;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur !== undefined;
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

const ROUTE_SCOPE_MAP: Record<string, ClientMessageScope> = {
  "src/app/[locale]/(marketing)/page.tsx": "home",
  "src/app/[locale]/(main)/herbs/[slug]/page.tsx": "herbDetail",
  "src/app/[locale]/(main)/herbs/page.tsx": "herbList",
  "src/app/[locale]/(main)/symptoms/page.tsx": "symptoms",
  "src/app/[locale]/(main)/symptoms/[symptom]/page.tsx": "symptomDetail",
  "src/app/[locale]/(marketing)/herb-drug-interactions/page.tsx":
    "interactionsHub",
  "src/app/[locale]/(main)/garden/page.tsx": "garden",
  "src/app/[locale]/(main)/profile/page.tsx": "profile",
  "src/app/[locale]/(main)/calculator/page.tsx": "calculator",
  "src/app/[locale]/(main)/herbalist/page.tsx": "herbalist",
  "src/app/[locale]/(marketing)/faq/page.tsx": "faq",
  "src/app/[locale]/(marketing)/widgets/page.tsx": "widgets",
  "src/app/[locale]/(marketing)/donate/page.tsx": "donate",
  "src/app/[locale]/(marketing)/npn-checker/page.tsx": "npnChecker",
  "src/app/[locale]/(marketing)/privacy/page.tsx": "privacy",
  "src/app/[locale]/embed/checker/page.tsx": "embed",
  "src/app/[locale]/(main)/compare/page.tsx": "compare",
  "src/app/[locale]/(main)/compare/[slug1]/vs/[slug2]/page.tsx": "compare",
  "src/app/[locale]/(marketing)/methodology/page.tsx": "methodology",
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

describe("client-messages scoped i18n subset", () => {
  it("prevents client components from reading keys outside the injected subset", () => {
    const coreMessages = pickClientMessages("en", "core");
    const herbMessages = mergeClientMessages(
      coreMessages,
      pickClientMessages("en", "herbDetail")
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
      const core = pickClientMessages(locale, "core");

      for (const f of collectClientIntlFiles(layoutCoreRoots)) {
        for (const k of extractLiteralTranslationKeys(sources.get(f)!)) {
          if (hasPath(fullDict, k) && !hasPath(core, k)) {
            missing.push(`[${locale}] core <- ${f}: ${k}`);
          }
        }
      }

      for (const entry of appEntries) {
        const scope = ROUTE_SCOPE_MAP[entry];
        const effective = scope
          ? mergeClientMessages(core, pickClientMessages(locale, scope))
          : core;
        for (const f of collectClientIntlFiles([entry])) {
          for (const k of extractLiteralTranslationKeys(sources.get(f)!)) {
            if (hasPath(fullDict, k) && !hasPath(effective, k)) {
              missing.push(
                `[${locale}] ${entry} (scope=${scope ?? "core"}) <- ${f}: ${k}`
              );
            }
          }
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it("includes every dynamic key family in its route scope for both locales", () => {
    const dynamicChecks: Array<{
      scope: ClientMessageScope;
      keys: string[];
    }> = [
      {
        scope: "core",
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
          "errors.500.title",
          "errors.404.title",
        ],
      },
      {
        scope: "herbDetail",
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
        ],
      },
      {
        scope: "herbList",
        keys: [
          "chipLegend.gradeADesc",
          "evidence.A.label",
          "evidence.B.shortDesc",
          "provenance.primarySource",
          "herbs.title",
          "search.placeholder",
          "recentSearches.title",
        ],
      },
      {
        scope: "calculator",
        keys: [
          "calculatorForm.rangeLow",
          "calculatorForm.rangeMid",
          "calculatorForm.rangeHigh",
          "calculatorForm.explanations.standard",
          "profile.self",
        ],
      },
      {
        scope: "interactionsHub",
        keys: [
          "stackChecker.severity.severe",
          "herbDrugInteractionsPage.embedLabel",
          "interactionExplainer.warfarinName",
        ],
      },
      {
        scope: "herbalist",
        keys: [
          "herbalistPage.greeting.quickCheckHerb",
          "herbalistPage.greeting.quickCheckHerbPrompt",
          "interactions.severity.severe",
          "pharmacist.error",
        ],
      },
      {
        scope: "donate",
        keys: [
          "donateButtons.coffee",
          "donateButtons.coffeeDesc",
          "donateButtons.supporter",
          "donateButtons.champion",
        ],
      },
      {
        scope: "widgets",
        keys: [
          "widgetsPage.citationKit.links.herbs.title",
          "widgetsPage.citationKit.links.herbs.desc",
        ],
      },
      {
        scope: "npnChecker",
        keys: ["npnCheckerPage.sample1Label"],
      },
      {
        scope: "privacy",
        keys: ["privacy.localStorageSection.clearButton"],
      },
    ];

    for (const locale of ["en", "fr"] as const) {
      const fullDict = locale === "en" ? enDict : frDict;
      const core = pickClientMessages(locale, "core");
      for (const { scope, keys } of dynamicChecks) {
        const effective =
          scope === "core"
            ? core
            : mergeClientMessages(core, pickClientMessages(locale, scope));
        for (const key of keys) {
          if (hasPath(fullDict, key)) {
            expect(
              hasPath(effective, key),
              `[${locale}] scope=${scope} missing ${key}`
            ).toBe(true);
          }
        }
      }
    }
  });

  it("keeps core and herbDetail client payloads small and never bundles full dictionaries in client files", () => {
    for (const locale of ["en", "fr"] as const) {
      const coreBytes = Buffer.byteLength(
        JSON.stringify(pickClientMessages(locale, "core"))
      );
      const herbBytes = Buffer.byteLength(
        JSON.stringify(
          mergeClientMessages(
            pickClientMessages(locale, "core"),
            pickClientMessages(locale, "herbDetail")
          )
        )
      );
      expect(coreBytes).toBeLessThan(15 * 1024);
      expect(herbBytes).toBeLessThan(35 * 1024);
    }

    expect(Object.keys(CLIENT_MESSAGE_SCOPES)).toContain("core");

    for (const clientProvider of [
      "src/components/i18n/locale-provider.tsx",
      "src/components/i18n/merge-intl-provider.tsx",
      "src/components/i18n/intl-messages-scope.tsx",
    ]) {
      const src = fs.readFileSync(clientProvider, "utf8");
      expect(src).not.toMatch(/dictionaries\/(en|fr)\.json/);
    }

    const clientFiles = walkTsFiles("src").filter((f) =>
      /^\s*["']use client["']/.test(fs.readFileSync(f, "utf8"))
    );
    for (const cf of clientFiles) {
      expect(fs.readFileSync(cf, "utf8")).not.toMatch(
        /dictionaries\/(en|fr)\.json/
      );
    }
  });
});
