import fs from "node:fs";
import path from "node:path";

const TARGETS = [
  "node_modules/next/dist/server/image-optimizer.js",
  "node_modules/next/dist/esm/server/image-optimizer.js",
];

const HERBALLY_UA = "HerbAlly/1.0 (https://herbally.app; info@herbally.app)";

const SEMAPHORE_HELPER = `const __herballyImgQueue = [];
let __herballyImgInFlight = 0;
async function __herballyWithImageSlot(fn) {
    if (__herballyImgInFlight >= 4) {
        await new Promise((resolve) => __herballyImgQueue.push(resolve));
    }
    __herballyImgInFlight++;
    try {
        return await fn();
    } finally {
        __herballyImgInFlight--;
        const next = __herballyImgQueue.shift();
        if (next) next();
    }
}
`;

function patchFile(relPath) {
  const fullPath = path.join(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing target file: ${fullPath}`);
  }
  let src = fs.readFileSync(fullPath, "utf8");

  if (!src.includes("__herballyWithImageSlot")) {
    // 1. Replace hardcoded `user-agent: 'node'`
    if (!src.includes("'user-agent': 'node'")) {
      throw new Error(`Expected 'user-agent': 'node' in ${relPath}`);
    }
    src = src.replace("'user-agent': 'node'", `'user-agent': '${HERBALLY_UA}'`);

    // 2. Increase upstream fetch timeout from 7000ms to 30000ms
    if (!src.includes("timeout: 7000")) {
      throw new Error(`Expected timeout: 7000 in ${relPath}`);
    }
    src = src.replace("timeout: 7000", "timeout: 30000");

    // 3. Inject 4-concurrency semaphore above requestUpstreamImage
    const reqAnchor = "function requestUpstreamImage(";
    if (!src.includes(reqAnchor)) {
      throw new Error(`Expected ${reqAnchor} in ${relPath}`);
    }
    src = src.replace(reqAnchor, `${SEMAPHORE_HELPER}${reqAnchor}`);

    // 4. Wrap top-level fetchExternalImage calls in semaphore (without deadlocking redirects)
    const fnAnchorCjs =
      "async function fetchExternalImage(href, dangerouslyAllowLocalIP, maximumResponseBody, count = 3) {";
    const fnAnchorEsm =
      "export async function fetchExternalImage(href, dangerouslyAllowLocalIP, maximumResponseBody, count = 3) {";
    if (src.includes(fnAnchorEsm)) {
      src = src.replace(
        fnAnchorEsm,
        "export async function fetchExternalImage(href, dangerouslyAllowLocalIP, maximumResponseBody, count = 3, __slotted = false) {\n    if (!__slotted) {\n        return __herballyWithImageSlot(() => fetchExternalImage(href, dangerouslyAllowLocalIP, maximumResponseBody, count, true));\n    }"
      );
    } else if (src.includes(fnAnchorCjs)) {
      src = src.replace(
        fnAnchorCjs,
        "async function fetchExternalImage(href, dangerouslyAllowLocalIP, maximumResponseBody, count = 3, __slotted = false) {\n    if (!__slotted) {\n        return __herballyWithImageSlot(() => fetchExternalImage(href, dangerouslyAllowLocalIP, maximumResponseBody, count, true));\n    }"
      );
    } else {
      throw new Error(`Expected fetchExternalImage signature in ${relPath}`);
    }

    // 5. Add retry/backoff on 429 / 503 / timeout inside fetchExternalImage
    const fetchBlockOld = `    const signal = AbortSignal.timeout(agentOptions.timeout);
    let res;
    try {
        res = await requestUpstreamImage(url, pinnedLookup, imageLookupKey, dangerouslyAllowLocalIP, signal);
    } catch (err) {
        if (signal.aborted) {
            throw upstreamTimedOut(href);
        }
        throw err;
    }`;

    const fetchBlockNew = `    let signal;
    let res;
    for (let __attempt = 1; __attempt <= 4; __attempt++) {
        signal = AbortSignal.timeout(agentOptions.timeout);
        try {
            res = await requestUpstreamImage(url, pinnedLookup, imageLookupKey, dangerouslyAllowLocalIP, signal);
        } catch (err) {
            if (signal.aborted) {
                if (__attempt < 4) {
                    await new Promise((resolve) => setTimeout(resolve, 1500 * __attempt));
                    continue;
                }
                throw upstreamTimedOut(href);
            }
            throw err;
        }
        if ((res.statusCode === 429 || res.statusCode === 503) && __attempt < 4) {
            const ra = Number(res.headers['retry-after']);
            res.resume();
            const waitMs = Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 10000) : 1500 * __attempt;
            await new Promise((resolve) => setTimeout(resolve, waitMs));
            continue;
        }
        break;
    }`;

    if (!src.includes(fetchBlockOld)) {
      throw new Error(`Expected requestUpstreamImage call block in ${relPath}`);
    }
    src = src.replace(fetchBlockOld, fetchBlockNew);

    fs.writeFileSync(fullPath, src, "utf8");
    console.log(`Patched ${relPath}`);
  } else {
    console.log(`Already patched ${relPath}`);
  }
}

for (const target of TARGETS) {
  patchFile(target);
}
