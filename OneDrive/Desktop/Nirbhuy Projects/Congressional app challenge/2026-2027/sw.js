/* AQI Guardian service worker: app-shell offline cache */
const CACHE = 'aqi-guardian-v6';
const ASSETS = ['./', './index.html', './map.html', './advisor.html', './drive.html', './house.html', './about.html', './scenarios.html', './regression.html', './regression.css', './regression.js', './regression-page.js', './regression-model.json', './train_pef_model.py', './towns.js', './api.js', './advisory.js', './demo.js', './app1.js', './home.js', './map.js', './advisor.js', './drive.js', './house.js', './about.js', './scenarios.js', './styles.css', './manifest.webmanifest', './icon.svg'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Never cache live API calls
  if (url.hostname.includes('open-meteo') || url.hostname.includes('router.project-osrm')
      || url.hostname.includes('nominatim') || url.hostname.includes('unpkg')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
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
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html')))
  );
});
