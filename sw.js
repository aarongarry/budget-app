const CACHE = 'budget-1.4.3';
const FILES = ['./', './index.html', './style.css?v=1.4.3', './app.js?v=1.4.3', './core.js?v=1.4.3', './config.js?v=1.4.3', './dom.js?v=1.4.3', './drafts.js?v=1.4.3', './builder.js?v=1.4.3', './reorder.js?v=1.4.3', './gestures.js?v=1.4.3', './updates.js?v=1.4.3', './manifest.webmanifest', './icons/192.png', './icons/512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(url => new Request(url, { cache: 'reload' })))));
  // Existing installations wait for the user to choose Update app.
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('budget-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.endsWith('/version.json')) return;
  event.respondWith(fetch(event.request, { cache: 'no-cache' }).then(response => {
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)));
    }
    return response;
  }).catch(() => caches.match(event.request).then(cached => cached || (event.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
