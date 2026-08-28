// Service worker for the Syncaxis Leads Tracker PWA.
//
// IMPORTANT: this is deliberately network-first, not cache-first. Every code change
// must always reach every installed device the next time it has a connection -- an
// aggressive cache-first strategy would work directly against that and could trap
// someone on a stale version indefinitely. The cache here exists only as a fallback
// for genuinely offline use (mirroring the app's own existing offline-banner /
// localStorage-fallback philosophy), never as the primary source when online.
//
// TAB OVERLAY: This SW also injects <script src="tabs-overlay.js"> into the
// index.html response so the tab navigation UI loads without modifying the
// 858KB index.html file directly. The overlay script transforms the existing
// stacked sections into a 3-tab layout (Overview / Follow-Up / All Leads).

const CACHE_NAME = 'syncaxis-leads-shell-v3';
const SHELL_FILES = ['./', './index.html', './manifest.json', './tabs-overlay.js'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
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
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  const isIndexHtml = new URL(req.url).pathname === '/' ||
                      new URL(req.url).pathname === '/index.html' ||
                      new URL(req.url).pathname.endsWith('/');

  if (isIndexHtml) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
          return res.text().then(html => {
            const modified = html.replace('</body>',
              '<script src="tabs-overlay.js" defer></script>\n</body>');
            return new Response(modified, {
              headers: res.headers,
              status: res.status,
              statusText: res.statusText
            });
          });
        })
        .catch(() => caches.match(req).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

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
