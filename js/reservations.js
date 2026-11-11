// VTC Rentable — Réservations
"use strict";

// ================= RÉSERVATIONS =================
// Saisie des réservations reçues ailleurs (téléphone, SMS, WhatsApp…) et justificatif de réservation préalable en PDF.
// L'heure d'enregistrement est mise par l'appli et ne se modifie pas.
const RESA_CANAUX = ["Téléphone", "SMS", "WhatsApp", "Email", "Site / appli", "Autre"];
const RESA_LIEUX = ["Aéroport Paris-Charles de Gaulle (CDG), 95700 Roissy-en-France", "Aéroport Paris-Orly (ORY), 94390 Orly"];
const SOC_DEF = { nom: "", adresse: "", tel: "", email: "", siren: "", registre: "", chauffeur: "", carte: "", immat: "" };
// L'exploitant imprimé sur le bon de commande dépend du statut :
// salarié rattaché → la société de rattachement ; auto-entrepreneur → son entreprise ; société → sa société.
const EX_FIELDS = ["nom", "adresse", "tel", "email", "siren", "registre"], CH_INFO = ["chauffeur", "carte", "immat"];
const exKey = () => cfg().statut.type === "salarie" ? "exploitRat" : "exploitPro";
const exTitle = () => ({ salarie: "Société de rattachement", auto: "Mon entreprise", societe: "Ma société" })[cfg().statut.type] || "Ma société";
const socCfg = () => {
  const c = cfg(), old = c.societe || {}, ex = c[exKey()] || (c.statut.type === "salarie" ? old : {}), ch = c.chauffeur || old, o = { ...SOC_DEF };
  EX_FIELDS.forEach(k => (o[k] = ex[k] || "")); CH_INFO.forEach(k => (o[k] = ch[k] || ""));
  if (c.statut.type === "salarie" && c.rattach.nom) o.nom = c.rattach.nom; // un seul nom pour la société de rattachement
  return o;
};
const socMissing = () => { const s = socCfg(); return [["nom", "nom de l'exploitant"], ["adresse", "adresse"], ["tel", "téléphone"], ["registre", "n° d'inscription au registre VTC"], ["chauffeur", "ton nom"], ["immat", "immatriculation"]].filter(([k]) => !String(s[k] || "").trim()).map(x => x[1]); };
const resaWhen = r => r.date + "T" + (r.heure || "00:00");
const dtFr = isoStr => { const d = new Date(isoStr); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} à ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const dateFr = dIso => dIso.split("-").reverse().join("/");
const resaNum = r => "R-" + r.createdAt.slice(0, 10).replace(/-/g, "") + "-" + r.id.slice(-4).toUpperCase();
const telFmt = t => String(t || "").replace(/\s+/g, "").replace(/^(\+33|0033)/, "0").replace(/(\d{2})(?=\d)/g, "$1 ").trim();

function renderResa() {
  const box = $("resaList"), now = new Date(), t = todayIso();
  const nowHm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const list = S.resas.slice().sort((a, b) => resaWhen(a) < resaWhen(b) ? -1 : 1);
  const today = list.filter(r => r.date === t), next = list.filter(r => r.date > t), past = list.filter(r => r.date < t).reverse().slice(0, 30);
  const item = r => `<button class="item resa${r.date === t && r.heure >= nowHm ? " soon" : ""}" data-resa="${esc(r.id)}"><div><b>${r.date === t ? "" : dateFr(r.date).slice(0, 5) + " · "}${esc(r.heure)}</b> · ${esc(r.nom || telFmt(r.tel))}<small>${esc(r.depart)}${r.arrivee ? " → " + esc(r.arrivee) : ""}</small></div><b>›</b></button>`;
  const sec = (lbl, arr, empty) => `<div class="section-label">${lbl}</div><div class="list">${arr.length ? arr.map(item).join("") : `<div class="item empty">${empty}</div>`}</div>`;
  box.innerHTML = sec("Aujourd'hui", today, "Aucune réservation aujourd'hui.") + (next.length ? sec("À venir", next, "") : "") + (past.length ? sec("Passées", past, "") : "");
  box.querySelectorAll("[data-resa]").forEach(b => (b.onclick = () => openResa(S.resas.find(r => r.id === b.dataset.resa))));
}
// Carnet : clients et adresses déjà saisis
const resaClients = () => { const m = new Map(); S.resas.slice().sort((a, b) => a.createdAt < b.createdAt ? -1 : 1).forEach(r => { if (r.nom) m.set(r.nom.toLowerCase(), { nom: r.nom, tel: r.tel }); }); return [...m.values()]; };
const resaLieux = () => [...new Set(RESA_LIEUX.concat(S.resas.flatMap(r => [r.depart, r.arrivee]).filter(Boolean)))];

function openResaForm(x) {
  const now = new Date(), in15 = new Date(Math.ceil((now.getTime() + 30 * 60000) / 300000) * 300000);
  const e = x || { nom: "", tel: "", date: iso(in15), heure: `${pad(in15.getHours())}:${pad(in15.getMinutes())}`, depart: "", arrivee: "", pax: 1, prix: "", canal: "Téléphone", note: "" };
  openSheet(`<h3>${x ? "Modifier la réservation" : "Nouvelle réservation"}</h3>
      <div class="cur">${x ? `Enregistrée le ${dtFr(x.createdAt)} · cette heure ne change pas.` : "L'heure d'enregistrement est ajoutée automatiquement."}</div>
      <div class="pair-lbl">Client</div>
      <input id="rNom" class="small" type="text" list="rCli" autocomplete="off" placeholder="Nom du client (si tu l'as)" value="${esc(e.nom)}" aria-label="Nom du client">
      <datalist id="rCli">${resaClients().map(c => `<option value="${esc(c.nom)}">`).join("")}</datalist>
      <input id="rTel" class="small" type="tel" autocomplete="off" placeholder="Téléphone du client" value="${esc(e.tel)}" aria-label="Téléphone du client" style="margin-top:8px">
      <div class="pair-lbl">Prise en charge</div>
      <div class="pair"><div><small>Date</small><input id="rDate" class="small" type="date" value="${esc(e.date)}"></div><div><small>Heure</small><input id="rHeure" class="small" type="time" value="${esc(e.heure)}"></div></div>
      <div class="chips" style="margin-top:8px">${[15, 30, 60].map(m => `<button class="chip" type="button" data-min="${m}">Dans ${m < 60 ? m + " min" : "1 h"}</button>`).join("")}</div>
      <input id="rDep" class="small" type="text" list="rLieux" autocomplete="off" placeholder="Adresse de prise en charge" value="${esc(e.depart)}" aria-label="Adresse de prise en charge">
      <div class="pair-lbl">Destination</div>
      <input id="rArr" class="small" type="text" list="rLieux" autocomplete="off" placeholder="Adresse de destination" value="${esc(e.arrivee)}" aria-label="Destination">
      <datalist id="rLieux">${resaLieux().map(l => `<option value="${esc(l)}">`).join("")}</datalist>
      <div class="pair" style="margin-top:10px"><div><small>Passagers</small><input id="rPax" class="small" type="text" inputmode="numeric" value="${esc(e.pax)}"></div><div><small>Prix convenu (€)</small><input id="rPrix" class="small" type="text" inputmode="decimal" placeholder="facultatif" value="${e.prix ? numTxt(e.prix) : ""}"></div></div>
      <label class="fl" for="rCanal">Réservation reçue par</label>
      <select id="rCanal">${RESA_CANAUX.map(c => `<option${c === e.canal ? " selected" : ""}>${c}</option>`).join("")}</select>
      <input id="rNote" class="small" type="text" maxlength="200" autocomplete="off" placeholder="Note (vol, bagages, siège enfant…)" value="${esc(e.note)}" aria-label="Note" style="margin-top:8px">
      <button class="btn primary" id="rSave" style="width:100%;margin-top:14px">Enregistrer</button>`, x ? null : "rTel");
  $("rNom").onchange = () => { const c = resaClients().find(c => c.nom.toLowerCase() === $("rNom").value.trim().toLowerCase()); if (c && !$("rTel").value) $("rTel").value = c.tel; };
  // prise en charge = heure locale du clic + N minutes (sans arrondi)
  const pickupIn = min => { const d = new Date(Date.now() + min * 60000); $("rDate").value = iso(d); $("rHeure").value = `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  $("sheet").querySelectorAll("[data-min]").forEach(b => (b.onclick = () => pickupIn(Number(b.dataset.min))));
  $("rSave").onclick = async () => {
    const nom = $("rNom").value.trim(), tel = $("rTel").value.trim(), date = $("rDate").value, heure = $("rHeure").value, depart = $("rDep").value.trim();
    if (!/^\+?[\d\s.()-]{8,}$/.test(tel)) { toast("Tape le téléphone du client", true); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(heure)) { toast("Choisis la date et l'heure de prise en charge", true); return; }
    if (!depart) { toast("Tape le lieu de prise en charge", true); return; }
    const pax = Math.max(1, Math.round(parse($("rPax").value) || 1)), prix = parse($("rPrix").value);
    const nowIso = new Date().toISOString();
    const rec = { id: x ? x.id : "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), createdAt: x ? x.createdAt : nowIso, ...(x ? { updatedAt: nowIso } : {}),
      nom, tel, date, heure, depart, arrivee: $("rArr").value.trim(), pax, prix: prix > 0 ? r2(prix) : 0, canal: $("rCanal").value, note: $("rNote").value.trim() };
    try { await put("resas", rec); S.resas = S.resas.filter(r => r.id !== rec.id).concat(rec); openResa(rec); renderResa(); toast(x ? "Réservation modifiée" : "Réservation enregistrée"); }
    catch (_) { toast("Enregistrement impossible", true); }
  };
}

// Fiche lisible à l'écran (à montrer lors d'un contrôle) + PDF
function openResa(r) {
  if (!r) return;
  const s = socCfg(), row = (k, v) => v ? `<div class="rrow"><span>${k}</span><b>${v}</b></div>` : "";
  openSheet(`<h3>Réservation ${esc(resaNum(r))}</h3>
      <div class="rcard">
        ${row("Prise en charge", `${dateFr(r.date)} à ${esc(r.heure)}`)}
        ${row("Lieu", esc(r.depart))}
        ${row("Destination", esc(r.arrivee))}
        ${row("Client", esc(r.nom || "non communiqué"))}
        ${row("Téléphone", `<a href="tel:${esc(r.tel.replace(/[^\d+]/g, ""))}">${esc(telFmt(r.tel))}</a>`)}
        ${row("Passagers", String(r.pax || 1))}
        ${row("Prix convenu", r.prix ? eur(r.prix) : "")}
        ${row("Réservation faite le", dtFr(r.createdAt) + (r.canal ? " · " + esc(r.canal) : ""))}
        ${r.updatedAt ? row("Modifiée le", dtFr(r.updatedAt)) : ""}
        ${row("Note", esc(r.note))}
        ${row("Exploitant", esc(s.nom || "à renseigner dans Statut et société"))}
      </div>
      <div class="stack" style="margin-top:12px">
        <button class="btn primary" id="rPdf">Bon de commande PDF</button>
        <button class="btn ghost" id="rEdit">Modifier</button>
        <button class="btn ghost" id="rDel">Supprimer</button>
      </div>`);
  $("rPdf").onclick = () => resaPdf(r);
  $("rEdit").onclick = () => openResaForm(r);
  $("rDel").onclick = async () => {
    const b = $("rDel");
    if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.className = "btn danger"; b.textContent = "Confirmer la suppression"; return; }
    await del("resas", r.id); S.resas = S.resas.filter(x => x.id !== r.id); closeSheet(); renderResa(); toast("Réservation supprimée");
  };
}
