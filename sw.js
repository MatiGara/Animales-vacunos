/* Service worker: deja la app lista para abrir sin internet.
 * Cuando cambies index.html o logica.js, subí el número de VERSION para que los celulares bajen la nueva versión. */
const VERSION = 'terneros-2';
const ARCHIVOS = ['./', './index.html', './logica.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;   // Drive, inflación, etc. van directo a internet
  // primero la red (así siempre ves la última versión); si no hay señal, lo guardado
  e.respondWith(fetch(req).then(r => {
    if (r.ok){ const copia = r.clone(); caches.open(VERSION).then(c => c.put(req, copia)); }
    return r;
  }).catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
