/* Service worker: guarda la app para que funcione sin conexión.
 * Sube el número de versión cuando cambies algún archivo para que el móvil descargue la nueva. */
const CACHE = 'patrimonio-v17';
const ARCHIVOS = ['./', './index.html', './styles.css', './app.js', './ui.js', './extras.js', './mejoras.js', './cuenta.js', './config.js', './vendor/supabase.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './favicon-32.png'];

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
  if (new URL(event.request.url).origin !== self.location.origin) return; // Supabase, precios: siempre a la red
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const url = new URL(event.request.url);
        if (res.ok && url.origin === self.location.origin && !url.search && !url.pathname.endsWith('precios.json')) {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copia));
        }
        return res;
      })
      .catch(() => caches.match(event.request, {ignoreSearch: true}).then((r) => r || caches.match('./index.html')))
  );
});

/* Notificaciones: llegan aunque la app esté cerrada. */
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = {cuerpo: event.data && event.data.text()}; }
  event.waitUntil(self.registration.showNotification(d.titulo || 'PatriApp', {
    body: d.cuerpo || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.etiqueta || undefined, data: {url: d.url || './#panel'}
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || './#panel', self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then((ventanas) => {
    for (const v of ventanas) { if ('focus' in v) { v.navigate(url).catch(() => {}); return v.focus(); } }
    return self.clients.openWindow(url);
  }));
});
