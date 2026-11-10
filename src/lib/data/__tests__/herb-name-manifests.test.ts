/**
 * Guards for the two reviewed data manifests behind the herb name corrections.
 *
 * These files drive database writes and permanent redirects, so the failure
 * modes worth catching are structural: a malformed slug path, a duplicate or
 * chained redirect, a correction with no target, or a display alignment that
 * drifts from the scientific correction it belongs to.
 */
import { describe, expect, it, vi } from "vitest";
import { getRedirectStatus } from "next/dist/lib/redirect-status";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import correctionsJson from "../../../../data/herb-name-corrections.json";
import mergeRedirectsJson from "../../../../data/herb-merge-redirects.json";
import renamesJson from "../../../../data/herb-slug-renames.json";
import nextConfig from "../../../../next.config";

// next.config imports the Sentry wrapper at module load. The global test stub
// (src/test/setup.ts) deliberately omits withSentryConfig, so supply an
// identity wrapper here before importing the config.
vi.mock("@sentry/nextjs", () => ({
  withSentryConfig: (config: unknown) => config,
}));

type AppliedEntry = {
  slug: string;
  ours: string;
  gbif?: string;
  new_name?: string;
  batch?: number;
  merge_candidate?: string;
};

type SkippedEntry = {
  slug: string;
  batch?: number;
};

type DisplayAlignment = {
  slug: string;
  old_name: string;
  new_name: string;
  batch: number;
  reason: string;
};

type SlugRename = {
  from: string;
  to: string;
  reason: string;
  scientific_name_before: string;
  scientific_name_after: string;
  dependent_updates: Array<{ table: string; column: string }>;
  batch: number;
  decision: string;
};

type SlugDecision = {
  decision: string;
  reason: string;
};

const corrections = correctionsJson as unknown as {
  applied: AppliedEntry[];
  skipped: SkippedEntry[];
  display_name_alignments: DisplayAlignment[];
  slug_decisions: Record<string, SlugDecision>;
};
const renames: SlugRename[] = renamesJson.renames;
const mergeRedirects = mergeRedirectsJson as Array<{
  from: string;
  to: string;
}>;

const HERB_PATH = /^\/herbs\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
const targetOf = (entry: AppliedEntry): string | undefined =>
  entry.new_name ?? entry.gbif;

type RedirectCondition = {
  type: string;
  key?: string;
  value?: string;
};

type RedirectRule = {
  source: string;
  destination: string;
  permanent?: boolean;
  statusCode?: number;
  has?: readonly RedirectCondition[];
  missing?: readonly RedirectCondition[];
};

type StagedRename = {
  from: string;
  to: string;
};

const UNRESOLVED_PARAM = /:[A-Za-z0-9_]+/;

/**
 * Evaluate the redirect table against the twelve concrete request paths a
 * staged rename creates: `/herbs/<old>` and `/fr/herbs/<old>` for every pair.
 *
 * Exact-source lookups miss three bad wirings. A `statusCode` beats
 * `permanent` in Next, so a 301 can replace the intended 308. A
 * ginkgo-style parameterized locale rule still redirects the old path even
 * though no exact key finds it. And `has`/`missing` gating can disable a rule
 * without changing its source or destination. Matching through Next's own
 * `getPathMatch` sees all three, in both the deferred and active states.
 */
function renameRedirectProblems(
  stagedRenames: readonly StagedRename[],
  redirects: readonly RedirectRule[],
  activationFlag: string
): string[] {
  if (activationFlag !== "deferred" && activationFlag !== "active") {
    return [
      `activation must be "deferred" or "active", received "${activationFlag}"`,
    ];
  }

  const concretePaths = stagedRenames.flatMap((rename) => [
    { pathname: rename.from, expected: rename.to },
    { pathname: `/fr${rename.from}`, expected: `/fr${rename.to}` },
  ]);
  const renameSources = new Set(stagedRenames.map((rename) => rename.from));
  const problems: string[] = [];

  for (const { pathname, expected } of concretePaths) {
    const matches: Array<{
      rule: RedirectRule;
      params: Record<string, unknown>;
    }> = [];

    for (const rule of redirects) {
      const params = getPathMatch(rule.source, {
        removeUnnamedParams: true,
        strict: true,
      })(pathname);
      if (params !== false) {
        matches.push({ rule, params });
      }
    }

    if (activationFlag === "deferred") {
      for (const { rule } of matches) {
        problems.push(
          `${pathname} matches "${rule.source}" but activation is deferred; no rename redirect may be live`
        );
      }
      continue;
    }

    if (matches.length === 0) {
      problems.push(
        `${pathname} has no matching redirect once activation is active; expected ${expected}`
      );
      continue;
    }

    for (const { rule, params } of matches) {
      if (rule.has && rule.has.length > 0) {
        problems.push(
          `${pathname} matches "${rule.source}" but it is gated by has; a rename redirect must fire unconditionally`
        );
      }
      if (rule.missing && rule.missing.length > 0) {
        problems.push(
          `${pathname} matches "${rule.source}" but it is gated by missing; a rename redirect must fire unconditionally`
        );
      }

      const status = getRedirectStatus(rule);
      if (status !== 308) {
        problems.push(
          `${pathname} matches "${rule.source}" with status ${status}; expected 308 (a statusCode overrides permanent)`
        );
      }

      let destination = rule.destination;
      for (const [key, value] of Object.entries(params)) {
        destination = destination.split(`:${key}`).join(String(value));
      }

      if (UNRESOLVED_PARAM.test(destination)) {
        problems.push(
          `${pathname} matches "${rule.source}" but destination "${rule.destination}" leaves a colon parameter unresolved`
        );
      } else if (destination !== expected) {
        problems.push(
          `${pathname} matches "${rule.source}" but redirects to ${destination}; expected ${expected}`
        );
      }

      if (renameSources.has(destination)) {
        problems.push(
          `${pathname} matches "${rule.source}" but its destination ${destination} is itself a rename source`
        );
      }
    }
  }

  return problems;
}

describe("herb name corrections manifest", () => {
  it("records batch 2 as 15 applied, 3 skipped and 10 display alignments", () => {
    expect(
      corrections.applied.filter((entry) => entry.batch === 2)
    ).toHaveLength(15);
    expect(
      corrections.skipped.filter((entry) => entry.batch === 2)
    ).toHaveLength(3);
    expect(corrections.display_name_alignments).toHaveLength(10);
  });

  it("gives every applied correction a non-empty name with no trailing var.", () => {
    for (const entry of corrections.applied) {
      const target = targetOf(entry);
      expect(target, entry.slug).toBeTruthy();
      expect(target!.trim(), entry.slug).not.toBe("");
      expect(target!, entry.slug).not.toMatch(/\bvar\.$/i);
    }
  });

  it("resolves every display alignment to its applied new name", () => {
    const applied = new Map(
      corrections.applied.map((entry) => [entry.slug, entry])
    );
    for (const alignment of corrections.display_name_alignments) {
      const entry = applied.get(alignment.slug);
      expect(entry, alignment.slug).toBeDefined();
      expect(alignment.new_name, alignment.slug).toBe(targetOf(entry!));
    }
  });
});

describe("herb slug renames manifest", () => {
  it("uses lowercase hyphenated /herbs/slug paths", () => {
    for (const rename of renames) {
      expect(rename.from, rename.from).toMatch(HERB_PATH);
      expect(rename.to, rename.to).toMatch(HERB_PATH);
      expect(rename.from).not.toBe(rename.to);
    }
  });

  it("has no duplicate from or to", () => {
    const froms = renames.map((rename) => rename.from);
    const tos = renames.map((rename) => rename.to);
    expect(new Set(froms).size).toBe(froms.length);
    expect(new Set(tos).size).toBe(tos.length);
  });

  it("does not create a redirect chain", () => {
    const renameSources = new Set(renames.map((rename) => rename.from));
    const renameDestinations = new Set(renames.map((rename) => rename.to));
    const mergeSources = new Set(
      mergeRedirects.map((redirect) => redirect.from)
    );
    const mergeDestinations = new Set(
      mergeRedirects.map((redirect) => redirect.to)
    );

    for (const rename of renames) {
      expect(
        renameSources.has(rename.to),
        `${rename.to} is also a rename source`
      ).toBe(false);
      expect(
        renameDestinations.has(rename.from),
        `${rename.from} is also a rename destination`
      ).toBe(false);
      expect(
        mergeSources.has(rename.to),
        `${rename.to} is also a merge source`
      ).toBe(false);
      expect(
        mergeDestinations.has(rename.from),
        `${rename.from} is a merge destination`
      ).toBe(false);
    }
  });

  it("matches the redirect wiring to the activation flag", async () => {
    if (!nextConfig.redirects) {
      throw new Error("next.config.ts has no redirects() function");
    }
    const redirects = await nextConfig.redirects();
    const problems = renameRedirectProblems(
      renames,
      redirects,
      renamesJson.activation
    );
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("stages every rename with a positive batch", () => {
    for (const rename of renames) {
      expect(rename.decision, rename.from).toBe("staged");
      expect(Number.isInteger(rename.batch), rename.from).toBe(true);
      expect(rename.batch, rename.from).toBeGreaterThan(0);
    }
  });

  it("matches the staged slug decisions to the rename sources", () => {
    const staged = Object.entries(corrections.slug_decisions)
      .filter(([, entry]) => entry.decision === "staged")
      .map(([slug]) => slug)
      .sort();
    const renameSlugs = renames
      .map((rename) => rename.from.replace(/^\/herbs\//, ""))
      .sort();

    expect(staged).toEqual(renameSlugs);
  });

  it("gives every slug decision a keep or staged verdict and a reason", () => {
    for (const [slug, entry] of Object.entries(corrections.slug_decisions)) {
      expect(["keep", "staged"], slug).toContain(entry.decision);
      expect(entry.reason.trim(), slug).not.toBe("");
    }
  });

  describe("herb slug redirect guard", () => {
    const probe: StagedRename[] = [
      { from: "/herbs/old-slug", to: "/herbs/new-slug" },
    ];
    const exactWiring: RedirectRule[] = [
      {
        source: "/herbs/old-slug",
        destination: "/herbs/new-slug",
        permanent: true,
      },
      {
        source: "/fr/herbs/old-slug",
        destination: "/fr/herbs/new-slug",
        permanent: true,
      },
    ];
    const ginkgoFrench: RedirectRule = {
      source: "/:locale(en|fr)/herbs/old-slug",
      destination: "/:locale/herbs/new-slug",
      permanent: true,
    };
    const problemsFor = (
      redirects: readonly RedirectRule[],
      activationFlag: string
    ) => renameRedirectProblems(probe, redirects, activationFlag);

    it("passes deferred mode with no redirects", () => {
      expect(problemsFor([], "deferred")).toEqual([]);
    });

    it("fails deferred mode with exact wiring for both prefixes", () => {
      const problems = problemsFor(exactWiring, "deferred");
      expect(problems).not.toEqual([]);
      expect(problems.join("\n")).toContain("/herbs/old-slug");
    });

    it("fails deferred mode with a ginkgo-style parameterized locale rule", () => {
      const problems = problemsFor([ginkgoFrench], "deferred");
      expect(problems).not.toEqual([]);
      expect(problems.join("\n")).toContain("/fr/herbs/old-slug");
    });

    it("passes active mode with exact wiring for both prefixes", () => {
      expect(problemsFor(exactWiring, "active")).toEqual([]);
    });

    it("passes active mode with exact English and parameterized French rules", () => {
      expect(problemsFor([exactWiring[0], ginkgoFrench], "active")).toEqual([]);
    });

    it("fails active mode when statusCode 301 overrides permanent", () => {
      const rules = exactWiring.map((rule) => ({ ...rule, statusCode: 301 }));
      const problems = problemsFor(rules, "active");
      expect(problems).not.toEqual([]);
      expect(problems.join("\n")).toContain("301");
      expect(problems.join("\n")).toContain("308");
    });

    it("fails active mode when statusCode 307 overrides permanent", () => {
      const rules = exactWiring.map((rule) => ({ ...rule, statusCode: 307 }));
      const problems = problemsFor(rules, "active");
      expect(problems).not.toEqual([]);
      expect(problems.join("\n")).toContain("307");
      expect(problems.join("\n")).toContain("308");
    });

    it("fails active mode when a rule has a query condition", () => {
      const rules = exactWiring.map((rule) => ({
        ...rule,
        has: [{ type: "query", key: "ref" }],
      }));
      const problems = problemsFor(rules, "active");
      expect(problems).not.toEqual([]);
      expect(problems.join("\n")).toContain("has");
    });

    it("fails active mode when a rule has a missing condition", () => {
      const rules = exactWiring.map((rule) => ({
        ...rule,
        missing: [{ type: "query", key: "ref" }],
      }));
      const problems = problemsFor(rules, "active");
      expect(problems).not.toEqual([]);
      expect(problems.join("\n")).toContain("missing");
    });

    it("fails active mode with no redirects", () => {
      const problems = problemsFor([], "active");
      expect(problems).not.toEqual([]);
      expect(problems.join("\n")).toContain("/herbs/old-slug");
      expect(problems.join("\n")).toContain("/fr/herbs/old-slug");
    });

    it("fails active mode with a destination mismatch", () => {
      const rules = [
        { ...exactWiring[0], destination: "/herbs/wrong-slug" },
        exactWiring[1],
      ];
      const problems = problemsFor(rules, "active");
      expect(problems).not.toEqual([]);
      expect(problems.join("\n")).toContain("expected /herbs/new-slug");
    });

    it("fails active mode with only the English rule", () => {
      const problems = problemsFor([exactWiring[0]], "active");
      expect(problems).not.toEqual([]);
      expect(problems.join("\n")).toContain("/fr/herbs/old-slug");
    });

    it("fails when activation is paused", () => {
      const problems = problemsFor(exactWiring, "paused");
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain("activation");
    });
  });
});
