// Service worker de RESTAURARTE.
// Estrategia "red primero": con conexión siempre se carga la versión más reciente
// (los cambios que hagas se ven al recargar); sin conexión se usa la última copia guardada.
// La API (/api) y los archivos internos de Vite en desarrollo nunca pasan por aquí.

const CACHE = 'restaurarte-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function esCacheable(request, url) {
  if (request.method !== 'GET' || url.origin !== self.location.origin) return false;
  if (request.mode === 'navigate') return true;
  return url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/');
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (!esCacheable(event.request, url)) return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copia));
        }
        return res;
      })
      .catch(() =>
        caches.match(event.request).then((cacheada) => cacheada || caches.match('/')),
      ),
  );
});
