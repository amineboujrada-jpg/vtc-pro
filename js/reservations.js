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

// ---------- État d'une réservation ----------
// statut enregistré : "confirmee" (par défaut), "attente" (le client doit confirmer), "terminee", "annulee"
const RESA_ST = { attente: ["En attente", "wait"], confirmee: ["Confirmée", "ok"], terminee: ["Terminée", "done"], annulee: ["Annulée", "off"], retard: ["À terminer", "late"] };
const resaSt = r => RESA_ST[r.statut] ? r.statut : "confirmee";
const resaOpen = r => resaSt(r) === "confirmee" || resaSt(r) === "attente";       // ni terminée ni annulée
const resaPast = r => resaWhen(r) < todayIso() + "T" + nowHM();                      // l'heure de prise en charge est passée
const resaBadge = r => { const st = resaSt(r); return RESA_ST[st === "confirmee" && r.date < todayIso() ? "retard" : st]; };
// Pastille du client : initiales et couleur stable d'après son nom ou son téléphone
const RESA_HUES = [215, 28, 150, 280, 340, 190, 55];
function resaAvatar(r) {
  const name = (r.nom || "").trim(), key = name || r.tel || "?";
  const ini = name ? name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() : "☎";
  let h = 0; for (const ch of key) h = (h * 31 + ch.codePointAt(0)) % 997;
  return `<span class="ravatar" style="--h:${RESA_HUES[h % RESA_HUES.length]}" aria-hidden="true">${esc(ini)}</span>`;
}
const resaDayLbl = dIso => {
  const t = todayIso(), d = fromIso(dIso), full = cap(d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }));
  return dIso === t ? "Aujourd'hui · " + full : dIso === iso(addDays(fromIso(t), 1)) ? "Demain · " + full : dIso === iso(addDays(fromIso(t), -1)) ? "Hier · " + full : full + (d.getFullYear() !== fromIso(t).getFullYear() ? " " + d.getFullYear() : "");
};
const resaTimeLbl = r => (r.date === todayIso() ? "Aujourd'hui" : r.date === iso(addDays(new Date(), 1)) ? "Demain" : dateFr(r.date).slice(0, 5)) + " à " + r.heure;
const RESA_PIN = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.3"/></svg>';
const RESA_FLAG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4M5 4h11l-1.5 4L16 12H5"/></svg>';

// Filtres de la page, comme dans Revenus hebdomadaires
let resaFilter = "cours";
const RESA_FILTERS = [["cours", "En cours"], ["attente", "En attente"], ["terminee", "Terminées"], ["annulee", "Annulées"], ["all", "Toutes"]];
const resaMatches = (r, f) => f === "all" ? true : f === "cours" ? resaOpen(r) : resaSt(r) === f;

function renderResa() {
  const box = $("resaList"), t = todayIso(), month = t.slice(0, 7);
  const all = S.resas.slice();
  // Bandeau de totaux : toutes les réservations, quel que soit le filtre
  const open = all.filter(resaOpen), todayN = open.filter(r => r.date === t).length, next = open.filter(r => r.date > t);
  const doneM = all.filter(r => resaSt(r) === "terminee" && r.date.slice(0, 7) === month);
  const sum = a => a.reduce((x, r) => x + (Number(r.prix) || 0), 0);
  $("resaTotals").innerHTML = all.length ? `<div class="kpi"><div class="lbl">Aujourd'hui</div><div class="v">${todayN}</div></div>
      <div class="kpi"><div class="lbl">À venir</div><div class="v">${next.length}${sum(next) ? ` <small>· ${eur0(sum(next))}</small>` : ""}</div></div>
      <div class="kpi" style="grid-column:span 2"><div class="lbl">Terminées en ${MOIS[fromIso(t).getMonth()]}</div><div class="v">${doneM.length}${sum(doneM) ? ` <small>· ${eur0(sum(doneM))}</small>` : ""}</div></div>` : "";
  const fbox = $("resaFilters"); fbox.innerHTML = "";
  if (all.length) RESA_FILTERS.forEach(([k, label]) => {
    const n = all.filter(r => resaMatches(r, k)).length;
    const fb = document.createElement("button"); fb.type = "button"; fb.className = "wk-chip";
    fb.textContent = k === "all" || !n ? label : `${label} · ${n}`; fb.setAttribute("aria-pressed", String(resaFilter === k));
    fb.onclick = () => { resaFilter = k; renderResa(); };
    fbox.appendChild(fb);
  });
  if (!all.length) { box.innerHTML = `<div class="rempty"><b>Aucune réservation</b>Ajoute ici les courses réservées par téléphone, SMS ou WhatsApp : tu gardes le suivi et le bon de commande.</div>`; return; }
  // En cours : de la plus proche à la plus lointaine (les oubliées d'hier restent en haut). Le reste : de la plus récente à la plus ancienne.
  const asc = resaFilter === "cours" || resaFilter === "attente";
  const shown = all.filter(r => resaMatches(r, resaFilter)).sort((a, b) => (resaWhen(a) < resaWhen(b) ? -1 : 1) * (asc ? 1 : -1)).slice(0, 60);
  if (!shown.length) { box.innerHTML = `<div class="rempty">Aucune réservation dans ce filtre.</div>`; return; }
  // La prochaine course à faire est affichée en grand, les autres en résumé
  const focus = resaFilter === "cours" ? (shown.find(r => !resaPast(r)) || shown[shown.length - 1]) : null;
  const card = r => {
    const [lbl, cls] = resaBadge(r), big = r === focus, st = resaSt(r);
    const act = st === "attente" ? ["confirm", "Confirmer"] : st === "confirmee" ? ["finish", "Terminer"] : null;
    return `<article class="rpost${big ? " big" : ""}${st === "annulee" ? " off" : ""}" data-resa="${esc(r.id)}" tabindex="0" role="button" aria-label="Réservation ${esc(r.nom || telFmt(r.tel))}, ${esc(resaTimeLbl(r))}">
        <header>${resaAvatar(r)}<div class="rwho"><b>${esc(r.nom || telFmt(r.tel))}</b><small>${esc(r.heure)} · ${esc(r.canal || "Réservation")}</small></div><span class="rbadge ${cls}">${lbl}</span></header>
        ${big ? `<div class="rroute"><div class="rstop dep">${RESA_PIN}<div><b>Départ</b><span>${esc(r.depart)}</span></div></div>${r.arrivee ? `<div class="rstop arr">${RESA_FLAG}<div><b>Destination</b><span>${esc(r.arrivee)}</span></div></div>` : ""}</div>`
          : `<div class="rline dep">${RESA_PIN}<span>${esc(r.depart)}${r.arrivee ? " → " + esc(r.arrivee) : ""}</span></div>`}
        ${r.note ? `<div class="rnote">${esc(r.note)}</div>` : ""}
        <div class="rprice"><span>${r.prix ? "Prix convenu" : `${r.pax || 1} passager${(r.pax || 1) > 1 ? "s" : ""}`}</span><b>${r.prix ? eur(r.prix) : ""}</b></div>
        ${big && act ? `<div class="ractions"><button class="btn ghost" type="button" data-act="open">Voir détails</button><button class="btn primary go" type="button" data-act="${act[0]}">${act[1]}</button></div>` : ""}
      </article>`;
  };
  let html = "", last = "";
  shown.forEach(r => {
    if (r.date !== last) { const n = shown.filter(x => x.date === r.date).length; html += `<div class="rday"><b>${esc(resaDayLbl(r.date))}</b><span>${n} réservation${n > 1 ? "s" : ""}</span></div>`; last = r.date; }
    html += card(r);
  });
  box.innerHTML = html;
  box.querySelectorAll("[data-resa]").forEach(el => {
    const r = S.resas.find(x => x.id === el.dataset.resa);
    el.onclick = e => { const a = e.target.closest("[data-act]"); if (a && a.dataset.act === "finish") return openResaFinish(r); if (a && a.dataset.act === "confirm") return setResaSt(r, "confirmee"); openResa(r); };
    el.onkeydown = e => { if ((e.key === "Enter" || e.key === " ") && e.target === el) { e.preventDefault(); openResa(r); } };
  });
}
// Change l'état d'une réservation (confirmée, terminée, annulée…)
async function setResaSt(r, st, extra) {
  const rec = { ...r, ...(extra || {}), statut: st, updatedAt: new Date().toISOString() };
  try { await put("resas", rec); S.resas = S.resas.filter(x => x.id !== rec.id).concat(rec); renderResa(); toast(`Réservation ${RESA_ST[st][0].toLowerCase()}`); return rec; }
  catch (_) { toast("Enregistrement impossible", true); return null; }
}
// « Terminer » : la course est faite. Si un prix est convenu, on propose de l'ajouter aux courses privées du jour.
function openResaFinish(r) {
  const canAdd = r.prix > 0 && !r.compte;
  openSheet(`<h3>Course terminée ?</h3>
      <div class="cur">${esc(r.nom || telFmt(r.tel))} · ${dateFr(r.date)} à ${esc(r.heure)}${r.prix ? " · " + eur(r.prix) : ""}</div>
      <div class="stack">
        ${canAdd ? `<button class="btn primary" id="rfAdd">Terminer et ajouter ${eur(r.prix)} aux courses privées du ${dateFr(r.date).slice(0, 5)}</button>` : ""}
        <button class="btn ${canAdd ? "ghost" : "primary"}" id="rfDone">${canAdd ? "Terminer sans ajouter aux recettes" : "Marquer comme terminée"}</button>
      </div>
      ${canAdd ? `<p class="note">Choisis « sans ajouter » si tu as déjà saisi cette course dans tes recettes du jour.</p>` : ""}`);
  $("rfDone").onclick = async () => { if (await setResaSt(r, "terminee")) closeSheet(); };
  if (canAdd) $("rfAdd").onclick = async () => {
    try {
      const day = Object.assign({ date: r.date }, S.days.get(r.date) || {});
      day.prive = r2(v(day, "prive") + r.prix);
      await put("days", day); S.days.set(r.date, day);
    } catch (_) { toast("Enregistrement impossible", true); return; }
    if (await setResaSt(r, "terminee", { compte: true })) { closeSheet(); toast(`${eur(r.prix)} ajoutés aux courses privées`); }
  };
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
      <label class="fl" for="rStat">État</label>
      <select id="rStat">${["confirmee", "attente"].concat(x && !resaOpen(x) ? [resaSt(x)] : []).map(k => `<option value="${k}"${k === (x ? resaSt(x) : "confirmee") ? " selected" : ""}>${RESA_ST[k][0]}${k === "attente" ? " (le client doit confirmer)" : ""}</option>`).join("")}</select>
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
      nom, tel, date, heure, depart, arrivee: $("rArr").value.trim(), pax, prix: prix > 0 ? r2(prix) : 0, canal: $("rCanal").value, note: $("rNote").value.trim(), statut: $("rStat").value, ...(x && x.compte ? { compte: true } : {}) };
    try { await put("resas", rec); S.resas = S.resas.filter(r => r.id !== rec.id).concat(rec); openResa(rec); renderResa(); toast(x ? "Réservation modifiée" : "Réservation enregistrée"); }
    catch (_) { toast("Enregistrement impossible", true); }
  };
}

// Fiche lisible à l'écran (à montrer lors d'un contrôle) + PDF
function openResa(r) {
  if (!r) return;
  const s = socCfg(), row = (k, v) => v ? `<div class="rrow"><span>${k}</span><b>${v}</b></div>` : "";
  const st = resaSt(r), [bl, bc] = resaBadge(r);
  openSheet(`<h3>Réservation ${esc(resaNum(r))}</h3>
      <div class="rhead">${resaAvatar(r)}<div class="rwho"><b>${esc(r.nom || telFmt(r.tel))}</b><small>${esc(resaTimeLbl(r))}</small></div><span class="rbadge ${bc}">${bl}</span></div>
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
        ${st === "attente" ? `<button class="btn primary go" id="rConfirm">Confirmer la réservation</button>` : ""}
        ${st === "confirmee" ? `<button class="btn primary go" id="rFinish">Terminer la course</button>` : ""}
        <button class="btn ${resaOpen(r) ? "ghost" : "primary"}" id="rPdf">Bon de commande PDF</button>
        <button class="btn ghost" id="rEdit">Modifier</button>
        ${resaOpen(r) ? `<button class="btn ghost" id="rCancel">Annuler la réservation</button>` : `<button class="btn ghost" id="rReopen">Remettre en cours</button>`}
        <button class="btn ghost" id="rDel">Supprimer</button>
      </div>`);
  if ($("rConfirm")) $("rConfirm").onclick = async () => { const n = await setResaSt(r, "confirmee"); if (n) openResa(n); };
  if ($("rFinish")) $("rFinish").onclick = () => openResaFinish(r);
  if ($("rCancel")) $("rCancel").onclick = async () => {
    const b = $("rCancel");
    if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.className = "btn danger"; b.textContent = "Confirmer l'annulation"; return; }
    const n = await setResaSt(r, "annulee"); if (n) openResa(n);
  };
  if ($("rReopen")) $("rReopen").onclick = async () => { const n = await setResaSt(r, "confirmee"); if (n) openResa(n); };
  $("rPdf").onclick = () => resaPdf(r);
  $("rEdit").onclick = () => openResaForm(r);
  $("rDel").onclick = async () => {
    const b = $("rDel");
    if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.className = "btn danger"; b.textContent = "Confirmer la suppression"; return; }
    await del("resas", r.id); S.resas = S.resas.filter(x => x.id !== r.id); closeSheet(); renderResa(); toast("Réservation supprimée");
  };
}
