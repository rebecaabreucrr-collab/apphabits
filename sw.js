// Service worker: o app funciona offline e atualiza sozinho quando houver internet.
const CACHE = 'minharotina-v6';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/styles.css',
  './js/app.js', './js/utils.js', './js/store.js', './js/defaults.js', './js/logic.js', './js/ui.js', './js/forms.js',
  './js/view-today.js', './js/view-care.js', './js/view-reading.js', './js/view-challenge.js', './js/view-more.js', './js/cycle.js', './js/view-cycle.js', './js/icons.js', './js/view-meds.js', './js/view-study.js',
  './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// stale-while-revalidate: abre na hora pelo cache e busca a versão nova em segundo plano
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => cached);
    return cached || network;
  }));
});
