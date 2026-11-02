const CACHE = 'budget-v2';
const FILES = ['./','./index.html','./style.css','./app.js','./core.js','./config.js','./manifest.webmanifest','./icons/192.png','./icons/512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('budget-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => { if(e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return; e.respondWith(fetch(e.request).then(r => { if(r.ok) { const clone=r.clone(); caches.open(CACHE).then(c => c.put(e.request,clone)); } return r; }).catch(() => caches.match(e.request).then(r => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())))); });
