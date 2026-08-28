// Service worker for the Syncaxis Leads Tracker PWA.
//
// IMPORTANT: this is deliberately network-first, not cache-first. Every code change
// must always reach every installed device the next time it has a connection -- an
// aggressive cache-first strategy would work directly against that and could trap
// someone on a stale version indefinitely. The cache here exists only as a fallback
// for genuinely offline use (mirroring the app's own existing offline-banner /
// localStorage-fallback philosophy), never as the primary source when online.

const CACHE_NAME = 'syncaxis-leads-shell-v2';
const SHELL_FILES = ['./', './index.html', './manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting(); // a newly-deployed SW takes over immediately, not after every tab closes
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => Promise.all(
      names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  // Only handle same-origin GET requests -- never intercept Firestore/Firebase/auth
  // calls or cross-origin requests (the geo API, Google Fonts, etc.), which must
  // always go straight to the network untouched.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then(cached => cached || caches.match('./index.html')))
  );
});
