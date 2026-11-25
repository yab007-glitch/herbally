import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

function loadDeployIgnoreRegex(): RegExp {
  const workflow = fs.readFileSync(
    path.resolve(process.cwd(), ".github/workflows/deploy.yml"),
    "utf-8"
  );
  // Extract the grep -qvE pattern from the "Detect runtime and schema changes" step
  const match =
    workflow.match(/NON_RUNTIME_RE='([^']+)'/) ??
    workflow.match(/grep -qvE '([^']+)'/);
  if (!match) {
    throw new Error(
      "Could not find non-runtime exclusion regex in .github/workflows/deploy.yml"
    );
  }
  return new RegExp(match[1]);
}

function shouldDeploy(changedFiles: string[], ignoreRe: RegExp): boolean {
  return changedFiles.some((file) => !ignoreRe.test(file));
}

describe("deploy.yml runtime path filter", () => {
  it("triggers deploy when scripts/patch-next-image-optimizer.mjs or any Dockerfile-referenced script changes", () => {
    const ignoreRe = loadDeployIgnoreRegex();
    const dockerfile = fs.readFileSync(
      path.resolve(process.cwd(), "Dockerfile"),
      "utf-8"
    );
    const scriptMatches = [...dockerfile.matchAll(/scripts\/[^\s"']+/g)].map(
      (m) => m[0]
    );
    expect(scriptMatches).toContain("scripts/patch-next-image-optimizer.mjs");

    for (const scriptFile of scriptMatches) {
      expect(
        shouldDeploy([scriptFile], ignoreRe),
        `${scriptFile} must set deploy_needed=true`
      ).toBe(true);
    }

    expect(
      shouldDeploy(
        ["docs/README.md", "scripts/patch-next-image-optimizer.mjs"],
        ignoreRe
      )
    ).toBe(true);
    expect(shouldDeploy(["Dockerfile"], ignoreRe)).toBe(true);
    expect(shouldDeploy(["src/app/page.tsx"], ignoreRe)).toBe(true);
  });

  it("skips deploy when only docs, artifacts, e2e tests, root markdown, or uptime-watch change", () => {
    const ignoreRe = loadDeployIgnoreRegex();
    expect(
      shouldDeploy(["docs/DEPLOYMENT_RUNBOOK.md", "README.md"], ignoreRe)
    ).toBe(false);
    expect(
      shouldDeploy(
        [
          "artifacts/adsense-watch.json",
          "e2e/smoke.spec.ts",
          ".github/workflows/uptime-watch.yml",
        ],
        ignoreRe
      )
    ).toBe(false);
  });
});
