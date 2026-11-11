// VTC Rentable — Génération de PDF et coordonnées de la société
"use strict";

// ---------- PDF sans bibliothèque (police Helvetica, encodage WinAnsi) ----------
const WIN = { "€": 128, "‚": 130, "„": 132, "…": 133, "‘": 145, "’": 146, "“": 147, "”": 148, "•": 149, "–": 150, "—": 151, "œ": 156, "Œ": 140, " ": 32, " ": 32 };
const pdfStr = t => { let o = ""; for (const ch of String(t)) { const c = ch.codePointAt(0); const b = WIN[ch] != null ? WIN[ch] : c < 256 && !(c >= 128 && c < 160) ? c : 63; o += b === 40 || b === 41 || b === 92 ? "\\" + String.fromCharCode(b) : String.fromCharCode(b); } return o; };
function wrapTxt(t, size, maxW) { // largeur moyenne Helvetica ≈ 0,5 × taille
  const max = Math.max(10, Math.floor(maxW / (size * 0.5))), out = []; let line = "";
  String(t || "").split(/\s+/).forEach(w => { if ((line + " " + w).trim().length > max && line) { out.push(line); line = w; } else line = (line + " " + w).trim(); });
  if (line) out.push(line); return out.length ? out : [""];
}
function buildPdf(content) {
  const objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`];
  let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"; const off = [];
  objs.forEach((o, i) => { off.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + off.map(n => String(n).padStart(10, "0") + " 00000 n \n").join("") + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  const bytes = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
  return new Blob([bytes], { type: "application/pdf" });
}
async function resaPdf(r) {
  const miss = socMissing();
  if (miss.length) { toast("Complète Statut et société : " + miss.join(", "), true); setTimeout(() => openSociete(r), 300); return; }
  const s = socCfg(); let c = "", y = 800;
  const T = (x, yy, t, size = 10, bold = false, gray = false) => { c += `BT ${gray ? "0.42 0.45 0.5 rg" : "0.08 0.09 0.13 rg"} /${bold ? "F2" : "F1"} ${size} Tf ${x} ${yy} Td (${pdfStr(t)}) Tj ET\n`; };
  const D = (yy, x0 = 215) => { c += `0.8 0.81 0.85 RG 0.6 w [2 2] 0 d ${x0} ${yy} m 539 ${yy} l S [] 0 d\n`; };
  let top = 0;
  const open = t => { y -= 18; top = y + 12; T(60, y - 4, t, 12.5, true); y -= 14; c += `0.8 0.81 0.85 RG 0.8 w 56 ${y} m 539 ${y} l S\n`; y -= 18; };
  const close = () => { y += 4; c += `0.75 0.76 0.8 RG 1 w 50 ${y} 495 ${top - y} re S\n`; y -= 8; };
  const kv = (k, v) => { if (!v) return; const lines = wrapTxt(v, 10.5, 320); T(66, y, k, 10, true); lines.forEach((ln, i) => T(220, y - i * 14, ln, 10.5)); y -= 14 * lines.length - 10; D(y + 4); y -= 14; };
  const line = v => { if (!v) return; wrapTxt(v, 10.5, 470).forEach(ln => { T(66, y, ln, 10.5); y -= 14; }); y += 10; D(y + 4, 62); y -= 14; };
  T(50, y, "Bon de commande", 20, true); T(400, y, "N° " + resaNum(r), 10, true, true); y -= 6;
  open("Service de voiture de transport avec chauffeur");
  T(66, y, "Justification de la réservation préalable", 10, true); y -= 16; line("Article R3120-2 du Code des transports - Arrêté du 6 août 2025"); close();
  open("Exploitant de véhicules de transport avec chauffeur");
  line(s.nom); line(s.adresse); line(s.registre); line(s.tel); line(s.email); if (s.siren) line("SIREN / SIRET : " + s.siren); close();
  open("Voyage");
  kv("Conducteur", s.chauffeur); kv("Passager", r.nom || "Non communiqué"); kv("Téléphone passager", telFmt(r.tel));
  kv("Commande", dtFr(r.createdAt).replace(" à ", " ")); kv("Prise en charge", `${dateFr(r.date)} ${r.heure}`);
  kv("Lieu de prise en charge", r.depart); kv("Destination", r.arrivee); kv("Passagers", String(r.pax || 1));
  if (r.prix) kv("Prix convenu", eur(r.prix) + " (TVA incluse si applicable)");
  kv("Via", "Réservation directe (" + (r.canal || "téléphone").toLowerCase() + ")");
  if (r.updatedAt) kv("Modifiée le", dtFr(r.updatedAt).replace(" à ", " ")); kv("Note", r.note); close();
  open("Chauffeur");
  kv("Nom", s.chauffeur); kv("Plaque", s.immat); if (s.carte) kv("Carte professionnelle", s.carte); close();
  T(50, 40, `Document édité le ${dtFr(new Date().toISOString())} avec VTC Rentable.`, 8.5, false, true);
  const blob = buildPdf(c), name = `bon-de-commande-${resaNum(r)}.pdf`;
  if (window.__pdfTest) { window.__pdfTest(blob); return; }
  try {
    const file = new File([blob], name, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
  } catch (e) { if (e && e.name === "AbortError") return; }
  const url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = name; a.target = "_blank"; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ---------- Ma société (coordonnées du justificatif) ----------
// Les informations de l'exploitant sont maintenant dans « Statut et société » (page fusionnée)
function openSociete(back) { return openStatut(back); }
// Semaines terminées dont les montants ne sont pas encore saisis (rappel dans le menu)
const virAFaire = () => weekList().filter(w => weekEnded(w) && !(weekCalc(w).ca > 0)).length; // la semaine en cours n'est pas « à remplir »

const CH_FIELDS = [
  { k: "carburant", t: "Carburant", g: "ch", charge: true, chips: [20, 30, 40, 50] },
  { k: "repas", t: "Repas / café", g: "ch", charge: true, chips: [2, 5, 10, 15] },
  { k: "heures", t: "Heures", g: "ch", unit: "h" }, { k: "km", t: "Km", g: "ch", unit: "km" }
];
const recField = p => ({ k: p.k, t: p.t, g: "rec" });
const allFields = () => allPlats().map(recField).concat(PLAT_FIXED.map(recField), CH_FIELDS);
const CATS = ["Rattachement", "Assurance", "Location voiture", "Entretien", "Visite technique", "Amende", "Péage / parking", "Équipement", "Autre", "Démarrage"];
const v = (o, k) => (o && typeof o[k] === "number" ? o[k] : 0);
const recettes = d => recKeys().reduce((a, k) => a + v(d, k), 0);
const dayCharges = d => v(d, "carburant") + v(d, "repas"); // ancien format (avant conversion en dépenses)
// Carburant et repas : saisis dans l'onglet Jour, enregistrés comme dépenses (un plein n'est pas la consommation du jour)
const DAY_DEP = { carburant: { cat: "Carburant", pre: "carb-" }, repas: { cat: "Repas", pre: "repas-" } };
const DAY_DEP_CATS = ["Carburant", "Repas"];
const depOn = (date, cat) => S.deps.reduce((a, x) => a + (x.date === date && x.cat === cat ? x.montant : 0), 0);
const dayVal = (date, k) => v(S.days.get(date), k) + (DAY_DEP[k] ? depOn(date, DAY_DEP[k].cat) : 0);
// Conversion des anciennes saisies : carburant et repas de la journée → dépenses (identifiant fixe par jour, sans doublon entre appareils)
async function migrateDayDeps() {
  let n = 0;
  for (const d of [...S.days.values()]) {
    const ks = Object.keys(DAY_DEP).filter(k => v(d, k) > 0); if (!ks.length) continue;
    for (const k of ks) {
      const id = DAY_DEP[k].pre + d.date, ex = S.deps.find(x => x.id === id), cat = DAY_DEP[k].cat;
      // « mig » garde le montant converti : si un autre appareil a déjà converti ce même montant, on ne l'ajoute pas une 2e fois
      const done = ex && ex.mig === v(d, k);
      const rec = { ...(ex || {}), id, date: d.date, cat, grp: catGrp(cat), desc: ex ? ex.desc : catLbl(cat), montant: r2((ex ? ex.montant : 0) + (done ? 0 : v(d, k))), mig: v(d, k) };
      await put("depenses", rec); S.deps = S.deps.filter(x => x.id !== id).concat(rec).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    }
    const nd = { ...d }; ks.forEach(k => delete nd[k]);
    if (Object.keys(nd).length === 1) { await del("days", d.date); S.days.delete(d.date); } else { await put("days", nd); S.days.set(d.date, nd); }
    n++;
  }
  return n;
}
// Charges de la semaine (rattachement, assurance, location, charges fixes, URSSAF…) : réparties sur les 7 jours
// de leur semaine. Une semaine à cheval sur deux mois compte au prorata dans chaque mois (ex. 6/7 octobre, 1/7 novembre).
const WEEKLY_DEP = /^(rat|loc|ass|fix|urssaf|ir|prov)-/;
const isWeeklyDep = x => WEEKLY_DEP.test(x.id || "");
function depShare(x, from, to) {
  if (!isWeeklyDep(x)) return x.date >= from && x.date <= to ? x.montant : 0;
  const mon = monday(fromIso(x.date)); let n = 0;
  for (let i = 0; i < 7; i++) { const d = iso(addDays(mon, i)); if (d >= from && d <= to) n++; }
  return n ? x.montant * n / 7 : 0;
}

function periodTotals(from, to) { // from/to iso inclus
  let ca = 0, ch = 0, jours = 0, km = 0, kmCa = 0, h = 0, hNet = 0;
  S.days.forEach(d => { if (d.date >= from && d.date <= to) {
    const r = recettes(d); ca += r; ch += dayCharges(d); if (r > 0) jours++;
    if (v(d, "km") > 0) { km += v(d, "km"); kmCa += r; }
    if (v(d, "heures") > 0) { h += v(d, "heures"); hNet += r; } // € / heure BRUT : recettes ÷ heures (carburant et repas non déduits)
  } });
  S.deps.forEach(x => { if (x.cat !== "Démarrage") ch += depShare(x, from, to); });
  // € / km : seulement les jours où les km sont saisis
  return { ca: r2(ca), charges: r2(ch), net: r2(ca - ch), jours, km: r2(km), eurKm: km ? kmCa / km : null, eurH: h ? hNet / h : null };
}
const perKm = x => x == null ? "–" : x.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
// Montants d'une semaine Virements par plateforme ; les anciennes semaines gardent leurs tableaux [Uber, Bolt, Heetch]
const LEGACY_VIR = ["uber", "bolt", "heetch"];
const wkVals = (w, f) => { const o = w[f + "P"]; if (o && typeof o === "object") return o;
  const a = w[f] || []; return Object.fromEntries(LEGACY_VIR.map((k, i) => [k, a[i] || 0])); };
const sumObj = o => Object.values(o).reduce((a, b) => a + (Number(b) || 0), 0);
function weekCalc(w) {
  const ca = sumObj(wkVals(w, "ca")), cash = sumObj(wkVals(w, "cash"));
  // anciennes semaines sans frais enregistrés : 50 € (tarif d'origine) ; nouvelles : prix du rattachement dans les réglages
  const fraisDef = !w.caP ? 50 : ratOn() ? cfg().rattach.montant : 0;
  const frais = ca > 0 ? (typeof w.frais === "number" ? w.frais : fraisDef) : 0;
  return { ca: r2(ca), cash: r2(cash), frais, vir: r2(ca - cash - frais) };
}
// Statuts autres que rattaché : chaque plateforme verse son virement elle-même → une case « reçu » par plateforme.
// Rattaché : un seul virement de la société de rattachement → un seul interrupteur « Virement reçu ».
const virParPlat = () => cfg().statut.type !== "salarie";
const platVir = (w, k) => r2((Number(wkVals(w, "ca")[k]) || 0) - (Number(wkVals(w, "cash")[k]) || 0));
const platDues = w => Object.keys(wkVals(w, "ca")).filter(k => (Number(wkVals(w, "ca")[k]) || 0) > 0 && platVir(w, k) > 0);
const platRecu = (w, k) => w.recuP ? !!w.recuP[k] : !!w.recu; // anciennes semaines : un seul « reçu » valait pour toutes les plateformes
function recvState(w, c) { // ce qui est reçu / reste à recevoir sur la semaine
  if (!(c.ca > 0)) return { recv: 0, rest: 0, n: 0, tot: 0, all: false };
  if (!virParPlat()) return { recv: w.recu ? c.vir : 0, rest: w.recu ? 0 : c.vir, n: w.recu ? 1 : 0, tot: 1, all: !!w.recu };
  const due = platDues(w), got = due.filter(k => platRecu(w, k));
  if (got.length === due.length) return { recv: c.vir, rest: 0, n: got.length, tot: due.length, all: true };
  const recv = r2(got.reduce((a, k) => a + platVir(w, k), 0));
  return { recv, rest: Math.max(0, r2(c.vir - recv)), n: got.length, tot: due.length, all: false };
}
