// Service worker : garde l'appli dans le téléphone pour qu'elle marche hors ligne.
// Change VERSION à chaque mise à jour de l'appli.
const VERSION = "vtcpro-v70";
// Tous les fichiers de l'appli : à compléter si un fichier est ajouté dans css/ ou js/
const FILES = [
  "./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png",
  "./css/app.css",
  "./js/erreurs.js", "./js/db.js", "./js/utils.js", "./js/calculs.js", "./js/accueil.js",
  "./js/reservations.js", "./js/pdf.js", "./js/ui.js", "./js/depenses.js",
  "./js/revenus.js", "./js/stats.js", "./js/compte.js", "./js/sheets.js",
  "./js/menu.js", "./js/reglages.js", "./js/objectifs.js", "./js/suivi.js", "./js/rappel.js", "./js/main.js"
];

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
  // Le site vitrine (dossier site/) ne passe pas par le cache de l'appli
  if (new URL(req.url).pathname.includes("/site/")) return;
  // La copie de secours (dossier legacy/) ne passe pas par le cache de l'appli
  if (new URL(req.url).pathname.includes("/legacy/")) return;
  // La page admin ne passe pas par le cache (sinon elle remplacerait l'appli hors ligne)
  if (/\/admin(\.html)?$/.test(new URL(req.url).pathname)) return;
  const isPage = req.mode === "navigate" || /\/(index\.html)?$/.test(new URL(req.url).pathname);
  const isCode = /\/(css|js)\/[^/]+\.(css|js)$/.test(new URL(req.url).pathname);
  e.respondWith(caches.open(VERSION).then(async cache => {
    const cached = await cache.match(req, { ignoreSearch: true }) || (isPage ? await cache.match("./index.html") : undefined);
    const fresh = fetch(req, { cache: "no-cache" }).then(res => { if (res && res.ok) cache.put(isPage ? "./index.html" : req, res.clone()); return res; });
    if (isPage || isCode) {
      // Page et code de l'appli : toujours la version en ligne si internet répond (4 s max), sinon la copie du téléphone
      // (le code suit la page : jamais une page récente avec un ancien fichier js ou css)
      const timeout = new Promise(r => setTimeout(() => r(null), 4000));
      const net = await Promise.race([fresh.catch(() => null), timeout]);
      return net || cached || fresh;
    }
    fresh.catch(() => {});
    return cached || fresh;
  }));
});

// Notification envoyée par le serveur (rappel du soir) : affichée même si l'appli est fermée
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) {}
  e.waitUntil(self.registration.showNotification(d.title || "VTC Rentable", {
    body: d.body || "", icon: "icon-192.png", badge: "icon-192.png", tag: d.tag || "rappel"
  }));
});
// Toucher une notification (rappel du soir, rappel d'entretien) ouvre l'appli
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(l => l.length ? l[0].focus() : self.clients.openWindow("./")));
});
