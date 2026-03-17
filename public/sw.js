const CACHE_NAME = "transporte-df-v1";

// Add specific routes and static assets that should always be available offline
const PRECACHE_ASSETS = [
  "/",
  "/manifest.json",
  "/favicon.ico",
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/apple-icon.png",
];

// Install event - precache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // We use addAll with catch to ensure install doesn't fail if some files are missing initially
      return Promise.allSettled(
        PRECACHE_ASSETS.map((url) => cache.add(url))
      );
    })
  );
  // Force the waiting service worker to become the active service worker.
  self.skipWaiting();
});

// Activate event - clean up old caches
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
  // Claim all clients immediately so the page is controlled by the SW
  self.clients.claim();
});

// Fetch event - use network first, then fallback to cache
self.addEventListener("fetch", (event) => {
  // Only handle GET requests and exclude browser extensions
  if (
    event.request.method !== "GET" ||
    event.request.url.startsWith("chrome-extension")
  ) {
    return;
  }

  // Exempt MapLibre tiles from caching in our SW to let the browser/MapLibre handle it
  // and prevent cache bloat
  if (event.request.url.includes("tiles.openfreemap.org")) {
    return;
  }

  // Network First, Cache Fallback Strategy
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Clone the response before caching
        const responseToCache = networkResponse.clone();
        
        // Cache successful responses for our domain
        if (
          networkResponse.ok &&
          event.request.url.startsWith(self.location.origin)
        ) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        
        return networkResponse;
      })
      .catch(() => {
        // Network failed (offline) - try cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // If the request is for an HTML page or root route and network + cache fail,
          // return the cached root '/' acting as offline fallback
          if (
            event.request.mode === "navigate" ||
            event.request.headers.get("accept").includes("text/html")
          ) {
            return caches.match("/");
          }
          
          return new Response("Network error happened", {
            status: 408,
            headers: { "Content-Type": "text/plain" },
          });
        });
      })
  );
});
