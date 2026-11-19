const prefix = 'cubey-canon:' + self.registration.scope + ':';
const cacheName = prefix + '__BUILD_ID__';
const files = /* __FILES__ */ [];
const urlFor = file => new URL(file, self.registration.scope).href;
const assets = new Set(files.map(urlFor));
const entry = urlFor('index.html');

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache =>
    cache.addAll([...assets].map(url => new Request(url, { cache: 'reload' })))));
});

// Let open levels finish on the old build before removing their chunks.
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(prefix) && name !== cacheName) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  url.search = '';
  let key = url.href;
  if (request.mode === 'navigate' && (key === self.registration.scope || key === entry)) key = entry;
  if (!assets.has(key)) return;
  event.respondWith(caches.open(cacheName).then(async cache => (await cache.match(key)) || fetch(request)));
});
