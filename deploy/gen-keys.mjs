#!/usr/bin/env node
// Mint the JWT material for the self-hosted stack.
//
// The hosted project hands out opaque keys (sb_publishable_…, sb_secret_…)
// that only the Supabase gateway understands. A self-hosted PostgREST needs a
// verifiable JWT, so this generates a HS256 secret plus the two role tokens,
// in the classic format every @supabase/* client already accepts.
//
//   node deploy/gen-keys.mjs            → prints to stdout
//   node deploy/gen-keys.mjs -o deploy/.env
//
// Re-running it invalidates every token it printed before, so run it once per
// deployment and keep the output.

import { createHmac, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const b64url = (input) =>
  Buffer.from(input)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

function sign(payload, secret) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(
    createHmac("sha256", secret).update(`${header}.${body}`).digest()
  );
  return `${header}.${body}.${sig}`;
}

const jwtSecret = randomBytes(48).toString("hex");
const issuedAt = Math.floor(Date.now() / 1000);
// Ten years. Rotating these means reissuing keys to every client, so expiry
// buys nothing here; the security boundary is JWT_SECRET, not the token age.
const expiresAt = issuedAt + 60 * 60 * 24 * 365 * 10;

const claims = (role) => ({
  iss: "supabase",
  sub: null,
  aud: "authenticated",
  role,
  iat: issuedAt,
  exp: expiresAt,
});

const output = [
  `JWT_SECRET=${jwtSecret}`,
  `ANON_KEY=${sign(claims("anon"), jwtSecret)}`,
  `SERVICE_ROLE_KEY=${sign(claims("service_role"), jwtSecret)}`,
  "",
].join("\n");

const outIndex = process.argv.indexOf("-o");
if (outIndex !== -1 && process.argv[outIndex + 1]) {
  const path = process.argv[outIndex + 1];
  // Merge rather than clobber: the usual call is `cp .env.example .env`
  // followed by this, so overwriting would silently drop POSTGRES_PASSWORD
  // and the SMTP block. Blank placeholders get filled in place; a file that
  // already holds real keys is left alone.
  const values = Object.fromEntries(
    output
      .split("\n")
      .filter((line) => line.includes("="))
      .map((line) => [
        line.slice(0, line.indexOf("=")),
        line.slice(line.indexOf("=") + 1),
      ])
  );

  let text = existsSync(path) ? readFileSync(path, "utf8") : "";
  for (const [key, value] of Object.entries(values)) {
    const blank = new RegExp(`^${key}=\\s*$`, "m");
    const filled = new RegExp(`^${key}=.+$`, "m");
    if (filled.test(text)) {
      console.error(`${path} already defines ${key} — leaving it alone.`);
      continue;
    }
    text = blank.test(text)
      ? text.replace(blank, `${key}=${value}`)
      : `${text}\n${key}=${value}`;
  }
  writeFileSync(path, text, { mode: 0o600 });
  console.error(
    `Merged JWT_SECRET, ANON_KEY and SERVICE_ROLE_KEY into ${path} (mode 600).`
  );
  console.error(`Add these to deploy/app.env as well:`);
  console.error(`  NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>`);
  console.error(`  SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>`);
} else {
  process.stdout.write(output);
}
