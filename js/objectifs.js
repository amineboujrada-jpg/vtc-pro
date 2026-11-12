// VTC Rentable — Objectifs de la semaine et du mois, seuils (TVA, plafond micro), export pour le comptable
"use strict";

// ---------- Objectifs ----------
// Réglage enregistré dans la configuration : { semaine: 1200, mois: 5000, base: "ca" | "net" }
const objCfg = () => { const o = cfg().objectif || {}; return { semaine: Number(o.semaine) || 0, mois: Number(o.mois) || 0, base: o.base === "net" ? "net" : "ca" }; };
const objBaseLbl = b => b === "net" ? "revenu net" : "chiffre d'affaires";

// Avancement d'un objectif sur une période : fait, reste, et rythme à tenir si la période est en cours
function objState(target, base, start, end) {
  if (!(target > 0)) return null;
  const t = periodTotals(iso(start), iso(end)), done = base === "net" ? t.net : t.ca, today = todayIso();
  const cur = iso(start) <= today && today <= iso(end);
  const left = cur ? Math.round((end - fromIso(today)) / 86400000) + 1 : 0; // jours restants, aujourd'hui compris
  const reste = Math.max(0, r2(target - done));
  return { target, done, reste, pct: Math.max(0, Math.round(done / target * 100)), cur, left, parJour: cur && left > 0 && reste > 0 ? reste / left : 0, ok: done >= target };
}

// ---------- Seuils de l'auto-entrepreneur : franchise de TVA et plafond du régime micro ----------
// Valeurs 2026 pour les prestations de services, modifiables dans la fenêtre « Objectifs et seuils ».
const SEUILS_DEF = { tva: 37500, tvaMaj: 41250, micro: 83600, on: true };
const seuilsCfg = () => ({ ...SEUILS_DEF, ...(cfg().seuils || {}) });
const seuilsOn = () => cfg().statut.type === "auto" && seuilsCfg().on;
function seuilsState(year) {
  if (!seuilsOn()) return null;
  const s = seuilsCfg(), now = new Date(), y = year || now.getFullYear();
  // Chiffre d'affaires de l'année : toutes les recettes saisies, sans les pourboires
  let ca = 0;
  S.days.forEach(d => { if (d.date && d.date.slice(0, 4) === String(y)) ca += recettes(d) - v(d, "pourboire"); });
  ca = r2(ca);
  const isCur = y === now.getFullYear();
  const dayN = isCur ? Math.floor((now - new Date(y, 0, 1)) / 86400000) + 1 : 365, total = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
  const proj = isCur && dayN >= 14 ? r2(ca / dayN * total) : ca; // projection au rythme de l'année, après deux semaines
  const lvl = (val, lim) => val >= lim ? "over" : val >= lim * 0.8 ? "soon" : "ok";
  const tva = { lim: s.tva, maj: s.tvaMaj, pct: Math.round(ca / s.tva * 100), level: ca >= s.tvaMaj ? "over" : lvl(ca, s.tva), projOver: proj >= s.tva };
  const micro = { lim: s.micro, pct: Math.round(ca / s.micro * 100), level: lvl(ca, s.micro), projOver: proj >= s.micro };
  // Date à laquelle le seuil serait atteint au rythme actuel
  const when = lim => { if (!isCur || !(ca > 0) || ca >= lim || proj < lim) return ""; const d = addDays(new Date(y, 0, 1), Math.ceil(lim / (ca / dayN)) - 1); return `${d.getDate()} ${MOIS[d.getMonth()]}`; };
  tva.when = when(s.tva); micro.when = when(s.micro);
  return { y, ca, proj, isCur, tva, micro };
}
// Phrase d'alerte affichée sur l'onglet Jour : seulement à partir de 80 % d'un seuil, ou si le rythme mène au dépassement
function seuilsAlert() {
  const st = seuilsState(); if (!st) return null;
  const { tva, micro, ca } = st;
  if (micro.level === "over") return { level: "over", t: `Plafond micro dépassé : ${eur0(ca)} sur ${eur0(micro.lim)}` };
  if (tva.level === "over") return { level: "over", t: ca >= tva.maj ? `Seuil majoré de TVA dépassé : ${eur0(ca)} sur ${eur0(tva.maj)}` : `Seuil de TVA dépassé : ${eur0(ca)} sur ${eur0(tva.lim)}` };
  if (micro.level === "soon") return { level: "soon", t: `Plafond micro : ${micro.pct} % atteint (${eur0(ca)} sur ${eur0(micro.lim)})` };
  if (tva.level === "soon") return { level: "soon", t: `Seuil de TVA : ${tva.pct} % atteint (${eur0(ca)} sur ${eur0(tva.lim)})` };
  if (tva.when) return { level: "soon", t: `À ce rythme, seuil de TVA atteint vers le ${tva.when}` };
  return null;
}

// ---------- Bloc de l'onglet Jour : barres d'objectif et alerte de seuil ----------
function renderGoals() {
  const box = $("goals"); if (!box) return;
  const o = objCfg(), d = fromIso(curDate), mon = monday(d);
  const w = objState(o.semaine, o.base, mon, addDays(mon, 6)), m = objState(o.mois, o.base, monthStart(d), monthEnd(d));
  const bar = (lbl, s) => !s ? "" : `<div class="goal${s.ok ? " ok" : ""}">
      <div class="goal-h"><span>${lbl}</span><b>${eur0(s.done)} <small>/ ${eur0(s.target)}</small></b></div>
      <div class="goal-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, s.pct)}" aria-label="${lbl}"><i style="width:${Math.min(100, s.pct)}%"></i></div>
      <div class="goal-f">${s.ok ? `Objectif atteint · ${s.pct} %` : `${s.pct} % · reste ${eur0(s.reste)}` + (s.parJour ? ` · ${eur0(s.parJour)} par jour sur ${jTxt(s.left)}` : "")}</div></div>`;
  const al = seuilsAlert();
  const html = bar("Objectif de la semaine", w) + bar("Objectif du mois", m);
  box.innerHTML = (html ? `<button class="goals" id="goalsBtn" type="button" aria-label="Modifier mes objectifs">${html}</button>`
      : `<button class="goals-add" id="goalsBtn" type="button">＋ Fixer un objectif de la semaine ou du mois</button>`) +
    (al ? `<button class="seuil-al ${al.level}" id="seuilBtn" type="button">${esc(al.t)} <span aria-hidden="true">›</span></button>` : "");
  $("goalsBtn").onclick = () => openObjectifs();
  if (al) $("seuilBtn").onclick = () => openObjectifs();
}

// ---------- Fenêtre « Objectifs et seuils » ----------
function openObjectifs(fromMenu) {
  const o = objCfg(), st = seuilsState(), s = seuilsCfg(), isAuto = cfg().statut.type === "auto";
  let base = o.base;
  const gauge = (lbl, x, extra) => `<div class="goal ${x.level === "over" ? "bad" : x.level === "soon" ? "warn" : ""}">
      <div class="goal-h"><span>${lbl}</span><b>${eur0(st.ca)} <small>/ ${eur0(x.lim)}</small></b></div>
      <div class="goal-bar"><i style="width:${Math.min(100, x.pct)}%"></i></div>
      <div class="goal-f">${x.pct} %${extra ? " · " + extra : ""}</div></div>`;
  openSheet((fromMenu ? backBtn() : "") + `
      <h3>Objectifs${isAuto ? " et seuils" : ""}</h3>
      <div class="cur">Fixe ce que tu veux atteindre : l'onglet Jour affiche où tu en es et ce qu'il reste à faire par jour. Laisse vide pour ne pas avoir d'objectif.</div>
      <div class="seg two" role="radiogroup" aria-label="Objectif calculé sur" id="objBase">
        <button type="button" role="radio" data-b="ca" aria-checked="${base === "ca"}">Chiffre d'affaires</button>
        <button type="button" role="radio" data-b="net" aria-checked="${base === "net"}">Revenu net</button>
      </div>
      <label class="fl" for="objW">Objectif par semaine (€)</label>
      <input id="objW" class="small" type="text" inputmode="decimal" autocomplete="off" placeholder="ex. 1200" value="${o.semaine ? numTxt(o.semaine) : ""}">
      <label class="fl" for="objM">Objectif par mois (€)</label>
      <input id="objM" class="small" type="text" inputmode="decimal" autocomplete="off" placeholder="ex. 5000" value="${o.mois ? numTxt(o.mois) : ""}">
      ${isAuto ? `
      <div class="pair-lbl" style="margin-top:18px">Seuils de l'auto-entrepreneur · ${new Date().getFullYear()}</div>
      ${tgl("seuilOn", s.on, "Suivre mes seuils", "Alerte sur l'onglet Jour à partir de 80 %")}
      ${st ? gauge("Franchise de TVA", st.tva, st.tva.level === "over" ? (st.ca >= st.tva.maj ? "seuil majoré dépassé : TVA due dès maintenant" : "seuil dépassé : TVA à facturer au 1er janvier") : st.tva.when ? `à ce rythme, atteint vers le ${st.tva.when}` : st.isCur ? `projection fin d'année ${eur0(st.proj)}` : "") +
        gauge("Plafond du régime micro", st.micro, st.micro.level === "over" ? "plafond dépassé" : st.micro.when ? `à ce rythme, atteint vers le ${st.micro.when}` : "") : ""}
      <label class="fl" for="sTva">Seuil de franchise de TVA (€)</label>
      <input id="sTva" class="small" type="text" inputmode="decimal" autocomplete="off" value="${numTxt(s.tva)}">
      <label class="fl" for="sMaj">Seuil majoré de TVA (€)</label>
      <input id="sMaj" class="small" type="text" inputmode="decimal" autocomplete="off" value="${numTxt(s.tvaMaj)}">
      <label class="fl" for="sMicro">Plafond du régime micro (€)</label>
      <input id="sMicro" class="small" type="text" inputmode="decimal" autocomplete="off" value="${numTxt(s.micro)}">
      <p class="note">Seuils 2026 des prestations de services, à vérifier chaque année. Le calcul prend les recettes saisies dans l'appli depuis le 1er janvier, sans les pourboires. Pour la TVA, la base est le prix payé par le client, commission de la plateforme comprise : si tu saisis tes recettes après commission, ton vrai total est plus haut. L'année de création, les seuils sont réduits au prorata des jours d'activité. En cas de doute, demande à ton comptable.</p>` : ""}
      <div class="stack"><button class="btn primary" id="objSave">Enregistrer</button></div>`);
  if (fromMenu) bindBack();
  $("objBase").querySelectorAll("button").forEach(b => (b.onclick = () => { base = b.dataset.b; $("objBase").querySelectorAll("button").forEach(x => x.setAttribute("aria-checked", String(x === b))); }));
  if (isAuto) flip("seuilOn");
  $("objSave").onclick = async () => {
    const num = id => { const t = $(id).value.trim(); if (!t) return 0; const n = parse(t); return isFinite(n) && n >= 0 ? n : NaN; };
    const sw = num("objW"), sm = num("objM");
    if (isNaN(sw) || isNaN(sm)) return toast("Montant d'objectif invalide", true);
    const c = cfg(); c.objectif = { semaine: sw, mois: sm, base };
    if (isAuto) {
      const a = num("sTva"), b = num("sMaj"), m = num("sMicro");
      if (!(a > 0) || !(b >= a) || !(m > 0)) return toast("Seuils invalides : le seuil majoré doit être au-dessus du seuil de TVA", true);
      c.seuils = { tva: a, tvaMaj: b, micro: m, on: isOn("seuilOn") };
    }
    await saveCfg(c); closeSheet(); renderJour(); toast("Objectifs enregistrés");
  };
}

// ---------- Export du mois pour le comptable : résumé PDF et détail CSV ----------
function exportMois(ms) {
  const me = monthEnd(ms), from = iso(ms), to = iso(me), w = periodDetail(ms, me);
  const rec = platRows(w.plat);                                   // [libellé, montant, clé]
  const deps = S.deps.filter(x => x.date >= from && x.date <= to && x.cat !== "Démarrage").sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  // Total par groupe puis par catégorie, d'après les dépenses datées du mois
  const groups = new Map();
  deps.forEach(x => { const g = grpInfo(catGrp(x.cat)).t; if (!groups.has(g)) groups.set(g, new Map()); const m = groups.get(g), k = catLbl(x.cat); m.set(k, r2((m.get(k) || 0) + x.montant)); });
  const depTotal = r2(deps.reduce((a, x) => a + x.montant, 0));
  return { ms, me, from, to, w, rec, deps, groups, depTotal, titre: `${cap(MOIS[ms.getMonth()])} ${ms.getFullYear()}`, slug: `${ms.getFullYear()}-${pad(ms.getMonth() + 1)}` };
}
async function shareFile(blob, name, type) {
  if (window.__fileTest) { window.__fileTest(blob, name); return; }
  try {
    const file = new File([blob], name, { type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
  } catch (e) { if (e && e.name === "AbortError") return; }
  const url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
// CSV lisible par Excel en français : point-virgule, virgule décimale, encodage UTF-8 avec marque
function exportMoisCsv(ms) {
  const x = exportMois(ms), n = v => (Math.round(v * 100) / 100).toFixed(2).replace(".", ","), q = s => `"${String(s == null ? "" : s).replace(/"/g, '""')}"`;
  const L = [];
  const row = (...c) => L.push(c.map(v => typeof v === "number" ? n(v) : q(v)).join(";"));
  const s = socCfg();
  row("VTC Rentable - récapitulatif du mois", x.titre); row("Exploitant", s.nom || "", s.siren ? "SIREN / SIRET " + s.siren : ""); row("Statut", STATUTS[cfg().statut.type]); row("Édité le", dFr(new Date())); L.push("");
  row("RECETTES"); row("Plateforme", "Montant");
  x.rec.forEach(([l, m]) => row(l, m)); row("Total des recettes", x.w.ca); L.push("");
  row("RECETTES PAR JOUR"); row("Date", ...x.rec.map(r => r[0]), "Total", "Heures", "Km");
  x.w.days.filter(d => d.r > 0 || d.h > 0 || d.km > 0).forEach(d => { const day = S.days.get(d.date); row(dFr(fromIso(d.date)), ...x.rec.map(r => v(day, r[2])), d.r, d.h, d.km); });
  L.push("");
  row("DÉPENSES"); row("Date", "Groupe", "Catégorie", "Description", "Origine", "Montant");
  x.deps.forEach(d => row(dFr(fromIso(d.date)), grpInfo(catGrp(d.cat)).t, catLbl(d.cat), d.desc || "", d.auto || isWeeklyDep(d) ? "calculée par l'appli" : "saisie", d.montant)); row("Total des dépenses", "", "", "", "", x.depTotal); L.push("");
  row("ACTIVITÉ"); row("Jours travaillés", String(x.w.jours)); row("Heures", x.w.h); row("Kilomètres", x.w.km); L.push("");
  row("Document de travail issu des saisies du chauffeur. Montants tels que saisis, sans calcul de TVA.");
  return shareFile(new Blob(["﻿" + L.join("\r\n")], { type: "text/csv;charset=utf-8" }), `vtc-rentable-${x.slug}.csv`, "text/csv");
}
// PDF d'une page : recettes par plateforme, dépenses par catégorie, activité
function exportMoisPdf(ms) {
  const x = exportMois(ms), s = socCfg(); let c = "", y = 800;
  const T = (px, yy, t, size = 10, bold = false, gray = false) => { c += `BT ${gray ? "0.42 0.45 0.5 rg" : "0.08 0.09 0.13 rg"} /${bold ? "F2" : "F1"} ${size} Tf ${px} ${yy} Td (${pdfStr(t)}) Tj ET\n`; };
  const R = (yy, t, size = 10, bold = false) => { const wd = String(t).length * size * 0.5; T(539 - wd, yy, t, size, bold); }; // montant aligné à droite (largeur approchée)
  const H = t => { y -= 12; T(50, y, t, 12.5, true); y -= 8; c += `0.8 0.81 0.85 RG 0.8 w 50 ${y} m 539 ${y} l S\n`; y -= 16; };
  const kv = (k, val, bold) => { T(bold ? 50 : 62, y, k, 10, bold); R(y, val, 10, bold); y -= 15; };
  const money = m => eur(r2(m));
  T(50, y, "Récapitulatif du mois", 20, true); T(50, y - 20, x.titre, 13, false, true); y -= 44;
  [s.nom, s.siren ? "SIREN / SIRET : " + s.siren : "", STATUTS[cfg().statut.type]].filter(Boolean).forEach(l => { T(50, y, l, 10); y -= 13; });
  H("Recettes");
  if (!x.rec.length) kv("Aucune recette saisie", "");
  x.rec.forEach(([l, m]) => kv(l, money(m)));
  kv("Total des recettes", money(x.w.ca), true);
  H("Dépenses du mois");
  // Une ligne par catégorie tant que la page le permet, sinon une ligne par groupe
  const nCat = [...x.groups.values()].reduce((a, m) => a + m.size, 0), detail = nCat + x.groups.size <= Math.floor((y - 190) / 15);
  if (!x.groups.size) kv("Aucune dépense saisie", "");
  x.groups.forEach((cats, g) => {
    const tot = r2([...cats.values()].reduce((a, b) => a + b, 0));
    if (detail) { T(62, y, g, 10, true); R(y, money(tot), 10, true); y -= 15; cats.forEach((m, k) => { T(76, y, k, 9.5, false, true); R(y, money(m), 9.5); y -= 14; }); }
    else kv(g, money(tot));
  });
  kv("Total des dépenses", money(x.depTotal), true);
  H("Activité");
  kv("Jours travaillés", String(x.w.jours)); kv("Heures", x.w.h ? fmtH(x.w.h) : "–"); kv("Kilomètres", x.w.km ? kmTxt(x.w.km) : "–");
  kv("Recettes moins dépenses du mois", money(x.w.ca - x.depTotal), true);
  wrapTxt("Document de travail issu des saisies du chauffeur dans VTC Rentable. Montants tels que saisis, sans calcul de TVA. Les charges de la semaine (cotisations, rattachement, assurance) sont calculées par l'appli d'après les réglages. Le détail ligne par ligne est dans le fichier CSV.", 8.5, 480)
    .forEach((ln, i) => T(50, 58 - i * 11, ln, 8.5, false, true));
  T(50, 30, `Édité le ${dFr(new Date())} avec VTC Rentable.`, 8.5, false, true);
  return shareFile(buildPdf(c), `vtc-rentable-${x.slug}.pdf`, "application/pdf");
}
function openExportMois(ms) {
  const x = exportMois(ms);
  openSheet(`<button class="backlink" id="exBack" type="button">‹ ${x.titre}</button>
      <h3>Export pour le comptable</h3>
      <div class="cur">${x.titre} : ${eur0(x.w.ca)} de recettes, ${x.deps.length} dépense${x.deps.length > 1 ? "s" : ""} pour ${eur0(x.depTotal)}.</div>
      <div class="stack">
        <button class="btn primary" id="exPdf">Résumé en PDF</button>
        <button class="btn ghost" id="exCsv">Détail en tableau (CSV, pour Excel)</button>
      </div>
      <p class="note">Le PDF tient sur une page : recettes par plateforme, dépenses par catégorie, activité. Le CSV liste chaque jour et chaque dépense. Les montants sont ceux que tu as saisis, sans calcul de TVA.</p>`);
  $("exBack").onclick = () => openMonthDetail(ms);
  $("exPdf").onclick = () => exportMoisPdf(ms);
  $("exCsv").onclick = () => exportMoisCsv(ms);
}
