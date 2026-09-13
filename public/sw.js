const IMAGE_CACHE = "oc-images-v1";
const RUNTIME_CACHE = "oc-runtime-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(RUNTIME_CACHE).then((cache) => cache.add(OFFLINE_URL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("oc-") && name !== IMAGE_CACHE && name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  if (url.hostname.endsWith("res.cloudinary.com")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(IMAGE_CACHE);
        const cached = await cache.match(req);
        const fetchPromise = fetch(req)
          .then(async (res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || fetchPromise || Response.error();
      })()
    );
    return;
  }

  if (
    url.origin === self.location.origin &&
    !url.pathname.startsWith("/api/") &&
    !url.pathname.startsWith("/_vercel/")
  ) {
    event.respondWith(
      (async () => {
        if (req.mode === "navigate") {
          try {
            const res = await fetch(req);
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(req, res.clone());
            return res;
          } catch {
            const cached = await caches.match(req);
            if (cached) return cached;
            const offline = await caches.match(OFFLINE_URL);
            return offline || Response.error();
          }
        }

        try {
          const res = await fetch(req);
          if (res.ok) {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(req, res.clone());
          }
          return res;
        } catch {
          const cached = await caches.match(req);
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          return offline || Response.error();
        }
      })()
    );
  }
});
