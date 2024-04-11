// This is the "Offline copy of pages" service worker

const CACHE = "pwabuilder-offline";

const offlineFallbackPage = "offline.html";

self.addEventListener("install", async (event) => {
  console.log("[PWA Builder] Install Event processing");

  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    console.log("[PWA Builder] Cached offline page during install");
    return cache.add(offlineFallbackPage);
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith((async () => {
    try {
      const networkResponse = await fetch(event.request);
      const cache = await caches.open(CACHE);
      // Clone the response to ensure it's safe to read when adding to the cache.
      const responseClone = networkResponse.clone();
      await cache.put(event.request, responseClone);
      return networkResponse;
    } catch (error) {
      console.log("[PWA Builder] Network request Failed. Serving content from cache: " + error);
      const cache = await caches.open(CACHE);
      const matching = await cache.match(event.request);
      let report = !matching || matching.status == 404 ? Promise.reject("no-match") : matching;
      return report;
    }
  })());
});

self.addEventListener("refreshOffline", () => {
  const offlinePageRequest = new Request(offlineFallbackPage);

  return (async () => {
    const response = await fetch(offlineFallbackPage);
    const cache = await caches.open(CACHE);
    console.log("[PWA Builder] Offline page updated from refreshOffline event: " + response.url);
    return cache.put(offlinePageRequest, response);
  })();
});