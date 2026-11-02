// Service worker (README §3, F6): app-shell cache for weak connections.
// Pages are network-first (they're live data) with the last good copy as a fallback;
// build assets and book covers are cache-first. Check-in retries live in the page
// (CheckinForm), because iOS has no Background Sync.

const VERSION = "v1";
const SHELL = `shell-${VERSION}`;
const PAGES = `pages-${VERSION}`;
const COVERS = `covers-${VERSION}`;
const OFFLINE_URL = "/offline";
const MAX_PAGES = 30;
const MAX_COVERS = 200;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll([OFFLINE_URL, "/manifest.webmanifest", "/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([SHELL, PAGES, COVERS]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((k) => cache.delete(k)));
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      await cache.put(request, response.clone());
      trim(PAGES, MAX_PAGES);
    }
    return response;
  } catch {
    return (await cache.match(request)) ?? (await caches.match(OFFLINE_URL));
  }
}

async function cacheFirst(request, cacheName, max) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === "opaque") {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
    if (max) trim(cacheName, max);
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // server actions, sign-in: always live
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/") || url.pathname.startsWith("/admin")) return;
    if (url.pathname.startsWith("/_next/static/")) {
      event.respondWith(cacheFirst(request, SHELL));
      return;
    }
    // Full page loads only; React Server Component fetches carry an RSC header and stay live.
    if (request.mode === "navigate" && !request.headers.has("RSC")) {
      event.respondWith(networkFirstPage(request));
    }
    return;
  }

  if (url.hostname === "covers.openlibrary.org") {
    event.respondWith(cacheFirst(request, COVERS, MAX_COVERS));
  }
});
