/* Service worker: guarda la app para que funcione sin conexión.
 * Sube el número de versión cuando cambies algún archivo para que el móvil descargue la nueva. */
const CACHE = 'patrimonio-v1';
const ARCHIVOS = ['./', './index.html', './styles.css', './app.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('patrimonio-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Red primero (para recibir actualizaciones) y, sin conexión, la copia guardada. */
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok && new URL(event.request.url).origin === self.location.origin) {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copia));
        }
        return res;
      })
      .catch(() => caches.match(event.request, {ignoreSearch: true}).then((r) => r || caches.match('./index.html')))
  );
});
