/* global self, caches, URL, fetch, Response */

const CACHE_VERSION = 'neon-drift-shell-v2';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/neon-drift-icon.svg',
  './icons/neon-drift-icon-192.svg',
];

async function precacheApplication() {
  const cache = await caches.open(CACHE_VERSION);
  const indexUrl = new URL('./index.html', self.registration.scope);
  const indexResponse = await fetch(indexUrl, { cache: 'reload' });
  if (!indexResponse.ok) throw new Error('Unable to fetch the application shell.');

  const html = await indexResponse.clone().text();
  const assetUrls = [];
  const attributePattern = /(?:src|href)="([^"]+)"/g;
  let match = attributePattern.exec(html);
  while (match !== null) {
    const candidate = new URL(match[1], indexUrl);
    if (
      candidate.origin === self.location.origin &&
      candidate.pathname.startsWith(new URL(self.registration.scope).pathname)
    ) {
      assetUrls.push(candidate.href);
    }
    match = attributePattern.exec(html);
  }

  await cache.put(indexUrl, indexResponse);
  await cache.addAll([...new Set([...SHELL_FILES, ...assetUrls])]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheApplication().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(
          async () =>
            (await caches.match(request)) || (await caches.match('./')) || Response.error(),
        ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return cached;
      const response = await fetch(request);
      if (
        response.ok &&
        ['script', 'style', 'image', 'font', 'audio'].includes(request.destination)
      ) {
        const cache = await caches.open(CACHE_VERSION);
        await cache.put(request, response.clone());
      }
      return response;
    }),
  );
});
