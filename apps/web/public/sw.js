/* NextIn service worker — app shell, page hors ligne, cache des ressources statiques, web push. */
const VERSION = "nextin-v3";
const STATIC_CACHE = `${VERSION}-static`;
const PAGES_CACHE = `${VERSION}-pages`;
const ADS_CACHE = `${VERSION}-ads`;
const ADS_MAX = 40;
// Navigations : au plus ce délai d'attente du réseau, puis dernière version en cache (ou page hors ligne). Le réseau
// continue en arrière-plan et met le cache à jour pour la prochaine ouverture (jamais d'écran blanc en 4G faible).
const NAVIGATION_TIMEOUT_MS = 3000;
const OFFLINE_URL = "/offline.html";
const PRECACHE = ["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:woff2?|png|svg|jpg|jpeg|webp|mp3)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Visuels publicitaires (M10b, stockage public) : cache d'abord, borné, pour les jeux et l'écran TV hors ligne.
  // Images seulement : les vidéos de la TV sont lues par plages (Range), laissées au navigateur.
  if (request.destination === "image" && url.pathname.includes("/storage/v1/object/public/ad-creatives/")) {
    event.respondWith(
      caches.open(ADS_CACHE).then((cache) =>
        cache.match(request).then(
          (cached) =>
            cached ||
            fetch(request).then((response) => {
              // Réponses CORS seulement : une réponse opaque occuperait un quota disproportionné.
              if (response.ok) {
                cache.put(request, response.clone()).then(() =>
                  cache.keys().then((keys) => Promise.all(keys.slice(0, Math.max(0, keys.length - ADS_MAX)).map((k) => cache.delete(k)))),
                );
              }
              return response;
            }),
        ),
      ),
    );
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  // Ressources immuables : cache d'abord.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Pages : réseau d'abord, mais au plus NAVIGATION_TIMEOUT_MS ; au-delà, dernière version en cache (si tous ses fichiers
  // /_next/static sont en cache), sinon page hors ligne. La réponse du réseau met le cache à jour en arrière-plan.
  if (request.mode === "navigate") {
    event.respondWith(navigate(event, request));
  }
});

/** Fichiers /_next/static référencés par une page (scripts, styles, préchargements). */
function staticAssets(html) {
  const found = new Set();
  for (const match of html.matchAll(/["'(](\/_next\/static\/[^"'()\s\\]+)/g)) found.add(match[1]);
  return [...found];
}

/** Page à mettre en cache : réponse complète de la même origine, sans redirection (Safari refuse une navigation servie
 * depuis une réponse redirigée : page blanche). */
function cacheable(response) {
  return response.ok && response.type === "basic" && !response.redirected && (response.headers.get("content-type") || "").includes("text/html");
}

/** Met la page en cache, puis ses fichiers statiques encore absents (pour pouvoir la resservir hors ligne). */
async function storePage(request, response) {
  const html = await response.clone().text();
  const pages = await caches.open(PAGES_CACHE);
  await pages.put(request, response);
  const statics = await caches.open(STATIC_CACHE);
  await Promise.all(
    staticAssets(html).map(async (path) => {
      if (await statics.match(path)) return;
      try {
        const asset = await fetch(path);
        if (asset.ok) await statics.put(path, asset);
      } catch {
        // Hors ligne entre-temps : la page ne sera pas resservie (vérification à la lecture).
      }
    }),
  );
}

/** Dernière version de la page, seulement si tous ses fichiers statiques sont en cache ; sinon null (page blanche évitée). */
async function cachedPage(request) {
  const cached = await caches.match(request, { cacheName: PAGES_CACHE });
  if (!cached) return null;
  const html = await cached.clone().text();
  const statics = await caches.open(STATIC_CACHE);
  const present = await Promise.all(staticAssets(html).map((path) => statics.match(path)));
  return present.every(Boolean) ? cached : null;
}

async function fallback(request) {
  return (await cachedPage(request)) || (await caches.match(OFFLINE_URL)) || Response.error();
}

function navigate(event, request) {
  const network = fetch(request).then((response) => {
    if (cacheable(response)) event.waitUntil(storePage(request, response.clone()).catch(() => {}));
    return response;
  });
  // Le réseau termine même si la page en cache est servie entre-temps (mise à jour pour la prochaine ouverture).
  event.waitUntil(network.catch(() => {}));
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(null), NAVIGATION_TIMEOUT_MS);
  });
  return Promise.race([network.catch(() => null), timeout]).then((response) => {
    clearTimeout(timer);
    return response || fallback(request);
  });
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "NextIn";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      tag: data.tag || "nextin",
      renotify: true,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      data: { url: data.url || "/" },
      vibrate: [200, 100, 200],
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === target && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
