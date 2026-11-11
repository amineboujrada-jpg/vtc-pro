// VTC Rentable — Réglages de l'activité, catégories de dépenses, calculs, entretien
"use strict";

// ================= CALCULS =================
// ---------- Réglages de l'activité (synchronisés entre appareils) ----------
// Plateformes du marché français proposées ; le chauffeur coche les siennes et peut en ajouter d'autres.
const PLAT_CATALOG = [
  { k: "uber", t: "Uber" }, { k: "bolt", t: "Bolt" }, { k: "heetch", t: "Heetch" }, { k: "freenow", t: "FreeNow" },
  { k: "lecab", t: "LeCab" }, { k: "allocab", t: "Allocab" }, { k: "marcel", t: "Marcel" }, { k: "caocao", t: "Caocao" }
];
const PLAT_FIXED = [{ k: "prive", t: "Course privée", tl: "Courses privées" }, { k: "pourboire", t: "Pourboire", tl: "Pourboires" }];
const WEEKS_PER_MONTH = 52 / 12; // assurance : prix mensuel × 12 ÷ 52 = prix par semaine
const defaultCfg = () => ({ id: "config", plats: { uber: true, bolt: true, heetch: true }, custom: [],
  rattach: { on: false, nom: "", montant: 0, depuis: iso(monday(new Date())) }, // nouveau compte : rien par défaut, l'accueil pose les questions
  assur: { on: false, mensuel: 0, depuis: iso(monday(new Date())) },
  vehicule: { type: "achat", loyer: 0, periode: "mois", assurInclus: true, cars: [], deduire: false, depuis: iso(monday(new Date())) },
  // statut : société (SASU, EURL…), auto-entrepreneur ou salarié via une société de rattachement
  statut: { type: "salarie", provision: 25, taux: 21.2, cfp: 0.1, acre: "non", acreFin: "", vl: false, depuis: iso(monday(new Date())) },
  cats: [], fixes: [], skip: [] });
const cfg = () => { const d = defaultCfg(), c = S.cfg || {};
  return { ...d, ...c, plats: { ...(c.plats || d.plats) }, custom: (c.custom || []).slice(), rattach: { ...d.rattach, ...(c.rattach || {}) },
    assur: { ...d.assur, ...(c.assur || {}) }, vehicule: { ...d.vehicule, ...(c.vehicule || {}), cars: ((c.vehicule || {}).cars || []).map(x => ({ ...x })) },
    statut: { ...d.statut, ...(c.statut || {}) }, cats: (c.cats || []).slice(), fixes: (c.fixes || []).map(f => ({ ...f })), skip: (c.skip || []).slice() }; };
const allPlats = () => PLAT_CATALOG.concat(cfg().custom);
const activePlats = () => { const c = cfg(); return allPlats().filter(p => c.plats[p.k]); };
const recKeys = () => allPlats().map(p => p.k).concat(PLAT_FIXED.map(p => p.k));
const platLabel = k => { const f = PLAT_FIXED.find(p => p.k === k); if (f) return f.tl; const p = allPlats().find(x => x.k === k); return p ? p.t : k; };
const platRows = plat => recKeys().filter(k => plat[k] > 0).map(k => [platLabel(k), plat[k], k]);
const ratName = () => cfg().rattach.nom.trim() || "Rattachement";
const ratOn = () => cfg().statut.type === "salarie" && cfg().rattach.on && cfg().rattach.montant > 0;
const VL_RATE = 1.7; // versement libératoire de l'impôt, prestations de services BIC (% du CA)
const ACRE_RED = { "50": 0.5, "25": 0.25 }; // ACRE : 50 % pour une création avant le 1er juillet 2026, 25 % depuis
const STATUTS = { societe: "Société (SASU, EURL…)", auto: "Auto-entrepreneur", salarie: "Salarié (rattachement)" };
const fixWeek = f => r2(f.periode === "semaine" ? f.montant : f.periode === "an" ? f.montant / 52 : f.montant / WEEKS_PER_MONTH);
const PER_LBL = { mois: "/ mois", semaine: "/ semaine", an: "/ an" };
// ---------- Catégories de dépenses : un groupe, puis un détail ----------
// Le carburant et les repas se saisissent dans l'onglet Jour mais sont enregistrés comme dépenses datées ; rattachement, assurance, location, cotisations et
// charges fixes sont ajoutés automatiquement chaque semaine (groupe « Charges de la semaine »).
const CAT_GROUPS = [
  { k: "voiture", t: "Voiture", ic: "🚗", cats: ["Carburant", "Entretien", "Panne / réparation", "Pneus", "Visite technique", "Lavage", "Équipement"] },
  { k: "route", t: "Sur la route", ic: "🛣️", cats: ["Repas", "Péage", "Parking", "Amende"] },
  { k: "pro", t: "Pro et administratif", ic: "🗂️", cats: ["Carte VTC / formation", "Comptable", "Téléphone / abonnements", "Frais bancaires", "Démarrage"] },
  { k: "autre", t: "Autre", ic: "📦", cats: ["Autre"] }
];
const GRP_SEMAINE = { k: "semaine", t: "Charges de la semaine", ic: "🔁" };
const AUTO_CATS = ["Rattachement", "Assurance", "Location voiture", "Cotisations URSSAF", "Impôt", "Provision impôts et charges"];
const STATUT_CATS = ["Cotisations URSSAF", "Impôt", "Provision impôts et charges"]; // charges du statut : une ligne à part dans les Stats
const CAT_LBL = { "Démarrage": "Frais de démarrage" }; // libellé affiché (la valeur enregistrée ne change pas)
const catLbl = c => CAT_LBL[c] || c;
const grpInfo = k => CAT_GROUPS.find(g => g.k === k) || (k === "semaine" ? GRP_SEMAINE : CAT_GROUPS[3]);
function catGrp(cat) {
  const c = cfg();
  if (AUTO_CATS.includes(cat) || c.fixes.some(f => f.nom === cat)) return "semaine";
  const g = CAT_GROUPS.find(g => g.cats.includes(cat)); if (g) return g.k;
  if (cat === "Péage / parking") return "route";
  return (c.catGrp && c.catGrp[cat]) || "autre";
}
// Détails proposés dans un groupe : ceux de l'appli + ceux ajoutés par le chauffeur
const grpCats = k => { const c = cfg(); return [...new Set((k === "semaine" ? [] : grpInfo(k).cats.filter(x => x !== "Autre"))
  .concat(c.cats.filter(x => catGrp(x) === k), k === "autre" ? ["Autre"] : []))]; };
// Charges de la semaine saisissables à la main : seulement celles qui ne sont pas déjà automatiques
const manualWeekCats = () => [cfg().statut.type === "salarie" && !ratOn() ? "Rattachement" : "", !assurWeek() && !assurInLoc() ? "Assurance" : "", enLocation() && !loyerWeek() ? "Location voiture" : ""].filter(Boolean);
const catList = extra => { const c = cfg();
  const l = CAT_GROUPS.flatMap(g => g.cats).concat(AUTO_CATS, c.cats, c.fixes.map(f => f.nom), ["Péage / parking"]);
  if (extra && !l.includes(extra)) l.push(extra);
  return [...new Set(l)]; };
// Reclasse une fois les dépenses d'avant les groupes (Péage / parking séparé, pneus et pannes sortis de l'entretien…)
function catV2(x) {
  const d = (x.desc || "").toLowerCase(); let cat = x.cat;
  if (cat === "Péage / parking") cat = /parking|stationnement/.test(d) ? "Parking" : "Péage";
  else if (cat === "Entretien") cat = /pneu/.test(d) && !/répar|repar|carrosserie/.test(d) ? "Pneus" : /mécani|mecani|répar|repar|panne|dépann|depann|carrosserie|garage/.test(d) ? "Panne / réparation" : /lavage|nettoyage/.test(d) ? "Lavage" : cat;
  else if (cat === "Autre") cat = /répar|repar|carrosserie|panne|dépann|depann|mécani|mecani/.test(d) ? "Panne / réparation" : /pneu/.test(d) ? "Pneus" : /lavage|nettoyage/.test(d) ? "Lavage"
    : /parking|stationnement/.test(d) ? "Parking" : /péage|peage/.test(d) ? "Péage" : /amende|\bpv\b/.test(d) ? "Amende" : cat;
  return cat;
}
async function migrateCats() {
  if (!S.cfg) return 0; let n = 0;
  for (const x of S.deps.slice()) {
    if (x.auto || x.grp) continue;
    const cat = catV2(x), rec = { ...x, cat, grp: catGrp(cat) };
    await put("depenses", rec);
    S.deps = S.deps.map(d => d.id === rec.id ? rec : d); n++;
  }
  return n;
}
const enLocation = () => cfg().vehicule.type === "location";
const assurInLoc = () => enLocation() && cfg().vehicule.assurInclus; // assurance comprise dans le loyer : pas de ligne à part
const assurWeek = () => { const a = cfg().assur; return !assurInLoc() && a.on && a.mensuel > 0 ? r2(a.mensuel / WEEKS_PER_MONTH) : 0; };
// Voitures achetées : coût étalé sur la durée d'utilisation = (prix − revente prévue) ÷ (années × 365 jours).
// Information affichée dans les détails, jamais ajoutée aux dépenses. Une nouvelle voiture prend le relais à sa date d'achat.
const carsSorted = () => cfg().vehicule.cars.filter(x => x.date && x.prix > 0 && x.ans > 0).sort((a, b) => a.date < b.date ? -1 : 1);
const carDaily = x => Math.max(0, x.prix - (x.revente || 0)) / (x.ans * 365.25);
const carEnd = x => { const d = fromIso(x.date); return iso(addDays(new Date(d.getFullYear() + Math.floor(x.ans), d.getMonth() + Math.round((x.ans % 1) * 12), d.getDate()), -1)); };
const carAt = dIso => { let cur = null; carsSorted().forEach(x => { if (x.date <= dIso) cur = x; }); return cur; };
function carCost(from, to) { // coût de la (des) voiture(s) entre deux dates incluses
  const list = carsSorted(); let total = 0;
  list.forEach((x, i) => {
    const next = list[i + 1], end = [carEnd(x), next ? iso(addDays(fromIso(next.date), -1)) : "9999-12-31", to].sort()[0];
    const a = x.date > from ? x.date : from;
    if (a <= end) total += carDaily(x) * (Math.round((fromIso(end) - fromIso(a)) / 864e5) + 1);
  });
  return total;
}
const hasCars = () => cfg().vehicule.type === "achat" && carsSorted().length > 0;
const loyerWeek = () => { const v = cfg().vehicule; return v.type === "location" && v.loyer > 0 ? r2(v.periode === "semaine" ? v.loyer : v.loyer / WEEKS_PER_MONTH) : 0; };
// Réglages importants rangés chacun dans leur propre enregistrement (comme les jours et les dépenses) :
// si les réglages généraux sont écrasés depuis un autre appareil, ces informations restent.
const PIECES = ["exploitRat", "exploitPro", "chauffeur", "entretien", "ct"];
const pieceStore = new Map(); // id → enregistrement { id: "p-…", v }
function mergeCfg(list) {
  pieceStore.clear(); list.filter(x => /^p-/.test(x.id)).forEach(x => pieceStore.set(x.id, x));
  const base = list.find(x => x.id === "config"); if (!base) return null;
  const c = JSON.parse(JSON.stringify(base));
  PIECES.forEach(k => { const p = pieceStore.get("p-" + k); if (p) c[k] = p.v; });
  const cars = pieceStore.get("p-cars"); if (cars) c.vehicule = { ...(c.vehicule || {}), cars: cars.v };
  return c;
}
async function putPiece(k, v) {
  const id = "p-" + k, cur = pieceStore.get(id);
  if (cur ? JSON.stringify(cur.v) === JSON.stringify(v) : v == null || (Array.isArray(v) && !v.length)) return;
  const doc = { id, v }; await put("settings", doc); pieceStore.set(id, doc);
}
async function saveCfg(c) {
  c.id = "config"; const base = JSON.parse(JSON.stringify(c));
  for (const k of PIECES) if (k in base) { await putPiece(k, base[k]); delete base[k]; }
  if (base.vehicule && Array.isArray(base.vehicule.cars)) { await putPiece("cars", base.vehicule.cars); delete base.vehicule.cars; }
  await put("settings", base); S.cfg = c;
}

// ---------- Entretien : rappel tous les X km à partir du dernier entretien ----------
const ENT_ALERTE = 1000; // l'alerte apparaît à 1 000 km de l'entretien
const ENT_DEF = { intervalle: 15000, lastKm: 0, lastDate: "", notif: false, hist: [] };
const entCfg = () => { const e = cfg().entretien || {}; return { ...ENT_DEF, ...e, hist: (e.hist || []).slice() }; };
// compteur d'un jour : compteur fin, sinon compteur début + km déjà saisis
const odoOf = d => !d ? null : typeof d.kmEnd === "number" ? d.kmEnd : typeof d.kmStart === "number" ? d.kmStart + v(d, "km") : null;
function odoNow(from, base) { // dernier compteur connu (depuis la date « from »), puis on ajoute les km saisis sans compteur
  let b = base ? { ...base } : null;
  [...S.days.keys()].sort().forEach(date => { if (from && date < from) return; const k = odoOf(S.days.get(date)); if (k != null && (!b || k >= b.km)) b = { date, km: k }; });
  if (!b) return null;
  let km = b.km; S.days.forEach((d, date) => { if (date > b.date && odoOf(d) == null) km += v(d, "km"); });
  return Math.round(km);
}
function entState() {
  const e = entCfg(); if (!(e.intervalle > 0) || !e.lastDate) return null;
  const cur = odoNow(e.lastDate, { date: e.lastDate, km: e.lastKm }), fait = Math.max(0, cur - e.lastKm), reste = e.intervalle - fait;
  // rythme : km des 28 derniers jours
  const t = todayIso(), a = iso(addDays(fromIso(t), -27)); let km28 = 0;
  S.days.forEach((d, date) => { if (date >= a && date <= t) km28 += v(d, "km"); });
  const parJour = km28 / 28, jours = reste > 0 && parJour > 0 ? Math.ceil(reste / parJour) : null;
  return { e, cur, fait, reste, next: e.lastKm + e.intervalle, pct: Math.min(100, Math.round(fait / e.intervalle * 100)),
    jours, quand: jours != null ? addDays(fromIso(t), jours) : null, level: reste <= 0 ? "over" : reste <= ENT_ALERTE ? "soon" : "ok" };
}
const kmTxt = n => Math.round(n).toLocaleString("fr-FR") + " km";
function entLine(st) {
  if (st.level === "over") return { t: `Entretien dépassé de ${kmTxt(-st.reste)}`, s: `Prévu à ${kmTxt(st.next)} · compteur ≈ ${kmTxt(st.cur)}` };
  return { t: `Entretien dans ${kmTxt(st.reste)}`, s: `À ${kmTxt(st.next)}${st.quand ? ` · vers le ${pad(st.quand.getDate())}/${pad(st.quand.getMonth() + 1)} (≈ ${st.jours} jour${st.jours > 1 ? "s" : ""})` : ""}` };
}
// ---------- Visite technique : une fois par an, alerte 30 jours avant l'anniversaire ----------
const CT_ALERTE_J = 30;
const ctCfg = () => { const c = cfg().ct || {}; return { lastDate: c.lastDate || "", hist: (c.hist || []).map(h => ({ ...h })) }; };
const dFr = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
function ctState() {
  const c = ctCfg(); if (!c.lastDate) return null;
  const d = fromIso(c.lastDate), next = new Date(d.getFullYear() + 1, d.getMonth(), d.getDate());
  const jours = Math.round((next - fromIso(todayIso())) / 864e5);
  return { c, next, jours, level: jours < 0 ? "over" : jours <= CT_ALERTE_J ? "soon" : "ok" };
}
const jTxt = n => `${n} jour${n > 1 ? "s" : ""}`;
function ctLine(st) {
  if (st.level === "over") return { t: `Visite technique dépassée de ${jTxt(-st.jours)}`, s: `Elle était à faire le ${dFr(st.next)}` };
  return { t: st.jours === 0 ? "Visite technique aujourd'hui" : `Visite technique dans ${jTxt(st.jours)}`, s: `À faire avant le ${dFr(st.next)}` };
}
// Alertes du véhicule (entretien, visite technique) : affichées à l'approche ou une fois dépassées
function vehAlerts() {
  const out = [], e = entState(), c = ctState();
  if (e && e.level !== "ok") { const l = entLine(e); out.push({ k: "ent", level: e.level, key: e.e.lastDate + "|" + e.e.lastKm + "|" + e.level, pill: e.level === "over" ? l.t : "Entretien dans " + kmTxt(e.reste), t: l.t, s: l.s }); }
  if (c && c.level !== "ok") { const l = ctLine(c); out.push({ k: "ct", level: c.level, key: c.c.lastDate + "|" + c.level, pill: l.t, t: l.t, s: l.s }); }
  return out;
}
function renderEnt() {
  const box = $("ent"), al = vehAlerts(), over = al.some(a => a.level === "over");
  $("menuBtn").classList.toggle("due", al.length > 0 || virAFaire() > 0); $("menuBtn").classList.toggle("alert", over);
  if (!box) return;
  box.innerHTML = al.map(a => `<button class="entpill ${a.level}" data-veh-alert title="${esc(a.s)}">${icon(a.k === "ct" ? "check" : "tool")}${esc(a.pill)}</button>`).join(" ");
  box.querySelectorAll("[data-veh-alert]").forEach(b => (b.onclick = () => openVehicule()));
}
// Chaque alerte n'est montrée qu'une fois par étape (bientôt / dépassé)
async function entNotify() {
  for (const a of vehAlerts()) {
    const mk = a.k === "ct" ? "ctVu" : "entVu";
    if (S.meta[mk] === a.key) continue;
    await setMeta(mk, a.key);
    toast((a.k === "ct" ? "📋 " : "🔧 ") + a.t, a.level === "over");
    if (entCfg().notif && "Notification" in window && Notification.permission === "granted") {
      const opt = { body: a.s, icon: "icon-192.png", badge: "icon-192.png", tag: a.k };
      try { const r = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); if (r) await r.showNotification(a.t, opt); else new Notification(a.t, opt); } catch (_) {}
    }
  }
}
// « J'ai fait la visite technique » : date + prix → dépense, nouvelle échéance dans un an, historique gardé
function openCtDone() {
  openSheet(`<button class="backlink" id="ctBack" type="button">‹ Véhicule</button>
      <h3>Visite technique faite</h3>
      <div class="cur">La prochaine sera rappelée un an après cette date. Le prix est ajouté à tes dépenses (catégorie Visite technique).</div>
      <label class="fl" for="ctDate">Date de la visite</label>
      <input id="ctDate" class="small" type="date" value="${todayIso()}">
      <label class="fl" for="ctPrix">Prix (€)</label>
      <input id="ctPrix" type="text" inputmode="decimal" autocomplete="off" placeholder="ex. 80">
      <button class="btn primary" id="ctOk" style="width:100%;margin-top:14px">Valider</button>`, "ctPrix");
  $("ctBack").onclick = openVehicule;
  $("ctOk").onclick = async () => {
    const date = $("ctDate").value, raw = $("ctPrix").value.trim(), prix = parse(raw);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { toast("Choisis la date de la visite", true); return; }
    if (date > todayIso()) { toast("La date ne peut pas être dans le futur", true); return; }
    if (raw && !(prix > 0)) { toast("Prix invalide", true); return; }
    try {
      let depId = "";
      if (prix > 0) {
        const rec = { id: "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), date, cat: "Visite technique", desc: "Visite technique", montant: r2(prix) };
        await put("depenses", rec); depId = rec.id;
        S.deps = S.deps.concat(rec).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
      }
      const n = cfg(), c = ctCfg();
      const hist = c.hist.filter(h => h.date !== date).concat({ date, prix: prix > 0 ? r2(prix) : 0, dep: depId }).sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 20);
      n.ct = { lastDate: hist[0].date, hist };
      await saveCfg(n); renderAll(); openVehicule(); toast("Visite technique enregistrée");
    } catch (_) { toast("Enregistrement impossible", true); }
  };
}
