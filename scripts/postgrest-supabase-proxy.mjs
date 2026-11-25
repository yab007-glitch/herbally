import http from "node:http";

/**
 * Lightweight local Supabase REST proxy for CI E2E against PostgREST + PG16.
 * Translates `/rest/v1/<path>` -> `<POSTGREST_URL>/<path>` and preserves headers,
 * status codes, and response bodies so Next.js (`@supabase/supabase-js`) works
 * identically against a live migrated PostgreSQL 16 + PostgREST instance.
 */
const LISTEN_PORT = Number(process.env.PROXY_PORT || "54321");
const POSTGREST_URL = (
  process.env.POSTGREST_URL || "http://127.0.0.1:3001"
).replace(/\/+$/, "");

const server = http.createServer(async (req, res) => {
  try {
    const rawUrl = req.url || "/";
    if (rawUrl.startsWith("/auth/v1")) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "Auth session missing" }));
      return;
    }
    const targetPath = rawUrl.startsWith("/rest/v1")
      ? rawUrl.slice("/rest/v1".length) || "/"
      : rawUrl;
    const targetUrl = `${POSTGREST_URL}${targetPath}`;

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

    const headers = {};
    for (const [key, val] of Object.entries(req.headers)) {
      if (!val || key === "host" || key === "content-length") continue;
      headers[key] = Array.isArray(val) ? val.join(", ") : val;
    }

    const upstream = await fetch(targetUrl, {
      method: req.method || "GET",
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
    });

    const outHeaders = {};
    upstream.headers.forEach((val, key) => {
      if (key === "transfer-encoding" || key === "content-encoding") return;
      outHeaders[key] = val;
    });

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, outHeaders);
    res.end(buf);
  } catch (err) {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        error: "postgrest_proxy_error",
        message: err instanceof Error ? err.message : String(err),
      })
    );
  }
});

server.listen(LISTEN_PORT, "127.0.0.1", () => {
  console.log(
    `PostgREST Supabase proxy listening on http://127.0.0.1:${LISTEN_PORT} -> ${POSTGREST_URL}`
  );
});
