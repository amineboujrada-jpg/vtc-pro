// VTC Rentable — Base de données locale (IndexedDB) et file d'envoi
"use strict";

// ================= BASE DE DONNÉES (IndexedDB, dans le téléphone) =================
const APP_VERSION = "vtcpro-v69"; // numéro technique (cache) : même valeur que VERSION dans sw.js
// Version affichée : +0,01 à chaque mise à jour publiée (1.47 → 1.48 → 1.49…), notée dans le cahier des charges
const APP_LABEL = "1.64";
const APP_BUILD = "2026-11-12"; // date de la dernière mise à jour
const DB_NAME = "vtc-pro", DB_VER = 3; // base différente de l'appli VTC d'origine
const DATA_STORES = ["days", "depenses", "weeks", "settings", "resas"];
let idb = null;
function openDb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains("days")) d.createObjectStore("days", { keyPath: "date" });
      if (!d.objectStoreNames.contains("depenses")) d.createObjectStore("depenses", { keyPath: "id" });
      if (!d.objectStoreNames.contains("weeks")) d.createObjectStore("weeks", { keyPath: "id" });
      if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta", { keyPath: "k" });
      if (!d.objectStoreNames.contains("settings")) d.createObjectStore("settings", { keyPath: "id" }); // réglages de l'activité (plateformes, rattachement, assurance)
      if (!d.objectStoreNames.contains("resas")) d.createObjectStore("resas", { keyPath: "id" }); // réservations
      if (!d.objectStoreNames.contains("outbox")) d.createObjectStore("outbox", { keyPath: "key" }); // modifications à envoyer au serveur
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
const tx = (store, mode, fn) => new Promise((res, rej) => {
  const t = idb.transaction(store, mode); const s = t.objectStore(store); const out = fn(s);
  t.oncomplete = () => res(out && out.result !== undefined ? out.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
});
const getAll = store => tx(store, "readonly", s => s.getAll());
// Chaque modification : file d'envoi vers le serveur + Google Sheets (si relié)
const keyOf = (store, v) => String(store === "days" ? v.date : v.id);
const queue = (store, id, data, deleted) =>
  tx("outbox", "readwrite", s => s.put({ key: store + "/" + id, store, id: String(id), data: data || {}, deleted: !!deleted }))
    .then(() => cloud.schedule(1200)).catch(() => {});
const put = (store, v) => tx(store, "readwrite", s => s.put(v)).then(r => { if (store !== "meta") { markDirty(); queue(store, keyOf(store, v), v, false); } return r; });
const del = (store, k) => tx(store, "readwrite", s => s.delete(k)).then(r => { if (store !== "meta") { markDirty(); queue(store, k, null, true); } return r; });
async function replaceAll(data) {
  await new Promise((res, rej) => {
    const t = idb.transaction(["days", "depenses", "weeks", "settings", "resas"], "readwrite");
    ["days", "depenses", "weeks"].forEach(n => t.objectStore(n).clear());
    if (Array.isArray(data.resas)) { t.objectStore("resas").clear(); data.resas.forEach(v => t.objectStore("resas").put(v)); }
    (data.days || []).forEach(v => t.objectStore("days").put(v));
    (data.depenses || []).forEach(v => t.objectStore("depenses").put(v));
    (data.weeks || []).forEach(v => t.objectStore("weeks").put(v));
    if (Array.isArray(data.settings) && data.settings.length) { t.objectStore("settings").clear(); data.settings.forEach(v => t.objectStore("settings").put(v)); }
    t.oncomplete = res; t.onerror = () => rej(t.error);
  });
}

// État en mémoire (copie de la base)
const S = { days: new Map(), deps: [], weeks: new Map(), meta: {}, cfg: null, resas: [] };
async function loadAll() {
  const [days, deps, weeks, meta, settings, resas] = await Promise.all([getAll("days"), getAll("depenses"), getAll("weeks"), getAll("meta"), getAll("settings"), getAll("resas")]);
  S.resas = resas;
  S.cfg = mergeCfg(settings);
  S.days = new Map(days.map(d => [d.date, d]));
  S.deps = deps.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  S.weeks = new Map(weeks.map(w => [w.id, w]));
  S.meta = Object.fromEntries(meta.map(m => [m.k, m.v]));
}
