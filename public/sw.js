const CACHE_NAME = "herbally-v3";
const STATIC_URLS = [
  "/",
  "/herbs",
  "/symptoms",
  "/faq",
  "/herbalist",
  "/calculator",
];
const OFFLINE_FALLBACK = "/offline.html";

// Stale-while-revalidate for herb pages, network-first for everything else
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache static pages — don't block install on failures
      await cache.addAll(STATIC_URLS).catch(() => {});
      // Cache offline fallback
      await cache.add(OFFLINE_FALLBACK).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Skip API calls, auth, and external requests
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  // Herb detail pages: stale-while-revalidate (fast load from cache, update in background)
  if (url.pathname.startsWith("/herbs/") && !url.pathname.endsWith("/")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        const fetchPromise = fetch(event.request)
          .then((response) => {
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          })
          .catch(() => cached);

        // Return cached immediately if available, otherwise wait for network
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Everything else: network first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        // For navigation requests, show offline page
        if (event.request.mode === "navigate") {
          const offline = await caches.match(OFFLINE_FALLBACK);
          if (offline) return offline;
        }
        return new Response("Offline", { status: 503 });
      })
  );
});
