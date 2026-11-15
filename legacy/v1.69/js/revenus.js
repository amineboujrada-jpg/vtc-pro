// VTC Rentable — Revenus hebdomadaires (virements)
"use strict";

// ---------- Virements ----------
// Une semaine n'apparaît dans Virements qu'une fois terminée (le lundi qui suit son dimanche)
const weekEnded = w => { const r = weekRange(w); return !!r && iso(r.sun) < todayIso(); };
function weekList() {
  const prev = weekKeyOf(addDays(new Date(), -7)); // dernière semaine terminée
  const map = new Map(S.weeks);
  const id = weekId(prev);
  if (!map.has(id)) map.set(id, { id, y: prev.y, m: prev.m, s: prev.s, caP: {}, cashP: {}, recu: false, _new: true });
  // semaine en cours : visible dès qu'il y a de l'activité dans le Journal (comme la ligne de rattachement)
  const cur = weekKeyOf(new Date()), cid = weekId(cur), curActive = periodTotals(iso(cur.mon), iso(cur.sun)).ca > 0;
  if (curActive && !map.has(cid)) map.set(cid, { id: cid, y: cur.y, m: cur.m, s: cur.s, caP: {}, cashP: {}, recu: false, _new: true });
  return [...map.values()].filter(w => weekEnded(w) || (w.id === cid && curActive)).sort((a, b) => (b.y * 1000 + b.m * 10 + b.s) - (a.y * 1000 + a.m * 10 + a.s));
}
// Dates d'une semaine Virements (mois + S), avec la même règle que weekKeyOf
function weekRange(w) {
  for (let d = 7 * (w.s - 1) + 1; d <= 7 * w.s; d++) { // ancienne règle : le dimanche du mois
    const sun = new Date(w.y, w.m - 1, d);
    if (sun.getMonth() === w.m - 1 && sun.getDay() === 0 && iso(sun) < WEEK_RULE_CHANGE) return { mon: addDays(sun, -6), sun };
  }
  for (let d = 7 * (w.s - 1) + 1; d <= 7 * w.s; d++) { // nouvelle règle : le jeudi du mois
    const thu = new Date(w.y, w.m - 1, d);
    if (thu.getMonth() === w.m - 1 && thu.getDay() === 4 && iso(addDays(thu, 3)) >= WEEK_RULE_CHANGE) return { mon: addDays(thu, -3), sun: addDays(thu, 3) };
  }
  return null;
}
// Total par plateforme saisi dans le Journal pour la semaine
function journalWeekCa(w) {
  const r = weekRange(w), t = Object.fromEntries(allPlats().map(p => [p.k, 0])); if (!r) return t;
  const from = iso(r.mon), to = iso(r.sun);
  S.days.forEach(d => { if (d.date >= from && d.date <= to) allPlats().forEach(p => (t[p.k] += v(d, p.k))); });
  Object.keys(t).forEach(k => (t[k] = r2(t[k]))); return t;
}
const wkName = w => `${cap(MOIS[w.m - 1])} ${w.y} · S${w.s}`;
// Frais de rattachement : ajoutés automatiquement aux dépenses quand la semaine a un CA
async function ensureRattachement(w) {
  const c = weekCalc(w);
  if (c.ca <= 0 || !(c.frais > 0)) return null;
  const label = `${ratName()} S${w.s} ${MOIS[w.m - 1]} ${w.y}`;
  const id = "rat-" + w.id;
  if (cfg().skip.includes(id)) return null;
  const dep = S.deps.find(x => x.id === id) ||
    S.deps.find(x => x.cat === "Rattachement" && (x.desc || "").trim().toLowerCase() === label.toLowerCase());
  if (dep && dep.montant === c.frais) return null; // déjà présente
  const rg = weekRange(w);
  const rec = dep ? { ...dep, montant: c.frais } : { id, date: rg ? iso(rg.sun) : todayIso(), cat: "Rattachement", desc: label, montant: c.frais, auto: true };
  await put("depenses", rec);
  S.deps = S.deps.filter(x => x.id !== rec.id).concat(rec).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  return dep ? null : rec;
}
// Plateformes affichées dans une semaine : celles cochées + celles qui ont déjà un montant
const virPlats = (w, jca) => { const ca = wkVals(w, "ca"), cs = wkVals(w, "cash"), c = cfg();
  return allPlats().filter(p => c.plats[p.k] || ca[p.k] > 0 || cs[p.k] > 0 || (jca && jca[p.k] > 0)); };
let wkFilter = "all";
const WK_FILTERS = [["all", "Tout"], ["todo", "À compléter"], ["wait", "En attente"], ["ok", "Reçu"]];
const wkMatches = (x, f) => { const r = recvState(x.w, x.c);
  return f === "all" || (f === "todo" ? x.c.ca <= 0 : f === "wait" ? x.c.ca > 0 && !r.all : f === "ok" ? x.c.ca > 0 && r.all : true); };
function renderVir() {
  $("virTitle").textContent = ratOn() ? `Revenus hebdomadaires · ${ratName()}` : "Revenus hebdomadaires";
  const box = $("wks"); box.innerHTML = "";
  const current = weekKeyOf(new Date()), curId = weekId(current);
  const entries = weekList().slice(0, 30).map(w => ({ w, c: weekCalc(w) }));
  if (!entries.length) { $("wkTotals").innerHTML = ""; $("wkFilters").innerHTML = ""; return; }
  // Totaux : toutes les semaines, quel que soit le filtre
  const recvAll = entries.reduce((a, x) => a + recvState(x.w, x.c).recv, 0);
  const pendAll = entries.reduce((a, x) => a + recvState(x.w, x.c).rest, 0);
  const todoAll = entries.filter(x => x.c.ca <= 0).length;
  $("wkTotals").innerHTML = `<div class="kpi"><div class="lbl">Reçu</div><div class="v">${eur0(recvAll)}</div></div>
      <div class="kpi"><div class="lbl">À recevoir</div><div class="v">${eur0(pendAll)}</div></div>
      <div class="kpi" style="grid-column:span 2"><div class="lbl">Semaines à compléter</div><div class="v">${todoAll}</div></div>`;
  const fbox = $("wkFilters"); fbox.innerHTML = "";
  WK_FILTERS.forEach(([k, label]) => {
    const fb = document.createElement("button"); fb.type = "button"; fb.className = "wk-chip";
    fb.textContent = label; fb.setAttribute("aria-pressed", String(wkFilter === k));
    fb.onclick = () => { wkFilter = k; renderVir(); };
    fbox.appendChild(fb);
  });
  const shown = entries.filter(x => wkMatches(x, wkFilter));
  if (!shown.length) {
    const p = document.createElement("div"); p.style.cssText = "color:var(--muted);font-size:13px;padding:8px 2px";
    p.textContent = "Aucune semaine dans ce filtre."; box.appendChild(p); return;
  }
  const defaultYear = shown.some(x => x.w.y === current.y && x.w.m === current.m) ? current.y : shown[0].w.y;
  const makeGroup = (className, label, items, open, withCount) => {
    const received = items.reduce((sum, x) => sum + recvState(x.w, x.c).recv, 0);
    const pending = items.reduce((sum, x) => sum + recvState(x.w, x.c).rest, 0);
    const incomplete = items.filter(x => x.c.ca <= 0).length;
    const details = document.createElement("details"); details.className = className; details.open = open;
    const summary = document.createElement("summary"), title = document.createElement("span"), total = document.createElement("span");
    title.textContent = label;
    total.className = "wk-group-total";
    const parts = [];
    if (withCount) parts.push(`${items.length} semaine${items.length > 1 ? "s" : ""}`);
    if (received) parts.push(`reçu ${eur0(received)}`);
    if (pending) parts.push(`à recevoir ${eur0(pending)}`);
    if (incomplete) parts.push(`${incomplete} à compléter`);
    total.textContent = parts.join(" · ");
    summary.append(title, total); details.appendChild(summary);
    return details;
  };
  const years = new Map();
  shown.forEach(entry => {
    if (!years.has(entry.w.y)) years.set(entry.w.y, []);
    years.get(entry.w.y).push(entry);
  });
  years.forEach((yearItems, year) => {
    const yearGroup = makeGroup("wk-year", String(year), yearItems, year === defaultYear, false);
    const months = new Map();
    yearItems.forEach(entry => {
      if (!months.has(entry.w.m)) months.set(entry.w.m, []);
      months.get(entry.w.m).push(entry);
    });
    const defaultMonth = year === current.y && months.has(current.m) ? current.m : yearItems[0].w.m;
    const monthGroups = document.createElement("div"); monthGroups.className = "wk-months";
    months.forEach((monthItems, month) => {
      const isCurrentMonth = year === current.y && month === current.m;
      const monthGroup = makeGroup("wk-month", cap(MOIS[month - 1]), monthItems, isCurrentMonth || (year === defaultYear && month === defaultMonth), true);
      const monthList = document.createElement("div"); monthList.className = "wk-month-list";
      monthItems.forEach(({ w, c }) => {
        const filled = c.ca > 0, isCur = w.id === curId, rv = recvState(w, c), partial = filled && rv.tot > 1 && rv.n > 0 && !rv.all;
        const b = document.createElement("button");
        b.className = "wk" + (isCur ? " current" : "") + (filled ? "" : " empty");
        b.innerHTML = `<span class="wk-bar"></span>
            <span class="wk-main"><span class="name"></span><span class="per"></span><span class="wk-breakdown"></span></span>
            <span class="wk-side"><span class="wk-amount-label"></span><span class="amt"></span><span class="wk-state"></span></span>
            <span class="wk-chevron" aria-hidden="true">›</span>`;
        const stateKey = isCur ? "cur" : !filled ? "empty" : rv.all ? "ok" : "wait";
        b.querySelector(".wk-bar").classList.add(stateKey);
        b.querySelector(".name").textContent = wkName(w);
        const rg = weekRange(w), dates = rg ? `Du ${rg.mon.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} au ${rg.sun.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}` : "";
        b.querySelector(".per").textContent = dates;
        b.querySelector(".wk-breakdown").textContent = filled
          ? `CA ${eur0(c.ca)} · cash ${eur0(c.cash)}${c.frais > 0 ? ` · frais ${eur0(c.frais)}` : ""}${virParPlat() && rv.tot > 1 ? ` · ${rv.n}/${rv.tot} reçus` : ""}`
          : "Montants à compléter";
        b.querySelector(".wk-amount-label").textContent = filled ? (partial ? "Reste à recevoir" : "À recevoir") : "Virement estimé";
        const amount = b.querySelector(".amt"); amount.textContent = filled ? eur(partial ? rv.rest : c.vir) : "—";
        amount.classList.toggle("neg", c.vir < 0);
        const status = b.querySelector(".wk-state");
        status.textContent = isCur ? "En cours" : !filled ? "À compléter" : rv.all ? "Reçu" : partial ? "Partiel" : "En attente";
        status.classList.add(stateKey);
        b.onclick = () => openVir(w); monthList.appendChild(b);
      });
      monthGroup.appendChild(monthList); monthGroups.appendChild(monthGroup);
    });
    yearGroup.appendChild(monthGroups); box.appendChild(yearGroup);
  });
}
function openVir(w) {
  const val = x => (x ? String(x).replace(".", ",") : "");
  const jca = journalWeekCa(w), rg = weekRange(w), ps = virPlats(w, jca);
  const mon = rg ? rg.mon : monday(new Date());
  const activity = weekDetail(mon), previousActivity = weekDetail(addDays(mon, -7));
  const best = activity.days.filter(d => d.r > 0).sort((a, b) => b.r - a.r)[0];
  const wca = wkVals(w, "ca"), wcs = wkVals(w, "cash");
  const empty = !Object.values(wca).some(x => x > 0);
  const caVals = wca; // pas de valeur par défaut : on tape les montants du relevé (le Journal reste proposé en bouton)
  const jHas = ps.some(p => jca[p.k] > 0), jDiff = ps.some(p => r2(jca[p.k] || 0) !== r2(wca[p.k] || 0));
  const inp = (id, x) => `<input id="${id}" type="text" inputmode="decimal" autocomplete="off" value="${val(x)}" placeholder="0">`;
  const fees = ratOn();
  openSheet(`
      <h3>${wkName(w)}</h3>
      <div class="cur">${rg ? `Du lundi ${pad(rg.mon.getDate())}/${pad(rg.mon.getMonth() + 1)} au dimanche ${pad(rg.sun.getDate())}/${pad(rg.sun.getMonth() + 1)} · ${activity.jours} jour${activity.jours > 1 ? "s" : ""} travaillé${activity.jours > 1 ? "s" : ""}` : "Montants de tes relevés de plateformes"}</div>
      <div class="pair-lbl">Revenus de la semaine</div>
      <div class="wkpis transfer-kpis">
        <div class="kpi"><div class="lbl">CA plateformes</div><div class="v" id="virKpiCa"></div></div>
        <div class="kpi"><div class="lbl">Cash encaissé</div><div class="v" id="virKpiCash"></div></div>
        <div class="kpi"><div class="lbl">Frais</div><div class="v" id="virKpiFees"></div></div>
        <div class="kpi"><div class="lbl">À recevoir</div><div class="v" id="virKpiTransfer"></div></div>
      </div>
      ${ps.length ? "" : `<div class="cur">Aucune plateforme cochée : choisis tes plateformes dans Réglages → Mon activité.</div>`}
      <div class="pair-lbl">Chiffre d'affaires</div>
      <div class="pair">${ps.map(p => `<div><small>${esc(p.t)}</small>${inp("ca-" + p.k, caVals[p.k])}</div>`).join("")}</div>
      ${jHas && (empty || jDiff) ? `<button class="linkbtn" id="fromJournal">↻ Reprendre le Journal : ${ps.map(p => `${esc(p.t)} ${eur(jca[p.k] || 0)}`).join(" · ")}</button>` : ""}
      <div class="pair-lbl">Cash encaissé</div>
      <div class="pair">${ps.map(p => `<div><small>${esc(p.t)}</small>${inp("cs-" + p.k, wcs[p.k])}</div>`).join("")}</div>
      <div class="transfer-calc" id="calc"></div>
      <div class="pair-lbl">Bilan d'activité · Journal</div>
      ${kpiBlock(activity, previousActivity, "sem. préc.")}
      <div class="pair-lbl">Détail jour par jour${best ? ` <span class="hint">· meilleur : ${dayName(best.date)} ${eur0(best.r)}</span>` : ""}</div>
      <div class="tbl-wrap"><table><thead><tr><th>Jour</th><th>CA</th><th>Heures</th><th>Km</th><th>€/h</th></tr></thead><tbody>
        ${activity.days.map(d => `<tr${d.r ? "" : ' class="off"'} data-date="${d.date}"><td>${dayName(d.date)} ${d.date.slice(8)}</td><td>${d.r ? eur0(d.r) : "–"}</td><td>${d.h ? fmtH(d.h) : "–"}</td><td>${d.km ? Math.round(d.km) : "–"}</td><td>${d.h ? Math.round(d.r / d.h) + " €" : "–"}</td></tr>`).join("")}
      </tbody></table></div>
      <div class="row" style="margin-top:14px"><button class="btn ghost" id="pPrev">‹ Semaine préc.</button><button class="btn ghost" id="pNext"${iso(addDays(mon, 7)) > todayIso() ? " disabled" : ""}>Semaine suiv. ›</button></div>
      ${virParPlat() ? `<div class="pair-lbl">Virements reçus <span class="hint">· coche chaque plateforme dont le virement est arrivé</span></div><div id="platRecu" class="plat-recu"></div>`
      : `<button class="toggle" id="recu" aria-pressed="${!!w.recu}"><span>Virement reçu</span><span class="sw"></span></button>`}
      <button class="btn primary" id="saveVir" style="width:100%">Enregistrer</button>`);
  const g = id => { const n = parse($(id).value); return isFinite(n) ? n : 0; };
  const chk = {}; ps.forEach(p => (chk[p.k] = platRecu(w, p.k))); // cases « reçu » par plateforme (statuts autres que rattaché)
  const draft = () => { const caP = {}, cashP = {};
    ps.forEach(p => { caP[p.k] = r2(g("ca-" + p.k)); cashP[p.k] = r2(g("cs-" + p.k)); });
    const d = { ...w, caP, cashP };
    if (typeof w.frais !== "number") { if (!w.caP && !w._new) d.frais = 50; else delete d.frais; } // ancienne semaine : tarif d'origine
    return d; };
  const upd = () => {
    const d = draft(), c = weekCalc(d);
    const platformRows = ps.map(p => {
      const ca = Number(d.caP[p.k]) || 0, cash = Number(d.cashP[p.k]) || 0;
      return ca || cash ? `<div class="transfer-platform"><span>${esc(p.t)}</span><span>CA ${eur(ca)} · cash ${eur(cash)} · reste ${eur(r2(ca - cash))}</span></div>` : "";
    }).join("");
    $("virKpiCa").textContent = eur(c.ca);
    $("virKpiCash").textContent = eur(c.cash);
    $("virKpiFees").textContent = eur(c.frais);
    $("virKpiTransfer").textContent = eur(c.vir);
    $("virKpiTransfer").classList.toggle("neg", c.vir < 0);
    $("calc").innerHTML = `<div class="calc-lines"><span>Chiffre d'affaires</span><b>${eur(c.ca)}</b>
        <span>Cash encaissé à déduire</span><b>− ${eur(c.cash)}</b>
        ${fees || c.frais > 0 ? `<span>Frais ${esc(ratName())}</span><b>− ${eur(c.frais)}</b>` : ""}
        </div><div class="transfer-result"><span>Virement estimé</span><strong class="${c.vir < 0 ? "neg" : ""}">${eur(c.vir)}</strong></div>
        <div class="transfer-formula">CA des plateformes − cash encaissé${fees || c.frais > 0 ? " − frais" : ""} = montant estimé à recevoir.</div>
        <div class="transfer-platforms"><b>Détail par plateforme</b>${platformRows || `<div class="cur">Aucun montant saisi.</div>`}</div>`;
    if (virParPlat()) { // une case par plateforme qui doit verser quelque chose
      const due = platDues(d), box = $("platRecu");
      box.innerHTML = due.length ? due.map(k => { const p = ps.find(x => x.k === k); return `<label class="plat-chk"><input type="checkbox" data-k="${k}"${chk[k] ? " checked" : ""}><span>${esc(p.t)}</span><b>${eur(platVir(d, k))}</b></label>`; }).join("")
        : `<div class="cur">Saisis le chiffre d'affaires par plateforme : une case apparaît pour chaque virement à recevoir.</div>`;
      box.querySelectorAll("input").forEach(i => (i.onchange = () => { chk[i.dataset.k] = i.checked; }));
    }
  };
  $("sheet").querySelectorAll(".pair input").forEach(i => (i.oninput = upd)); upd();
  const adjacent = offset => {
    const key = weekKeyOf(addDays(mon, offset * 7)), id = weekId(key);
    return S.weeks.get(id) || { id, y: key.y, m: key.m, s: key.s, caP: {}, cashP: {}, recu: false, _new: true };
  };
  $("pPrev").onclick = () => openVir(adjacent(-1));
  $("pNext").onclick = () => { if (iso(addDays(mon, 7)) <= todayIso()) openVir(adjacent(1)); };
  if ($("fromJournal")) $("fromJournal").onclick = () => { ps.forEach(p => ($("ca-" + p.k).value = val(jca[p.k]))); $("fromJournal").remove(); upd(); };
  if ($("recu")) $("recu").onclick = () => $("recu").setAttribute("aria-pressed", $("recu").getAttribute("aria-pressed") === "true" ? "false" : "true");
  $("saveVir").onclick = async () => {
    const bad = [...$("sheet").querySelectorAll(".pair input")].some(i => i.value.trim() !== "" && !isFinite(parse(i.value)));
    if (bad) { toast("Un montant n'est pas un nombre", true); return; }
    const d = draft(); delete d._new;
    if (virParPlat()) { const due = platDues(d); d.recuP = Object.fromEntries(due.map(k => [k, !!chk[k]])); d.recu = due.length > 0 && due.every(k => chk[k]); }
    else d.recu = $("recu").getAttribute("aria-pressed") === "true";
    if (typeof d.frais !== "number") d.frais = weekCalc(d).frais; // le prix du rattachement de cette semaine reste figé
    // copie Uber / Bolt / Heetch dans l'ancien format, lu par le Google Sheets
    d.ca = LEGACY_VIR.map(k => d.caP[k] || 0); d.cash = LEGACY_VIR.map(k => d.cashP[k] || 0);
    try {
      await put("weeks", d); S.weeks.set(d.id, d);
      const added = await ensureRattachement(d);
      closeSheet(); renderVir();
      toast(`Enregistré · virement ${eur(weekCalc(d).vir)}` + (added ? ` · ${eur(added.montant)} ${ratName()} ajouté aux dépenses` : ""));
    }
    catch (e) { toast("Enregistrement impossible", true); }
  };
  bindDetail(() => openVir(w));
}
