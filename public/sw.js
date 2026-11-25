const CACHE_NAME = "herbally-public-v7";
const API_CACHE = "herbally-public-api-v3";

// Core public reference pages to pre-cache on install (EN and FR).
// Personalized or authenticated routes (/garden, /profile, /admin) are
// intentionally excluded.
const STATIC_URLS = [
  "/",
  "/fr",
  "/herbs",
  "/fr/herbs",
  "/symptoms",
  "/fr/symptoms",
  "/calculator",
  "/fr/calculator",
  "/faq",
  "/fr/faq",
  "/about",
  "/fr/about",
  "/offline.html",
];

// Strictly public catalog API endpoints safe for offline fallback.
const PUBLIC_API_ALLOWLIST = new Set([
  "/api/herbs/search",
  "/api/herbs/random",
]);

const PRIVATE_PATH_RE =
  /^\/(auth|admin|profile|garden|login|register|forgot-password|reset-password)(\/|$)/;

const PUBLIC_ASSET_PREFIXES = [
  "/_next/static/",
  "/icons/",
  "/images/",
  "/offline.html",
];

const PUBLIC_PAGE_RE =
  /^(\/|\/(herbs|symptoms|medications|guides|compare|interactions|herb-drug-interactions|calculator|npn-checker|surgery-planner|widgets|about|faq|methodology|editorial-policy|privacy|terms)(\/.*)?)$/;

function stripLocalePrefix(pathname) {
  if (pathname === "/en" || pathname === "/fr") return "/";
  if (pathname.startsWith("/en/")) return pathname.slice(3);
  if (pathname.startsWith("/fr/")) return pathname.slice(3);
  return pathname;
}

function isPrivatePath(pathname) {
  if (pathname.startsWith("/auth/") || pathname.startsWith("/api/")) {
    return true;
  }
  return PRIVATE_PATH_RE.test(stripLocalePrefix(pathname));
}

function isPublicAsset(pathname) {
  return PUBLIC_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isAllowlistedPublicPage(pathname) {
  if (isPrivatePath(pathname)) return false;
  return PUBLIC_PAGE_RE.test(stripLocalePrefix(pathname));
}

function isCacheablePublicResponse(response) {
  if (!response || response.status !== 200) return false;
  if (response.type !== "basic" && response.type !== "default") return false;
  if (response.headers.has("Set-Cookie")) return false;
  const cacheControl = (
    response.headers.get("Cache-Control") || ""
  ).toLowerCase();
  if (
    cacheControl.includes("private") ||
    cacheControl.includes("no-store") ||
    cacheControl.includes("no-cache")
  ) {
    return false;
  }
  return true;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(STATIC_URLS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== API_CACHE)
            .map((name) => caches.delete(name))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CLEAR_CACHES") {
    const work = caches
      .keys()
      .then((names) => Promise.all(names.map((name) => caches.delete(name))))
      .then((results) => {
        const ok = results.every(Boolean);
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ ok });
        }
      })
      .catch(() => {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ ok: false });
        }
      });
    if (typeof event.waitUntil === "function") {
      event.waitUntil(work);
    }
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.headers && event.request.headers.get("Authorization")) {
    return;
  }

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Allowlisted public API endpoints only — private/auth/garden/admin/chat APIs
  // pass straight through to the network without interception or caching.
  if (url.pathname.startsWith("/api/")) {
    if (!PUBLIC_API_ALLOWLIST.has(url.pathname)) return;

    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (isCacheablePublicResponse(response)) {
            const clone = response.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          return new Response(
            JSON.stringify({
              error: "Offline: data unavailable.",
              offline: true,
              unavailable: true,
            }),
            {
              status: 503,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
              },
            }
          );
        })
    );
    return;
  }

  // Never intercept or cache private, auth, account, garden, or admin routes.
  if (isPrivatePath(url.pathname)) return;

  const isAsset = isPublicAsset(url.pathname);
  const isPublicPage = isAllowlistedPublicPage(url.pathname);
  if (!isAsset && !isPublicPage) return;

  // Public herb detail pages: cache-first with background refresh.
  const stripped = stripLocalePrefix(url.pathname);
  const parts = stripped.split("/").filter(Boolean);
  const isHerbDetail = parts[0] === "herbs" && parts.length === 2;

  if (isHerbDetail) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) {
          fetch(event.request)
            .then((response) => {
              if (isCacheablePublicResponse(response)) {
                return cache.put(event.request, response.clone());
              }
            })
            .catch(() => {});
          return cached;
        }
        try {
          const response = await fetch(event.request);
          if (isCacheablePublicResponse(response)) {
            cache.put(event.request, response.clone());
          }
          return response;
        } catch {
          return new Response("Offline", {
            status: 503,
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Cache-Control": "no-store",
            },
          });
        }
      })
    );
    return;
  }

  // Public pages & static assets: network-first with cache fallback.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (isCacheablePublicResponse(response)) {
          const clone = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === "navigate") {
          const offline = await caches.match("/offline.html");
          if (offline) return offline;
        }
        return new Response("Offline", {
          status: 503,
          headers: { "Cache-Control": "no-store" },
        });
      })
  );
});
