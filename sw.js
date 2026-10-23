// Service worker : garde l'appli dans le téléphone pour qu'elle marche hors ligne.
// Change VERSION à chaque mise à jour de l'appli.
const VERSION = "vtcpro-v4";
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", e => {
  // cache: "reload" = toujours prendre la version en ligne, jamais une ancienne copie du téléphone
  e.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    // seulement nos anciens caches : l'appli VTC d'origine partage le même domaine
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("vtcpro-") && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  // Les appels au serveur (Supabase, Google) ne passent jamais par le cache
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(VERSION).then(async cache => {
      const cached = await cache.match(req, { ignoreSearch: true }) ||
        (req.mode === "navigate" ? await cache.match("./index.html") : undefined);
      const fresh = fetch(req, { cache: "no-cache" }).then(res => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});
