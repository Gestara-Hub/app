/*
 * Service worker so da leitura de ingressos sem internet (doc product/29,
 * "Leitura sem internet", 12/11/2026). Registrado pelo "Preparar para usar sem
 * internet" no dia do evento. Guarda:
 *  - a tela do dia do evento (/events/sessions/...): rede primeiro, a copia
 *    guardada so quando a rede falha;
 *  - os arquivos do app (/_next/static/...): nunca mudam (o nome tem o hash),
 *    entao a copia guardada vale.
 * O resto do app passa direto, como sem service worker.
 */
const PAGES = "checkin-pages-v1";
const STATIC = "checkin-static-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate" && url.pathname.startsWith("/events/sessions/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(PAGES).then((cache) => cache.put(url.pathname, copy));
          }
          return response;
        })
        .catch(() => caches.open(PAGES).then((cache) => cache.match(url.pathname)).then((hit) => hit || Response.error())),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC).then((cache) =>
        cache.match(request).then(
          (hit) =>
            hit ||
            fetch(request).then((response) => {
              if (response.ok) cache.put(request, response.clone());
              return response;
            }),
        ),
      ),
    );
  }
});
