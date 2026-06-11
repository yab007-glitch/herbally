const CACHE_NAME = "herbally-v4";
const API_CACHE = "herbally-api-v1";

// Core pages to cache on install
const STATIC_URLS = [
  "/",
  "/herbs",
  "/symptoms",
  "/herbalist",
  "/calculator",
  "/garden",
  "/faq",
  "/about",
  "/offline.html",
];

// API endpoints to cache for offline herb browsing
const DB_CACHE_URLS = [
  "/api/herbs/list",
  "/api/herbs/search",
];

const API_URLS = [
  ...DB_CACHE_URLS,
  "/api/herbs/random",
];

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

  // Herb detail pages: cache-first, network update
  if (url.pathname.startsWith("/herbs/") && url.pathname.split("/").length === 3) {
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
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
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
