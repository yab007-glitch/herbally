#!/usr/bin/env node
/**
 * Gate-on E2E harness.
 *
 * Builds and serves a *disposable copy* of this repository with
 * `ADS_LAUNCH_GATE` flipped to `true`. The committed source is never modified:
 * the copy is patched under `.e2e-gate-on/app`, and the script asserts the
 * root `src/lib/ads/policy.ts` still contains the shipped `false` constant
 * before it builds. The patched tree lives only in `.e2e-gate-on/`, which
 * `.gitignore` excludes.
 *
 * Usage (Playwright starts this as its webServer when E2E_GATE_ON=1):
 *   node scripts/e2e-gate-on-server.mjs
 *
 * It is also safe to run directly; the server stays in the foreground and
 * forwards SIGTERM/SIGINT to the Next.js child.
 */

import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GATE_DIR = path.join(ROOT, ".e2e-gate-on");
const APP_DIR = path.join(GATE_DIR, "app");
const STAMP = path.join(GATE_DIR, "stamp");
const POLICY_REL = path.join("src", "lib", "ads", "policy.ts");
const APP_POLICY = path.join(APP_DIR, POLICY_REL);
const ROOT_POLICY = path.join(ROOT, POLICY_REL);

const GATE_OFF = "export const ADS_LAUNCH_GATE: boolean = false;";
const GATE_ON = "export const ADS_LAUNCH_GATE: boolean = true;";

const PORT = 3100;
const HOSTNAME = "127.0.0.1";

const ADSENSE_CLIENT = "ca-pub-1901058826905247";
const ADSENSE_SLOT_HERB = "1234567890";

/** Top-level entries that must never be copied into the disposable tree. */
const SKIP_ENTRIES = new Set([
  "node_modules",
  ".next",
  ".git",
  ".e2e-gate-on",
  "artifacts",
  "playwright-report",
  "test-results",
  "coverage",
  ".vercel",
]);

function log(message) {
  console.log(`[e2e-gate-on] ${message}`);
}

function fail(message) {
  console.error(`[e2e-gate-on] ERROR: ${message}`);
  process.exit(1);
}

/**
 * Identity of the source a cached build was produced from: the HEAD commit
 * plus a digest of the working-tree state. The stamp only matches when the
 * tree is byte-for-byte the one that was built.
 */
function sourceSignature() {
  const head = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (head.error || head.status !== 0) {
    fail(`git rev-parse HEAD failed: ${head.error ?? head.stderr}`);
  }

  // The path list alone only says *that* a tracked file changed, not what it
  // now contains, so an edit to a tracked file would leave a cached build
  // looking valid. Hash the binary diff (the content) as well as the status
  // list (which also covers untracked paths).
  const diff = spawnSync("git", ["diff", "HEAD", "--binary"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (diff.error || diff.status !== 0) {
    fail(`git diff HEAD --binary failed: ${diff.error ?? diff.stderr}`);
  }

  const status = spawnSync("git", ["status", "--porcelain"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (status.error || status.status !== 0) {
    fail(`git status --porcelain failed: ${status.error ?? status.stderr}`);
  }

  const workingTree = createHash("sha256")
    .update(diff.stdout)
    .update(status.stdout)
    .digest("hex");
  return `${head.stdout.trim()}:${workingTree}`;
}

/** Minimal `.env` reader: KEY=VALUE lines, `#` comments, optional quotes. */
function readEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;

  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function assertRootGateStillOff() {
  const rootPolicy = fs.readFileSync(ROOT_POLICY, "utf8");
  if (!rootPolicy.includes(GATE_OFF)) {
    fail(
      `${ROOT_POLICY} no longer contains the shipped "${GATE_OFF}" line. ` +
        "Refusing to run: the committed launch gate must stay false."
    );
  }
  if (rootPolicy.includes(GATE_ON)) {
    fail(
      `${ROOT_POLICY} contains the gate-on constant. The gate may only be ` +
        "flipped inside the disposable .e2e-gate-on copy."
    );
  }
}

function copyRepoInto(appDir) {
  log(`copying ${ROOT} → ${appDir}`);
  for (const entry of fs.readdirSync(ROOT)) {
    if (SKIP_ENTRIES.has(entry)) continue;
    // `.env`, `.env.local`, `.env.example`, … all stay behind; their values
    // are passed explicitly to the build and server instead.
    if (entry === ".env" || entry.startsWith(".env.")) continue;
    fs.cpSync(path.join(ROOT, entry), path.join(appDir, entry), {
      recursive: true,
      verbatimSymlinks: true,
    });
  }

  linkNodeModules(appDir);
}

/**
 * Give the disposable copy its own real `node_modules` built from hard links.
 *
 * Turbopack treats the project directory as its filesystem root, so a symlink
 * pointing back at the developer tree resolves to a path outside that root and
 * the build fails with "Could not find the Next.js package". Hard links make
 * the copy self-contained and hermetic from the resolver's point of view
 * without duplicating the ~850 MB package tree, because the build only ever
 * reads `node_modules`; new files created later go to the copy, not the
 * original inodes.
 */
function linkNodeModules(appDir) {
  const real = fs.realpathSync(path.join(ROOT, "node_modules"));
  const target = path.join(appDir, "node_modules");
  fs.mkdirSync(target, { recursive: true });
  log("hard-linking " + real + " to " + target);
  const result = spawnSync("cp", ["-R", "-l", real + "/.", target], {
    stdio: "inherit",
  });
  if (result.error) fail("could not link node_modules: " + result.error);
  if (result.status !== 0) {
    fail("cp -R -l node_modules exited with status " + String(result.status));
  }
  if (!fs.existsSync(path.join(target, "next", "package.json"))) {
    fail("node_modules copy is missing next/package.json at " + target);
  }
}

function flipGateInCopy() {
  if (!fs.existsSync(APP_POLICY)) {
    fail(`copy is missing ${APP_POLICY}`);
  }

  const before = fs.readFileSync(APP_POLICY, "utf8");
  const occurrences = before.split(GATE_OFF).length - 1;
  if (occurrences !== 1) {
    fail(
      `expected exactly one "${GATE_OFF}" in the copy, found ${occurrences}`
    );
  }

  fs.writeFileSync(APP_POLICY, before.replace(GATE_OFF, GATE_ON));

  const after = fs.readFileSync(APP_POLICY, "utf8");
  if (!after.includes(GATE_ON)) {
    fail("gate-on replacement did not stick in the copy");
  }

  // The copy is the only place allowed to hold `true`. Re-read the committed
  // file after patching so a mistake in path resolution cannot silently patch
  // the real tree.
  assertRootGateStillOff();
}

function runBuild(buildEnv) {
  log("running `npx next build` in the disposable copy");
  const result = spawnSync("npx", ["next", "build"], {
    cwd: APP_DIR,
    env: buildEnv,
    stdio: "inherit",
  });

  if (result.error) fail(`could not start next build: ${result.error}`);
  if (result.status !== 0) {
    fail(`next build exited with status ${result.status ?? "unknown"}`);
  }
}

function assembleStandalone() {
  const nextDir = path.join(APP_DIR, ".next");
  const standaloneDir = path.join(nextDir, "standalone");

  if (!fs.existsSync(path.join(standaloneDir, "server.js"))) {
    fail("build did not emit .next/standalone/server.js");
  }

  log("copying .next/static and public into the standalone tree");
  fs.cpSync(
    path.join(nextDir, "static"),
    path.join(standaloneDir, ".next", "static"),
    {
      recursive: true,
    }
  );
  fs.cpSync(path.join(APP_DIR, "public"), path.join(standaloneDir, "public"), {
    recursive: true,
  });
}

function prepareBuild() {
  const signature = sourceSignature();
  const signatureLine = `signature=${signature}`;
  const appExists = fs.existsSync(APP_DIR);
  const stamped = fs.existsSync(STAMP);

  if (appExists && stamped) {
    const stamp = fs.readFileSync(STAMP, "utf8");
    if (stamp.split(/\r?\n/).includes(signatureLine)) {
      log("existing build found (.e2e-gate-on/app + stamp); skipping build");
      assertRootGateStillOff();
      if (!fs.readFileSync(APP_POLICY, "utf8").includes(GATE_ON)) {
        fail("the existing copy is not gate-on; delete .e2e-gate-on/stamp");
      }
      return;
    }
    log("source changed since the cached build; rebuilding");
  }

  fs.rmSync(GATE_DIR, { recursive: true, force: true });
  fs.mkdirSync(APP_DIR, { recursive: true });

  copyRepoInto(APP_DIR);
  flipGateInCopy();
  // Turbopack resolves packages relative to the project directory it treats as
  // its filesystem root, so the copy gets a hard-linked node_modules tree that
  // lives inside that root instead of a symlink out to the developer tree.
  assertRootGateStillOff();

  const fileEnv = readEnvFile(path.join(ROOT, ".env.local"));
  const buildEnv = {
    ...process.env,
    ...fileEnv,
    NEXT_PUBLIC_ADSENSE_CLIENT: ADSENSE_CLIENT,
    NEXT_PUBLIC_ADSENSE_SLOT_HERB: ADSENSE_SLOT_HERB,
    NEXT_TELEMETRY_DISABLED: "1",
  };

  runBuild(buildEnv);
  assembleStandalone();

  fs.writeFileSync(
    STAMP,
    `built ${new Date().toISOString()}\n${signatureLine}\nclient=${ADSENSE_CLIENT}\nslot=${ADSENSE_SLOT_HERB}\n`
  );
  log(`stamp written to ${STAMP}`);
}

function startServer() {
  const standaloneDir = path.join(APP_DIR, ".next", "standalone");
  const serverEnv = {
    ...process.env,
    ...readEnvFile(path.join(ROOT, ".env.local")),
    NEXT_PUBLIC_ADSENSE_CLIENT: ADSENSE_CLIENT,
    NEXT_PUBLIC_ADSENSE_SLOT_HERB: ADSENSE_SLOT_HERB,
    NEXT_TELEMETRY_DISABLED: "1",
    NODE_ENV: "production",
    PORT: String(PORT),
    HOSTNAME,
  };

  console.log(`GATE_ON_SERVER_READY http://${HOSTNAME}:${PORT}`);
  log(`starting node server.js from ${standaloneDir}`);

  const child = spawn(process.execPath, ["server.js"], {
    cwd: standaloneDir,
    env: serverEnv,
    stdio: "inherit",
  });

  const forward = (signal) => {
    if (!child.killed) child.kill(signal);
  };
  process.on("SIGTERM", () => forward("SIGTERM"));
  process.on("SIGINT", () => forward("SIGINT"));
  process.on("SIGHUP", () => forward("SIGHUP"));

  child.on("error", (error) => fail(`server failed to start: ${error}`));
  child.on("exit", (code, signal) => {
    if (signal) {
      log(`server exited on ${signal}`);
      process.exit(0);
    }
    process.exit(code ?? 1);
  });
}

prepareBuild();
startServer();
