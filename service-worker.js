const CACHE_NAME = "operacion-mina-shell-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./captura.html",
  "./dashboard.html",
  "./style.css",
  "./dashboard.css",
  "./app.js",
  "./dashboard.js",
  "./catalogos.json",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  /*
    No cachear consultas a Google Apps Script.
    El dashboard debe recibir siempre información operativa actualizada.
  */
  if (
    url.hostname === "script.google.com" ||
    url.hostname === "script.googleusercontent.com"
  ) {
    event.respondWith(fetch(request));
    return;
  }

  /*
    Chart.js y otros recursos externos:
    primero red; si falla, usar caché si existe.
  */
  if (url.origin !== self.location.origin) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  /*
    Archivos propios:
    primero red para recibir cambios recientes.
    Si no hay conexión, usar la última copia en caché.
  */
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then(cached => {
          return cached || caches.match("./index.html");
        })
      )
  );
});
