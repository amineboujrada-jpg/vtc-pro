// VTC Rentable — Synchronisation Google Sheets, sauvegarde et restauration
"use strict";

// ================= SYNCHRONISATION AVEC GOOGLE SHEETS =================
// L'appli envoie toutes ses données au petit script Google installé dans le fichier VTC,
// qui met à jour les onglets Journal, Dépenses et Virements.
const snapshot = () => ({ app: "vtc", version: 1, exportedAt: new Date().toISOString(), days: [...S.days.values()], depenses: S.deps, weeks: [...S.weeks.values()], settings: S.cfg ? [S.cfg] : [], resas: S.resas });
// Version envoyée au Google Sheets : seulement les jours avec au moins un chiffre,
// et seulement les semaines terminées qui ont un chiffre d'affaires
const dayHasFigures = d => allFields().some(f => v(d, f.k) > 0);
function splitForSheet(deps) {
  const out = [];
  deps.forEach(x => {
    if (!isWeeklyDep(x)) { out.push(x); return; }
    const mon = monday(fromIso(x.date)), sun = addDays(mon, 6);
    if (mon.getMonth() === sun.getMonth()) { out.push(x); return; }
    const endA = iso(new Date(mon.getFullYear(), mon.getMonth() + 1, 0)), startB = iso(new Date(sun.getFullYear(), sun.getMonth(), 1));
    const a = r2(depShare(x, iso(mon), endA)), b = r2(x.montant - a);
    if (a) out.push({ ...x, id: x.id + "-a", date: iso(mon), desc: (x.desc || x.cat) + " (" + Math.round(a / x.montant * 7) + "/7)", montant: a });
    if (b) out.push({ ...x, id: x.id + "-b", date: startB, desc: (x.desc || x.cat) + " (" + Math.round(b / x.montant * 7) + "/7)", montant: b });
  });
  return out;
}
// Carburant et repas : envoyés dans le Journal (colonnes Carburant, Repas), pas en double dans Dépenses
const sheetDays = () => { const m = new Map([...S.days.values()].map(d => [d.date, { ...d }]));
  S.deps.forEach(x => { const k = x.cat === "Carburant" ? "carburant" : x.cat === "Repas" ? "repas" : null; if (!k) return;
    const d = m.get(x.date) || { date: x.date }; d[k] = r2(v(d, k) + x.montant); m.set(x.date, d); });
  return [...m.values()].sort((a, b) => a.date < b.date ? -1 : 1); };
const sheetSnapshot = () => Object.assign(snapshot(), {
  depenses: splitForSheet(S.deps.filter(x => !DAY_DEP_CATS.includes(x.cat))),
  days: sheetDays().filter(dayHasFigures),
  weeks: [...S.weeks.values()].filter(w => weekEnded(w) && weekCalc(w).ca > 0)
});
const hhmm = t => { const d = new Date(t); const same = iso(d) === todayIso();
  return (same ? "" : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) + " ") + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }); };
const sync = { busy: false, ok: () => /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(S.meta.sheetUrl || "") };
async function setMeta(k, v) { S.meta[k] = v; await tx("meta", "readwrite", s => (v === undefined ? s.delete(k) : s.put({ k, v }))); }
function markDirty() {
  S.meta.unsynced = true; sync.seq = (sync.seq || 0) + 1;
  tx("meta", "readwrite", s => s.put({ k: "unsynced", v: true })).catch(() => {});
  updateStatus(); renderSyncBtn(); scheduleSync(5000);
}
// Synchro automatique : quelques secondes après chaque saisie, au retour du réseau et à l'ouverture
function scheduleSync(ms) {
  if (!sync.ok() || !navigator.onLine) return;
  clearTimeout(sync.timer); sync.timer = setTimeout(() => syncSheet(true), ms);
}
function renderSyncBtn() {
  const b = $("syncBtn"); if (!b) return;
  b.hidden = !sync.ok();
  b.classList.toggle("due", !!S.meta.unsynced);
  b.classList.toggle("spin", sync.busy);
  b.setAttribute("aria-label", S.meta.unsynced ? "Synchroniser Google Sheets (modifications en attente)" : "Synchroniser Google Sheets");
}
function updateStatus() {
  const st = $("status"); if (!st) return;
  if (cloud.session) { st.textContent = cloud.statusText(); return; }
  if (!sync.ok()) { st.textContent = (navigator.onLine ? "En ligne" : "Hors ligne") + " · données sur ce téléphone"; return; }
  if (sync.busy) st.textContent = "Synchronisation…";
  else if (S.meta.unsynced) st.textContent = !navigator.onLine ? "Hors ligne · envoi au retour du réseau" : sync.err ? "Synchro échouée · touche ⟳" : "Envoi au Google Sheets…";
  else st.textContent = S.meta.lastSync ? "Google Sheets à jour · " + hhmm(S.meta.lastSync) : "Google Sheets relié";
}
async function syncSheet(silent) {
  if (silent !== true) silent = false;
  if (!sync.ok()) { if (!silent) openSettings("sheets"); return; }
  if (sync.busy) { sync.again = true; return; }
  if (!navigator.onLine) { if (!silent) toast("Pas de réseau : l'envoi partira dès que tu as internet", true); updateStatus(); return; }
  // Sécurité : l'envoi réécrit tout le Journal du fichier. Appli vide = on n'envoie jamais (sinon le fichier serait effacé).
  if (!sheetDays().some(dayHasFigures)) { if (!silent) toast("Rien à envoyer : restaure d'abord tes données (⚙︎ → Restaurer un fichier)", true); return; }
  clearTimeout(sync.timer);
  sync.busy = true; sync.again = false; updateStatus(); renderSyncBtn();
  const seqAtStart = sync.seq || 0;
  try {
    const r = await fetch(S.meta.sheetUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(sheetSnapshot()), cache: "no-store" });
    let j = null; try { j = await r.json(); } catch (_) {}
    if (!r.ok || !j) throw new Error("Le script Google n'a pas répondu correctement. Vérifie le lien et l'accès « Tout le monde ».");
    if (!j.ok) throw new Error(j.error || "Erreur du script Google");
    sync.err = null;
    if ((sync.seq || 0) === seqAtStart) await setMeta("unsynced", false); // rien n'a changé pendant l'envoi
    else sync.again = true;
    await setMeta("lastSync", Date.now());
    if (!silent) toast(`Google Sheets à jour · ${j.days} jours, ${j.depenses} dépenses`);
  } catch (e) {
    sync.err = true;
    const msg = e && e.message && !/fetch|network|load/i.test(e.message) ? e.message : "Synchronisation impossible : vérifie internet et le lien du script";
    if (!silent) toast(msg, true);
  } finally {
    sync.busy = false; updateStatus(); renderSyncBtn();
    if (sync.again && !sync.err) scheduleSync(1500);
  }
}
// En quittant l'appli : dernier envoi si des saisies ne sont pas encore parties
function flushSync() {
  if (!sync.ok() || !S.meta.unsynced || !navigator.onLine || sync.busy || !sheetDays().some(dayHasFigures)) return;
  clearTimeout(sync.timer);
  try {
    fetch(S.meta.sheetUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(sheetSnapshot()), keepalive: true }).catch(() => {});
  } catch (_) {}
}

// ---------- Sauvegarde / restauration ----------
function lastBackupText() {
  const t = S.meta.lastBackup; if (!t) return "Aucun fichier de sauvegarde créé.";
  return `Dernier fichier de sauvegarde : ${hhmm(t)}.`;
}
// Réglages : un menu, puis une page par thème
const SET_PAGES = [
  { id: "virements", g: "vtc", t: "Revenus hebdomadaires", ic: "bank", sub: () => "" },
  { id: "societe", g: "vtc", get t() { return exTitle(); }, ic: "building", sub: () => "" },
  { id: "activite", g: "vtc", t: "Mes plateformes", ic: "grid", sub: () => activePlats().map(p => p.t).join(", ") || "Aucune plateforme" },
  { id: "vehicule", g: "vtc", t: "Véhicule", ic: "car", sub: () => { const st = entState();
    return (enLocation() ? "En location" : "Achetée") + (assurWeek() ? " · assurance " + eur(cfg().assur.mensuel) + "/mois" : "") +
      (st ? ` · <span class="pill ${st.level === "over" ? "bad" : st.level === "soon" ? "wait" : "ok"}" style="float:none;margin:0 0 0 2px">${st.level === "over" ? "Entretien dépassé de " + kmTxt(-st.reste) : "Entretien dans " + kmTxt(st.reste)}</span>` : " · entretien à régler") +
      (() => { const c = ctState(); return c ? ` <span class="pill ${c.level === "over" ? "bad" : c.level === "soon" ? "wait" : "ok"}" style="float:none;margin:4px 0 0 2px">${c.level === "over" ? "Visite technique dépassée" : "Visite technique le " + dFr(c.next)}</span>` : " · visite technique à régler"; })(); } },
  { id: "statut", g: "vtc", t: "Statut et société", ic: "doc", sub: () => { const st = cfg().statut; return STATUTS[st.type] + (st.type === "auto" ? (st.acre !== "non" ? " · ACRE −" + st.acre + " %" : "") + (st.vl ? " · versement libératoire" : "") : st.type === "societe" ? " · provision " + numTxt(st.provision) + " %" : ratOn() ? " · " + esc(ratName()) + " " + eur(cfg().rattach.montant) + "/sem." : ""); } },
  { id: "depenses", g: "vtc", t: "Mes dépenses", ic: "receipt", sub: () => { const c = cfg(), f = c.fixes.length, k = c.cats.length;
    return f || k ? [f ? `${f} charge${f > 1 ? "s" : ""} fixe${f > 1 ? "s" : ""}` : "", k ? `${k} catégorie${k > 1 ? "s" : ""} perso` : ""].filter(Boolean).join(" · ") : "Charges fixes et catégories perso"; } },
  { id: "sauvegarde", g: "data", t: "Sauvegarde", ic: "save", sub: () => lastBackupText().replace(/\.$/, "") },
  { id: "sheets", g: "data", t: "Google Sheets", ic: "sheet", sub: () => sync.ok() ? "Relié" : "Facultatif" },
  { id: "compte", g: "app", t: "Compte", ic: "user", sub: () => cloud.session ? esc(cloud.session.user.email || "Connecté") : "Non connecté" },
  { id: "apparence", g: "app", t: "Apparence", ic: "moon", sub: () => ({ auto: "Automatique", light: "Clair", dark: "Sombre", night: "Sombre le soir" }[theme.get()]) },
  { id: "appli", g: "app", t: "Application", ic: "info", sub: () => "Version " + APP_LABEL + " · mentions légales" }
];
const SET_GROUPS = [["app", "L'application"]];
const ICONS = {
  car: '<path d="M5 17H3.5v-4l2-5h10l3.5 5h1.5v4H19"/><path d="M9 17h6M6 13h13"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
  doc: '<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z"/><path d="M14 3.5V8h4M9.5 12h5M9.5 15.5h5"/>',
  receipt: '<path d="M6 3.5h12v17l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5z"/><path d="M9 8.5h6M9 12h6M9 15.5h3"/>',
  user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>',
  moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
  save: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M5 19.5h14"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  check: '<rect x="4.5" y="4" width="15" height="17" rx="2"/><path d="M9 4V2.8h6V4M8.5 13l2.5 2.5 4.5-5"/>',
  sheet: '<rect x="4.5" y="3.5" width="15" height="17" rx="2"/><path d="M4.5 9h15M4.5 14.5h15M10 9v11.5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
  bank: '<path d="M3.5 9.5 12 4.5l8.5 5M5 10v7M9.7 10v7M14.3 10v7M19 10v7M3.5 19.5h17"/>',
  building: '<path d="M5 20.5V5a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 15 5v15.5M15 9.5h3.5A1.5 1.5 0 0 1 20 11v9.5M3.5 20.5h17M8.5 7.5h3M8.5 11h3M8.5 14.5h3"/>',
  tool: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.2"/>'
};
const icon = k => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>`;
function openSettings(page) {
  if (page === "activite") return openActivite();
  if (page === "virements") { closeSheet(); return showTab("vir"); }
  if (page === "societe") return openSociete();
  if (page === "statut") return openStatut();
  if (page === "depenses") return openDepCfg();
  if (page === "vehicule" || page === "entretien") return openVehicule();
  if (page) return openSettingsPage(page);
  openSheet(`<button class="backlink" id="setBack" data-to="menu" type="button">‹ Menu</button>
      <h3>Réglages</h3>
      ${SET_GROUPS.map(([g, lbl]) => `<div class="setgrp">${lbl}</div>
      <div class="setmenu">${SET_PAGES.filter(pg => pg.g === g).map(pg => `<button class="setlink" data-page="${pg.id}"><span class="sic ic-${pg.ic}">${icon(pg.ic)}</span><span class="stx"><b>${pg.t}</b><small>${pg.sub()}</small></span><span class="chev" aria-hidden="true">›</span></button>`).join("")}</div>`).join("")}`);
  $("sheet").querySelectorAll("[data-page]").forEach(b => (b.onclick = () => openSettings(b.dataset.page)));
  bindBack();
}
const backBtn = (to = "menu") => `<button class="backlink" id="setBack" data-to="${to}" type="button">‹ ${to === "menu" ? "Menu" : "Réglages"}</button>`;
const bindBack = () => { const b = $("setBack"); b.onclick = () => b.dataset.to === "menu" ? (closeSheet(), openMenu()) : openSettings(); };
