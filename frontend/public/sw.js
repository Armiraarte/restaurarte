// Service worker de RESTAURARTE.
// Estrategia "red primero": con conexión siempre se carga la versión más reciente
// (los cambios que hagas se ven al recargar); sin conexión se usa la última copia guardada.
// La API (/api) y los archivos internos de Vite en desarrollo nunca pasan por aquí.

const CACHE = 'restaurarte-v1';
// Cada build nuevo agrega archivos /assets/ con otro nombre (hash) y los viejos ya no se usan.
// Al pasar este límite se borran los más antiguos para que el caché no crezca sin fin.
const MAX_ENTRADAS = 80;

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
  // /images/: el logo del inicio de sesión también debe verse sin conexión.
  return ['/assets/', '/icons/', '/images/'].some((ruta) => url.pathname.startsWith(ruta));
}

async function guardar(request, res) {
  const cache = await caches.open(CACHE);
  await cache.put(request, res);
  const claves = await cache.keys(); // en el orden en que se guardaron: primero las más viejas
  const sobrantes = claves.slice(0, Math.max(0, claves.length - MAX_ENTRADAS));
  await Promise.all(sobrantes.map((clave) => cache.delete(clave)));
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (!esCacheable(event.request, url)) return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) event.waitUntil(guardar(event.request, res.clone()).catch(() => {}));
        return res;
      })
      .catch(() =>
        caches.match(event.request).then((cacheada) => cacheada || caches.match('/')),
      ),
  );
});
