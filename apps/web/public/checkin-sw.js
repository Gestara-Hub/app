/*
 * Service worker so da leitura de ingressos sem internet (doc product/29,
 * "Leitura sem internet", 12/11/2026). Registrado pelo "Preparar para usar sem
 * internet" no dia do evento. Guarda:
 *  - a tela do dia do evento (/events/sessions/...): rede primeiro, a copia
 *    guardada so quando a rede falha;
 *  - os arquivos do app (/_next/static/...) que o servidor marca como
 *    "immutable" (producao: o nome muda a cada versao, a copia guardada vale).
 *    Em desenvolvimento o servidor manda "no-cache" e o nome NAO muda com o
 *    codigo: guardar fazia o navegador usar JS e CSS velhos e a pagina
 *    recarregar sem parar (12/11/2026). Esses passam direto, sem guardar.
 * O resto do app passa direto, como sem service worker.
 */
const PAGES = "checkin-pages-v2";
const STATIC = "checkin-static-v2";
const KEEP = [PAGES, STATIC];

self.addEventListener("install", () => self.skipWaiting());
// Versao nova: apaga os caches antigos (o v1 guardava arquivos de desenvolvimento).
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("checkin-") && !KEEP.includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  ),
);

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
              const immutable = /immutable/i.test(response.headers.get("cache-control") || "");
              if (response.ok && immutable) cache.put(request, response.clone());
              return response;
            }),
        ),
      ),
    );
  }
});
