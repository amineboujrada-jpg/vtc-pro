// VTC Rentable — Interface : onglet Jour, heures, kilomètres
"use strict";

// ================= UI =================
function toast(msg, err) {
  const t = $("toast"); t.textContent = msg; t.className = "toast show" + (err ? " err" : "");
  clearTimeout(t._h); t._h = setTimeout(() => (t.className = "toast"), 2400);
}
function openSheet(html, focusId) {
  const s = $("sheet");
  // bouton ✕ toujours visible en haut à droite (reste en place quand on fait défiler)
  s.innerHTML = `<div class="sheet-bar"><button class="sheet-x" type="button" aria-label="Fermer">✕</button></div>` + html;
  s.querySelector(".sheet-x").onclick = closeSheet;
  $("backdrop").hidden = false;
  requestAnimationFrame(() => s.classList.add("open"));
  if (focusId) setTimeout(() => { const el = $(focusId); if (el) el.focus(); }, 230);
}
function closeSheet() { $("sheet").classList.remove("open"); $("backdrop").hidden = true; }
$("backdrop").onclick = closeSheet;
document.addEventListener("keydown", e => { if (e.key === "Escape" && $("sheet").classList.contains("open")) closeSheet(); });

let curDate = todayIso();
const dayMax = () => iso(addDays(fromIso(svcJour()), 1)); // demain est accessible, pas au-delà (pendant un service : demain = le jour suivant celui du service)
let tab = "jour";

function renderSummary(id, o) {
  const n = $(id + "Net"); n.textContent = eur0(o.net); n.className = "net" + (o.net < 0 ? " neg" : "");
  const det = $(id + "Det"); if (!det) return; // onglet Jour : cartes compactes (net seul), le détail s'ouvre au toucher
  det.innerHTML = "";
  const rows = [["CA", eur0(o.ca)], ["Charges", eur0(o.charges)]];
  if (o.km) rows.push(["Km", Math.round(o.km).toLocaleString("fr-FR")], ["€ / km", perKm(o.eurKm)]);
  if (o.eurH != null) rows.push(["€ / heure", perKm(o.eurH)]);
  rows.push(["Jours", String(o.jours)]);
  rows.forEach(([a, b]) => {
    const s1 = document.createElement("span"); s1.textContent = a; const s2 = document.createElement("span"); s2.textContent = b; det.append(s1, s2);
  });
}

function renderJour() {
  const d = fromIso(curDate), isToday = curDate === svcJour(), isTomorrow = curDate === dayMax();
  $("dayLabel").innerHTML = `${esc(d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }))}` +
    `<small>${isToday ? "Aujourd'hui" : isTomorrow ? `Demain · <button id="goToday">Revenir à aujourd'hui</button>` : `<button id="goToday">Revenir à aujourd'hui</button>`}</small>`;
  if (!isToday) $("goToday").onclick = () => { curDate = svcJour(); renderJour(); };
  const atMax = curDate >= dayMax(); $("next").disabled = atMax; $("next").style.opacity = atMax ? .35 : 1;

  const mon = monday(d);
  $("wLbl").textContent = `Semaine du ${pad(mon.getDate())}/${pad(mon.getMonth() + 1)}`;
  renderSummary("w", periodTotals(iso(mon), iso(addDays(mon, 6))));
  $("mLbl").textContent = `${MOIS[d.getMonth()]} ${d.getFullYear()}`;
  renderSummary("m", periodTotals(iso(new Date(d.getFullYear(), d.getMonth(), 1)), iso(new Date(d.getFullYear(), d.getMonth() + 1, 0))));

  const day = S.days.get(curDate) || {};
  const tile = f => {
    const val = DAY_DEP[f.k] ? dayVal(curDate, f.k) : v(day, f.k);
    let txt = f.k === "heures" ? (val ? fmtH(val) : "–") : f.unit ? (val ? val.toLocaleString("fr-FR") + " " + f.unit : "–") : (val ? eur(val) : "–");
    const kmRun = f.k === "km" && typeof day.kmStart === "number" && typeof day.kmEnd !== "number";
    const running = kmRun || (f.k === "heures" && S.meta.shiftStart && S.meta.shiftStart.date === curDate);
    if (running && f.k === "heures") txt = (val ? fmtH(val) + " + " : "") + "⏱ " + S.meta.shiftStart.time;
    if (kmRun) txt = (val ? val.toLocaleString("fr-FR") + " km · " : "") + day.kmStart.toLocaleString("fr-FR");
    return `<button class="tile${f.charge ? " charge" : ""}${val || running ? "" : " empty"}${running ? " running" : ""}" data-k="${f.k}"><div class="t">${kmRun ? "Km · compteur début" : running ? "En cours depuis" : f.t}</div><div class="v">${txt}</div></button>`;
  };
  renderService(); renderGoals(); renderEnt();
  const rec = recettes(day);
  // Saisie d'abord : recettes, dépenses du jour, horaires et km, puis le net du jour
  const chf = k => CH_FIELDS.find(x => x.k === k);
  const dayDep = Object.keys(DAY_DEP).reduce((a, k) => a + dayVal(curDate, k), 0);
  const net = r2(rec - dayDep);
  $("tiles").innerHTML =
    `<div class="grid">${allPlats().filter(p => cfg().plats[p.k] || v(day, p.k) > 0).concat(PLAT_FIXED).map(recField).map(tile).join("")}` +
    `<div class="tile total"><div class="t">Total</div><div class="v">${rec ? eur(rec) : "–"}</div></div></div>` +
    `<div class="section-label">Dépenses du jour</div>` +
    `<div class="grid two">${["carburant", "repas"].map(chf).map(tile).join("")}</div>` +
    `<div class="section-label">Horaires et kilomètres</div>` +
    `<div class="grid two">${["heures", "km"].map(chf).map(tile).join("")}` +
    `<div class="tile total ratio"><div class="t">€ / km</div><div class="v">${v(day, "km") > 0 && rec ? perKm(rec / v(day, "km")) : "–"}</div></div>` +
    `<div class="tile total ratio"><div class="t">€ / heure</div><div class="v">${v(day, "heures") > 0 && rec ? perKm(rec / v(day, "heures")) : "–"}</div></div></div>` +
    `<div class="daynet"><span>Net du jour<small>recettes − carburant et repas</small></span><b class="${net < 0 ? "neg" : ""}">${rec || dayDep ? eur(net) : "–"}</b></div>`;
  $("tiles").querySelectorAll("button.tile").forEach(b => (b.onclick = () => openField(b.dataset.k)));

  const box = $("deps"); box.innerHTML = "";
  const recent = S.deps.filter(x => x.cat !== "Démarrage").slice(-6).reverse();
  if (!recent.length) { box.innerHTML = '<div class="item empty">Aucune dépense. Touche « + Ajouter » pour en ajouter une.</div>'; return; }
  recent.forEach(x => {
    const b = document.createElement("button"); b.className = "item";
    const left = document.createElement("div"); left.textContent = x.desc || x.cat;
    const sm = document.createElement("small"); const dd = fromIso(x.date); sm.textContent = `${pad(dd.getDate())}/${pad(dd.getMonth() + 1)} · ${grpInfo(catGrp(x.cat)).t} · ${catLbl(x.cat)}`; left.appendChild(sm);
    const amt = document.createElement("b"); amt.textContent = eur(x.montant);
    b.append(left, amt); b.onclick = () => openDepense(x); box.appendChild(b);
  });
}

// ---------- Choisir la date : cadran à molettes (jour, mois, année), jamais après aujourd'hui ----------
const DP_ITEM = 44; // hauteur d'une ligne de molette (px)
function openDatePicker() {
  const max = fromIso(dayMax()), maxY = max.getFullYear(), maxM = max.getMonth();
  const cur = fromIso(curDate);
  let y = cur.getFullYear(), m = cur.getMonth(), dd = cur.getDate();
  const y0 = Math.min(maxY - 2, cur.getFullYear()); // trois ans en arrière au plus, sans date future
  const yrs = Array.from({ length: maxY - y0 + 1 }, (_, i) => y0 + i);
  const monthsOf = yy => Array.from({ length: yy === maxY ? maxM + 1 : 12 }, (_, i) => i);
  const maxDay = (yy, mm) => (yy === maxY && mm === maxM) ? max.getDate() : new Date(yy, mm + 1, 0).getDate();
  const clamp = () => {
    if (m > monthsOf(y).length - 1) m = monthsOf(y).length - 1;
    if (dd > maxDay(y, m)) dd = maxDay(y, m);
  };
  clamp();
  const markOn = (el, idx) => el.querySelectorAll(".it").forEach((x, i) => x.classList.toggle("on", i === idx));
  const pick = el => Math.min(Math.max(Math.round(el.scrollTop / DP_ITEM), 0), el.querySelectorAll(".it").length - 1);
  const draw = (el, items, idx) => {
    el.innerHTML = '<div class="sp"></div>' + items.map(t => `<div class="it">${t}</div>`).join("") + '<div class="sp"></div>';
    el.scrollTop = idx * DP_ITEM; markOn(el, idx);
  };
  const drawM = () => draw($("dpM"), monthsOf(y).map(i => MOIS[i].charAt(0).toUpperCase() + MOIS[i].slice(1)), m);
  const drawD = () => draw($("dpD"), Array.from({ length: maxDay(y, m) }, (_, i) => String(i + 1)), dd - 1);
  const listen = (el, apply) => el.addEventListener("scroll", () => {
    markOn(el, pick(el));
    clearTimeout(el._t); el._t = setTimeout(() => apply(pick(el)), 120);
  }, { passive: true });

  openSheet(`<h3>Choisir la date</h3>
    <div class="dp-card"><div class="dp-wheels"><div class="wheel" id="dpD"></div><div class="wheel" id="dpM"></div><div class="wheel" id="dpY"></div></div></div>
    <button class="btn primary" id="dpOk" type="button" style="width:100%">Valider</button>`);
  draw($("dpY"), yrs.map(String), yrs.indexOf(y));
  drawM(); drawD();
  listen($("dpY"), i => { y = yrs[i]; clamp(); drawM(); drawD(); });
  listen($("dpM"), i => { m = i; clamp(); drawD(); });
  listen($("dpD"), i => { dd = i + 1; });
  $("dpOk").onclick = () => { curDate = iso(new Date(y, m, dd)); closeSheet(); renderJour(); };
}
// Toucher la date ouvre le cadran (les boutons à l'intérieur gardent leur action)
$("dayLabel").setAttribute("role", "button"); $("dayLabel").tabIndex = 0;
$("dayLabel").onclick = e => { if (!e.target.closest("button")) openDatePicker(); };
$("dayLabel").onkeydown = e => { if ((e.key === "Enter" || e.key === " ") && !e.target.closest("button")) { e.preventDefault(); openDatePicker(); } };

// ---------- Heures : début / fin avec bouton « maintenant » ----------
const fmtH = h => { const m = Math.round(h * 60); return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`; };
const nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const toMin = s => { const m = /^(\d{1,2}):(\d{2})/.exec(s || ""); return m ? (+m[1]) * 60 + (+m[2]) : null; };
function openHours() {
  const f = CH_FIELDS.find(x => x.k === "heures"), cur = v(S.days.get(curDate), "heures");
  const saved = S.meta.shiftStart && S.meta.shiftStart.date === curDate ? S.meta.shiftStart.time : "";
  openSheet(`
      <h3>Heures de travail</h3>
      <div class="cur">${esc(cap(fromIso(curDate).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })))} · déjà saisi : ${cur ? fmtH(cur) : "rien"}</div>
      <div class="tgrid">
        <div><div class="pair-lbl">Début</div><div class="trow"><input id="hStart" type="time" value="${saved}" aria-label="Heure de début"><button class="now" id="nowStart" aria-label="Maintenant" title="Maintenant"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5M12 2.5V5"/></svg></button></div></div>
        <div><div class="pair-lbl">Fin</div><div class="trow"><input id="hEnd" type="time" aria-label="Heure de fin"><button class="now" id="nowEnd" aria-label="Maintenant" title="Maintenant"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5M12 2.5V5"/></svg></button></div></div>
      </div>
      <div class="calc" id="hCalc"><span>Durée</span><span>—</span></div>
      <div class="pair-lbl">Ou durée</div>
      <div class="hmrow"><input id="hH" type="text" inputmode="numeric" autocomplete="off" placeholder="0" aria-label="Heures"><span>h</span><input id="hM" type="text" inputmode="numeric" autocomplete="off" placeholder="00" aria-label="Minutes"><span>min</span></div>
      <div class="row"><button class="btn primary" id="add">＋ Ajouter</button><button class="btn ghost" id="set">Remplacer</button></div>`);
  const calc = () => {
    const a = toMin($("hStart").value), b = toMin($("hEnd").value);
    if (a == null || b == null) { $("hCalc").innerHTML = `<span>Durée</span><span>${a != null ? "en attente de la fin" : "—"}</span>`; return; }
    let m = b - a; if (m <= 0) m += 1440; // passage de minuit
    const h = r2(m / 60);
    $("hCalc").innerHTML = `<span class="big">Durée</span><span class="big">${fmtH(h)}</span>`;
    $("hH").value = Math.floor(m / 60); $("hM").value = pad(m % 60);
  };
  const keepStart = async () => {
    const t = $("hStart").value;
    const old = S.meta.shiftStart && S.meta.shiftStart.date === curDate ? S.meta.shiftStart : {};
    await setMeta("shiftStart", t ? Object.assign({}, old, { date: curDate, time: t }) : undefined); renderJour();
  };
  $("nowStart").onclick = async () => { $("hStart").value = nowHM(); await keepStart(); calc(); toast(`Début ${$("hStart").value} enregistré`); };
  $("nowEnd").onclick = () => { $("hEnd").value = nowHM(); calc(); };
  $("hStart").onchange = async () => { await keepStart(); calc(); };
  $("hEnd").onchange = calc;
  $("add").onclick = () => saveField(f, "add");
  $("set").onclick = () => saveField(f, "set");
  calc();
}

// ---------- Km : compteur début / fin ----------
// Le compteur de début reprend le compteur de fin du dernier jour saisi.
function lastKmEnd(before) {
  let best = null;
  S.days.forEach((d, date) => { if (date < before && typeof d.kmEnd === "number" && (!best || date > best.date)) best = { date, km: d.kmEnd }; });
  return best;
}
function openKm() {
  const f = CH_FIELDS.find(x => x.k === "km"), day = S.days.get(curDate) || {}, cur = v(day, "km");
  const prev = lastKmEnd(curDate);
  const startVal = typeof day.kmStart === "number" ? day.kmStart : prev ? prev.km : "";
  const pd = prev && typeof day.kmStart !== "number" ? fromIso(prev.date) : null;
  openSheet(`
      <h3>Kilomètres</h3>
      <div class="cur">${esc(cap(fromIso(curDate).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })))} · déjà saisi : ${cur ? cur.toLocaleString("fr-FR") + " km" : "rien"}</div>
      <div class="pair-lbl">Compteur début${pd ? ` <span class="hint">· fin du ${pad(pd.getDate())}/${pad(pd.getMonth() + 1)}</span>` : ""}</div>
      <input id="kStart" type="text" inputmode="numeric" autocomplete="off" placeholder="ex. 152 340" value="${startVal}">
      <div class="pair-lbl">Compteur fin</div>
      <input id="kEnd" type="text" inputmode="numeric" autocomplete="off" placeholder="à la fin de la journée" value="${typeof day.kmEnd === "number" ? day.kmEnd : ""}">
      <div class="calc" id="kCalc"><span>Distance</span><span>—</span></div>
      <div class="pair-lbl">Ou nombre de km</div>
      <input id="amt" type="text" inputmode="decimal" autocomplete="off" placeholder="ex. 180">
      <div class="row"><button class="btn primary" id="add">＋ Ajouter</button><button class="btn ghost" id="set">Remplacer</button></div>`);
  const num = id => { const t = $(id).value.trim(); if (t === "") return null; const n = parse(t); return isFinite(n) ? n : NaN; };
  const calc = () => {
    const a = num("kStart"), b = num("kEnd");
    if (a == null || b == null || isNaN(a) || isNaN(b)) { $("kCalc").innerHTML = `<span>Distance</span><span>${a != null && b == null ? "en attente du compteur fin" : "—"}</span>`; return; }
    if (b < a) { $("kCalc").innerHTML = `<span>Distance</span><span class="neg">fin plus petite que début</span>`; return; }
    $("kCalc").innerHTML = `<span class="big">Distance</span><span class="big">${(b - a).toLocaleString("fr-FR")} km</span>`;
    $("amt").value = String(r2(b - a)).replace(".", ",");
  };
  $("kStart").oninput = calc; $("kEnd").oninput = calc;
  const save = async mode => {
    const a = num("kStart"), b = num("kEnd");
    if ((a != null && isNaN(a)) || (b != null && isNaN(b))) { toast("Compteur : tape un nombre", true); return; }
    if (a != null && b != null && b < a) { toast("Le compteur fin doit être plus grand que le début", true); return; }
    const d = Object.assign({ date: curDate }, S.days.get(curDate) || {});
    if (a != null) d.kmStart = a; else delete d.kmStart;
    if (b != null) d.kmEnd = b; else delete d.kmEnd;
    const raw = $("amt").value.trim(); let msg;
    if (raw !== "") {
      const n = parse(raw); if (!isFinite(n)) { toast("Tape un nombre", true); return; }
      const next = r2(mode === "set" ? n : v(d, "km") + n);
      if (next === 0) delete d.km; else d.km = next;
      msg = mode === "set" ? `Km : ${next.toLocaleString("fr-FR")} km` : `Km +${n.toLocaleString("fr-FR")}`;
    } else if (a != null) msg = `Compteur début ${a.toLocaleString("fr-FR")} enregistré`;
    else { toast("Tape le compteur ou un nombre de km", true); return; }
    try {
      if (Object.keys(d).length === 1) { await del("days", curDate); S.days.delete(curDate); }
      else { await put("days", d); S.days.set(curDate, d); }
      closeSheet(); renderJour(); toast(msg); setTimeout(() => entNotify().catch(() => {}), 2500);
    } catch (e) { toast("Enregistrement impossible : " + (e && e.message || e), true); }
  };
  $("add").onclick = () => save("add");
  $("set").onclick = () => save("set");
  calc();
}

function openField(k) {
  if (k === "heures") return openHours();
  if (k === "km") return openKm();
  const f = allFields().find(x => x.k === k); if (!f) return; const cur = DAY_DEP[k] ? dayVal(curDate, k) : v(S.days.get(curDate), k);
  const curTxt = f.unit ? (cur ? cur + " " + f.unit : "rien") : (cur ? eur(cur) : "rien");
  openSheet(`
      <h3>${f.t}</h3>
      <div class="cur">${esc(cap(fromIso(curDate).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })))} · déjà saisi : ${curTxt}</div>
      <input id="amt" type="text" inputmode="decimal" autocomplete="off" placeholder="${f.unit === "h" ? "Nombre d'heures" : f.unit === "km" ? "Nombre de km" : "Montant en €"}">
      ${f.chips ? `<div class="chips">${f.chips.map(c => `<button class="chip" data-v="${c}">${c} €</button>`).join("")}</div>` : ""}
      <div class="row"><button class="btn primary" id="add">＋ Ajouter</button><button class="btn ghost" id="set">Remplacer</button></div>`, "amt");
  $("sheet").querySelectorAll(".chip").forEach(c => (c.onclick = () => ($("amt").value = c.dataset.v)));
  $("add").onclick = () => saveField(f, "add");
  $("set").onclick = () => saveField(f, "set");
}
// Carburant / repas saisis dans l'onglet Jour → dépense du jour « carb-AAAA-MM-JJ » / « repas-AAAA-MM-JJ »
async function saveDayDep(f, mode, n) {
  const { cat, pre } = DAY_DEP[f.k], id = pre + curDate, ex = S.deps.find(x => x.id === id);
  const day = Object.assign({ date: curDate }, S.days.get(curDate) || {}), legacy = v(day, f.k);
  const others = depOn(curDate, cat) - (ex ? ex.montant : 0), total = legacy + (ex ? ex.montant : 0) + others;
  const next = r2(mode === "set" ? n : total + n), amt = r2(next - others);
  try {
    if (legacy) { delete day[f.k]; if (Object.keys(day).length === 1) { await del("days", curDate); S.days.delete(curDate); } else { await put("days", day); S.days.set(curDate, day); } }
    if (amt > 0) {
      const rec = { ...(ex || {}), id, date: curDate, cat, grp: catGrp(cat), desc: ex ? ex.desc : catLbl(cat), montant: amt };
      await put("depenses", rec); S.deps = S.deps.filter(x => x.id !== id).concat(rec).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    } else if (ex) { await del("depenses", id); S.deps = S.deps.filter(x => x.id !== id); }
    closeSheet(); renderAll();
    toast(mode === "set" ? `${f.t} : ${eur(Math.max(next, others))}` : `${f.t} +${eur(n)}`);
  } catch (e) { toast("Enregistrement impossible : " + (e && e.message || e), true); }
}
async function saveField(f, mode) {
  let raw, n;
  if ($("hH")) { // heures saisies en h + min
    const hh = $("hH").value.trim(), mm = $("hM").value.trim();
    raw = hh + mm; n = r2(((hh === "" ? 0 : +hh) * 60 + (mm === "" ? 0 : +mm)) / 60);
    if (raw !== "" && (!/^\d*$/.test(hh) || !/^\d*$/.test(mm) || +mm > 59)) { toast("Minutes entre 0 et 59", true); return; }
  } else { raw = $("amt").value.trim(); n = parse(raw); }
  if (raw === "" || !isFinite(n)) { toast("Tape un nombre", true); return; }
  if (f.k === "heures" && S.meta.shiftStart && S.meta.shiftStart.date === curDate) await setMeta("shiftStart", undefined);
  if (DAY_DEP[f.k]) return saveDayDep(f, mode, n);
  const day = Object.assign({ date: curDate }, S.days.get(curDate) || {});
  const next = r2(mode === "set" ? n : v(day, f.k) + n);
  if (next === 0) delete day[f.k]; else day[f.k] = next;
  try {
    if (Object.keys(day).length === 1) { await del("days", curDate); S.days.delete(curDate); }
    else { await put("days", day); S.days.set(curDate, day); }
    closeSheet(); renderJour();
    const u = x => f.k === "heures" ? fmtH(x) : f.unit ? x + " " + f.unit : eur(x);
    toast(mode === "set" ? `${f.t} : ${u(next)}` : `${f.t} +${u(n)}`);
  } catch (e) { toast("Enregistrement impossible : " + (e && e.message || e), true); }
}
