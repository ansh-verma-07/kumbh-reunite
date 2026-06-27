// Kumbh Reunite service worker — shell caching for 3G / offline kiosk use.
// API calls are never cached (always live).
const CACHE = "kr-v2";
const SHELL = ["/", "/new", "/search", "/police", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname.startsWith("/api/")) return; // never cache API

  // Map tiles: cache-first so the hotspot map works on 3G / offline.
  if (url.hostname.endsWith("tile.openstreetmap.org")) {
    e.respondWith(
      caches.match(req).then(
        (m) =>
          m ||
          fetch(req).then((r) => {
            const cp = r.clone();
            caches.open(CACHE).then((c) => c.put(req, cp));
            return r;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const cp = r.clone();
          caches.open(CACHE).then((c) => c.put(req, cp));
          return r;
        })
        .catch(() => caches.match(req).then((m) => m || caches.match("/"))),
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(
      (m) =>
        m ||
        fetch(req)
          .then((r) => {
            if (r.ok && url.origin === self.location.origin) {
              const cp = r.clone();
              caches.open(CACHE).then((c) => c.put(req, cp));
            }
            return r;
          })
          .catch(() => m),
    ),
  );
});
