// VTC Rentable — Capture des erreurs (chargé en premier, pour voir aussi les erreurs des autres fichiers)
"use strict";

// Les erreurs sont gardées ici puis envoyées au journal de l'admin par js/suivi.js, une fois le compte connecté.
const ERR_BUF = [];
const ERR_IGNORE = /failed to fetch|load failed|networkerror|network request failed|the internet connection appears|script error\.?$|resizeobserver loop|session expirée|non connecté/i;
function errNote(message, source, stack) {
  message = String(message || "").slice(0, 500);
  if (!message || ERR_IGNORE.test(message) || ERR_BUF.length >= 20) return;
  ERR_BUF.push({ message, source: String(source || "").slice(0, 300), stack: String(stack || "").slice(0, 2000), at: Date.now() });
  if (typeof suivi !== "undefined") suivi.flushSoon();
}
window.addEventListener("error", e => {
  if (!e || !e.message) return; // image ou fichier non chargé : pas une erreur de code
  const src = e.filename ? `${e.filename.replace(location.origin, "")}:${e.lineno}:${e.colno}` : "";
  errNote(e.message, src, e.error && e.error.stack);
});
window.addEventListener("unhandledrejection", e => {
  const r = e && e.reason;
  if (r && r.name === "AbortError") return;
  errNote(r && r.message ? r.message : String(r), "promesse", r && r.stack);
});
