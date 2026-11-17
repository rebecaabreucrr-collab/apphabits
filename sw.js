// Service worker: sempre busca a versão mais nova quando há internet;
// sem internet, abre a cópia guardada no aparelho.
const CACHE = 'minharotina-v10';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/styles.css',
  './js/app.js', './js/utils.js', './js/store.js', './js/defaults.js', './js/logic.js', './js/ui.js', './js/forms.js',
  './js/view-today.js', './js/view-care.js', './js/view-reading.js', './js/view-challenge.js', './js/view-more.js',
  './js/cycle.js', './js/view-cycle.js', './js/icons.js', './js/view-meds.js', './js/view-study.js',
  './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// rede primeiro (sem cache do navegador); se falhar, usa a cópia local
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req, { cache: 'no-cache' });
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch {
      return (await cache.match(req, { ignoreSearch: true })) || (await cache.match('./index.html')) || Response.error();
    }
  })());
});
