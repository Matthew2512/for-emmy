const CACHE_NAME = "for-emmy-v9";
const CORE_FILES = [
  "index.html",
  "stories.html",
  "wishlist.html",
  "secret.html",
  "luckydraw.html",
  "places.html",
  "style.css",
  "script.js",
  "stories.js",
  "wishlist.js",
  "secret.js",
  "luckydraw.js",
  "places.js",
  "firebase-config.js",
  "manifest.json",
  "icon-192.png",
  "icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Network first so a new deploy is picked up straight away (and pages never
  // mix an old cached HTML with a new script); the cache is only for offline.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
