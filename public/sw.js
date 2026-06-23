const CACHE_NAME = "herbally-v6";
const API_CACHE = "herbally-api-v2";

// Core pages to cache on install (both EN and FR)
const STATIC_URLS = [
  "/",
  "/fr",
  "/herbs",
  "/fr/herbs",
  "/symptoms",
  "/fr/symptoms",
  "/herbalist",
  "/fr/herbalist",
  "/calculator",
  "/fr/calculator",
  "/garden",
  "/faq",
  "/fr/faq",
  "/about",
  "/fr/about",
  "/offline.html",
];

// API endpoints to cache for offline herb browsing
const DB_CACHE_URLS = ["/api/herbs/search", "/api/herbs/random"];

const API_URLS = [...DB_CACHE_URLS];

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
    caches.keys().then((cacheNames) => {
      // Clean up ALL old caches — both page cache and API cache — so stale
      // entries (e.g. the old /api/herbs/list reference) are purged on deploy.
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== API_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Skip non-app requests
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/auth/")) return;
  if (url.pathname.startsWith("/api/chat")) return; // Don't cache AI chat

  // API requests: network-first, cache for offline
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
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
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        })
    );
    return;
  }

  // Herb detail pages (including /fr/herbs/*): cache-first, network update
  const pathParts = url.pathname.split("/").filter(Boolean);
  const isHerbDetail =
    (pathParts[0] === "herbs" ||
      (pathParts[0] === "fr" && pathParts[1] === "herbs")) &&
    pathParts.length === (pathParts[0] === "fr" ? 3 : 2);

  if (isHerbDetail) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        const networkFetch = fetch(event.request)
          .then((response) => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // Navigation & static: network-first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
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
        return new Response("Offline", { status: 503 });
      })
  );
});
