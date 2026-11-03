/**
 * Guards for the two reviewed data manifests behind the herb name corrections.
 *
 * These files drive database writes and permanent redirects, so the failure
 * modes worth catching are structural: a malformed slug path, a duplicate or
 * chained redirect, a correction with no target, or a display alignment that
 * drifts from the scientific correction it belongs to.
 */
import { describe, expect, it, vi } from "vitest";
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

  it("does not redirect any staged rename until activation", async () => {
    if (!nextConfig.redirects) {
      throw new Error("next.config.ts has no redirects() function");
    }
    const redirects = await nextConfig.redirects();
    const sources = new Set(redirects.map((redirect) => redirect.source));

    for (const rename of renames) {
      expect(
        sources.has(rename.from),
        `${rename.from} must keep serving its own row until activation`
      ).toBe(false);
      expect(
        sources.has(`/fr${rename.from}`),
        `/fr${rename.from} must keep serving its own row until activation`
      ).toBe(false);
    }
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
});
