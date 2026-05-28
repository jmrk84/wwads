const APP_VERSION = 'v13';
const SHELL_CACHE = `wwads-shell-${APP_VERSION}`;
const DATA_CACHE  = `wwads-data-${APP_VERSION}`;
const TILE_CACHE  = `wwads-tiles-${APP_VERSION}`;

const SHELL_FILES = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'app.js',
  'cities.js',
  'weather.js',
  'ui.js',
  'radar.js',
  'vendor/leaflet/leaflet.css',
  'vendor/leaflet/leaflet.js',
  'vendor/leaflet/images/marker-icon.png',
  'vendor/leaflet/images/marker-icon-2x.png',
  'vendor/leaflet/images/marker-shadow.png',
  'vendor/leaflet/images/layers.png',
  'vendor/leaflet/images/layers-2x.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'vendor/twemoji/2600.svg',
  'vendor/twemoji/1f319.svg',
  'vendor/twemoji/1f324.svg',
  'vendor/twemoji/26c5.svg',
  'vendor/twemoji/2601.svg',
  'vendor/twemoji/1f32b.svg',
  'vendor/twemoji/1f326.svg',
  'vendor/twemoji/1f327.svg',
  'vendor/twemoji/26c8.svg',
  'vendor/twemoji/1f328.svg',
  'vendor/twemoji/2744.svg',
  'vendor/twemoji/1f4a7.svg',
  'vendor/twemoji/2753.svg'
];

const DATA_HOSTS = [
  'api.open-meteo.com',
  'geocoding-api.open-meteo.com',
  'api.bigdatacloud.net',
  'api.rainviewer.com'
];
const TILE_HOSTS = [
  'tile.openstreetmap.org',
  'tilecache.rainviewer.com'
];
const TILE_CACHE_MAX = 400;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // cache: 'reload' bypasses the browser HTTP cache so each precached asset is
    // fetched fresh from the network. Without this, GitHub Pages' max-age=600
    // means a newly-installed SW can cache the previous version's stale files.
    await Promise.all(SHELL_FILES.map(async (file) => {
      try {
        await cache.add(new Request(file, { cache: 'reload' }));
      } catch (err) {
        console.warn('[SW] failed to precache', file, err);
      }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => {
      if (k.startsWith('wwads-') && ![SHELL_CACHE, DATA_CACHE, TILE_CACHE].includes(k)) {
        return caches.delete(k);
      }
    }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Navigation: network-first w/ shell fallback for offline
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        return res;
      } catch {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match('./')) || (await cache.match('index.html')) || Response.error();
      }
    })());
    return;
  }

  if (url.origin === self.location.origin) {
    // App shell: cache-first
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        return res;
      } catch {
        return Response.error();
      }
    })());
    return;
  }

  if (TILE_HOSTS.some(h => url.hostname === h || url.hostname.endsWith('.' + h))) {
    event.respondWith(cacheFirst(req, TILE_CACHE, TILE_CACHE_MAX));
    return;
  }

  if (DATA_HOSTS.some(h => url.hostname === h || url.hostname.endsWith('.' + h))) {
    event.respondWith(networkFirst(req, DATA_CACHE));
    return;
  }

  // Default: pass-through
});

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(req);
    if (fresh.ok) {
      // Avoid caching huge or opaque error responses
      cache.put(req, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (err) {
    const cached = await cache.match(req);
    if (cached) {
      // Tag the response so the app can show a stale badge
      const body = await cached.clone().blob();
      const headers = new Headers(cached.headers);
      headers.set('X-From-Cache', '1');
      return new Response(body, {
        status: cached.status,
        statusText: cached.statusText,
        headers
      });
    }
    return new Response(
      JSON.stringify({ error: 'offline' }),
      { status: 503, headers: { 'content-type': 'application/json' } }
    );
  }
}

async function cacheFirst(req, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) {
    // Background revalidate
    fetch(req).then(r => {
      if (r && r.ok) cache.put(req, r.clone()).catch(() => {});
    }).catch(() => {});
    return cached;
  }
  try {
    const fresh = await fetch(req);
    if (fresh.ok) {
      cache.put(req, fresh.clone()).catch(() => {});
      trimCache(cacheName, maxEntries);
    }
    return fresh;
  } catch {
    // Network error: let Leaflet handle via errorTileUrl
    return Response.error();
  }
}

async function trimCache(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  // delete oldest (entries are roughly insertion-ordered)
  const toDelete = keys.length - max;
  for (let i = 0; i < toDelete; i++) {
    await cache.delete(keys[i]);
  }
}
