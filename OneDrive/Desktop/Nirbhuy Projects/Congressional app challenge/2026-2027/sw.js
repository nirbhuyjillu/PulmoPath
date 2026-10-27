/* AQI Guardian service worker: app-shell offline cache */
const CACHE = 'aqi-guardian-v12';
const ASSETS = ['./', './index.html', './advisor.html', './drive.html', './house.html', './map.html', './about.html', './scenarios.html', './regression.html', './regression.css', './regression.js', './regression-page.js', './regression-model.json', './towns.js', './api.js', './advisory.js', './demo.js', './app1.js', './forecast.js', './health.js', './about.js', './scenarios.js', './styles.css', './guardian.css', './shell.js', './manifest.webmanifest', './icon.svg'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([...ASSETS, './route-actions.js'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('aqi-guardian-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Leave external resources and live API requests to the browser. Never serve
  // an HTML fallback for a failed API, script, stylesheet, or map tile.
  if (url.origin !== self.location.origin || e.request.method !== 'GET') return;
  // App shell: network-first so edits always show up, falling back to cache when offline
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res && res.ok && e.request.method === 'GET') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(async () => {
        const hit = await caches.match(e.request, { ignoreSearch: true });
        if (hit) return hit;
        if (e.request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      })
  );
});
