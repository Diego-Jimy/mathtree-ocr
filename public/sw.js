// Cambia la version cuando necesites renovar los archivos guardados.
const CACHE = "mathtree-v3";

// Archivos basicos para abrir la aplicacion.
const FILES = [
  "/",
  "/manifest.webmanifest",
  "/icon.svg"
];

// Guarda los archivos principales al instalar la PWA.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FILES))
  );

  self.skipWaiting();
});

// Elimina versiones antiguas del cache.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

// Usa cache primero y consulta internet cuando el archivo no esta guardado.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});
