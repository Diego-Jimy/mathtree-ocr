// Cambia esta version en cada actualizacion importante.
const CACHE = "mathtree-v5";

self.addEventListener("install", () => {
  // Activa inmediatamente el nuevo Service Worker.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      // Elimina automaticamente todos los caches antiguos.
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      // Permite controlar inmediatamente las pestañas abiertas.
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // Consulta primero la version publicada.
  // Solo usa cache si el dispositivo no tiene conexion.
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});