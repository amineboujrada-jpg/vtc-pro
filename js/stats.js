// VTC Rentable — Détail des périodes, graphiques et statistiques
"use strict";

// ---------- Détail d'une période (semaine ou mois) avec indicateurs ----------
function periodDetail(start, end) {
  const from = iso(start), to = iso(end);
  const w = { from, to, ca: 0, plat: Object.fromEntries(recKeys().map(k => [k, 0])), carb: 0, repas: 0, autres: 0,
    h: 0, hNet: 0, hCa: 0, hDays: 0, km: 0, kmCa: 0, kmCarb: 0, bothH: 0, bothKm: 0, jours: 0, days: [] };
  for (let dt = new Date(start); iso(dt) <= to; dt = addDays(dt, 1)) {
    const date = iso(dt), d = S.days.get(date);
    const r = recettes(d), h = v(d, "heures"), km = v(d, "km"), c = dayVal(date, "carburant"), re = dayVal(date, "repas");
    Object.keys(w.plat).forEach(k => (w.plat[k] += v(d, k)));
    w.ca += r; w.carb += c; w.repas += re;
    if (r > 0) w.jours++;
    if (h > 0) { w.h += h; w.hCa += r; w.hDays++; }
    if (km > 0) { w.km += km; w.kmCa += r; }
    if (h > 0 && km > 0) { w.bothH += h; w.bothKm += km; } // vitesse : seulement les jours avec heures ET km
    w.days.push({ date, r, h, km, c, re });
  }
  S.deps.forEach(x => { if (x.cat !== "Démarrage" && !DAY_DEP_CATS.includes(x.cat)) w.autres += depShare(x, from, to); });
  // Un plein sert plusieurs jours : carburant et repas sont rapportés à la période, pas au jour
  w.hNet = w.hCa - (w.ca ? (w.carb + w.repas) * w.hCa / w.ca : 0);
  w.kmCarb = w.ca ? w.carb * w.kmCa / w.ca : 0;
  w.charges = w.carb + w.repas + w.autres; w.net = w.ca - w.charges;
  return w;
}
const weekDetail = mon => periodDetail(mon, addDays(mon, 6));
const monthStart = d => new Date(d.getFullYear(), d.getMonth(), 1);
const monthEnd = d => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const n2 = x => x.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n1 = x => x.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const dayName = date => JOURS[(fromIso(date).getDay() + 6) % 7];
// Indicateurs communs (w = période, p = période précédente pour comparer)
// Coût de la voiture sur la période (achat : km × coût au km ; location : loyer déjà dans les charges)
function carBlock(w, k) {
  if (hasCars()) {
    const cost = carCost(w.from, w.to), car = carAt(w.to > todayIso() ? todayIso() : w.to) || carsSorted()[0], ded = cfg().vehicule.deduire;
    if (!(cost > 0)) return k("Coût de la voiture", "–", `${esc(car.nom || "Voiture")} · hors période d'utilisation`);
    const list = carsSorted(), names = list.filter((x, i) => { const nx = list[i + 1]; return x.date <= w.to && (!nx || nx.date > w.from); }).map(x => esc(x.nom || "Voiture"));
    const sub = [names.join(" puis ") || esc(car.nom || "Voiture"), w.ca ? pct(cost, w.ca) + " % du CA" : "", w.km ? n2(cost / w.km) + " €/km" : "", ded ? "" : "non déduit du net"].filter(Boolean).join(" · ");
    return k("Coût de la voiture", eur0(cost), sub) + (ded ? k("Net après voiture", eur0(w.net - cost), "revenu net − coût de la voiture") : "");
  }
  if (enLocation()) { const loc = S.deps.filter(x => x.cat === "Location voiture").reduce((a, x) => a + depShare(x, w.from, w.to), 0);
    return k("Location de la voiture", eur0(loc), (w.ca ? pct(loc, w.ca) + " % du CA" : "") + (w.km && loc ? " · " + n2(loc / w.km) + " €/km" : "") + (assurInLoc() ? " · assurance incluse" : "")); }
  return "";
}
function kpiBlock(w, p, cmp, extra) {
  const litre = Number(S.meta.prixLitre) > 0 ? Number(S.meta.prixLitre) : null;
  const L = litre && w.carb ? w.carb / litre : null;
  const evo = (a, b) => { if (!b) return ""; const d = a - b, up = d >= 0;
    return `<small class="evo ${up ? "up" : "down"}">${up ? "▲" : "▼"} ${eur0(Math.abs(d))} vs ${cmp}</small>`; };
  const k = (lbl, val, sub) => `<div class="kpi"><div class="lbl">${lbl}</div><div class="v">${val}</div>${sub ? `<small>${sub}</small>` : ""}</div>`;
  return `
      <div class="wkpis">
        <div class="kpi main"><div class="lbl">Revenu net</div><div class="v${w.net < 0 ? " neg" : ""}">${eur(r2(w.net))}</div>${evo(w.net, p.net)}</div>
        ${extra || ""}
        ${k("Chiffre d'affaires", eur0(w.ca), evo(w.ca, p.ca))}
        ${k("Charges", eur0(w.charges), w.ca ? pct(w.charges, w.ca) + " % du CA" : "")}
        ${k("€ / heure", w.h ? n2(w.hCa / w.h) + " €" : "–", w.h ? "après carburant et repas : " + n2(w.hNet / w.h) + " €/h" : "Saisis tes heures")}
        ${k("Heures de travail", w.h ? fmtH(w.h) : "–", w.hDays ? "≈ " + fmtH(w.h / w.hDays) + " / jour" + (w.hDays < w.jours ? ` (${w.hDays} j. saisis)` : "") : "")}
        ${k("€ / km", w.km ? n2(w.kmCa / w.km) + " €" : "–", w.km ? "net carburant " + n2((w.kmCa - w.kmCarb) / w.km) + " €/km" : "Saisis tes km")}
        ${k("Kilomètres", w.km ? Math.round(w.km).toLocaleString("fr-FR") + " km" : "–", w.bothH ? "≈ " + Math.round(w.bothKm / w.bothH) + " km/h" : "")}
        ${carBlock(w, k)}
        ${k("Carburant", eur0(w.carb), w.ca ? pct(w.carb, w.ca) + " % du CA" : "")}
        ${k("CA pour 1 € de carburant", w.carb ? n2(w.ca / w.carb) + " €" : "–", "")}
        ${litre ? k("Revenu par litre", L ? n2(w.ca / L) + " €" : "–", L ? `${n1(L)} L à ${n2(litre)} €` : "") : ""}
        ${litre && w.km && L ? k("Consommation", n1(L / w.km * 100) + " L/100", "estimée") : ""}
        ${k("Net / jour", w.jours ? eur0(w.net / w.jours) : "–", w.jours ? "CA " + eur0(w.ca / w.jours) + " / jour" : "")}
      </div>
      ${litre ? "" : `<button class="linkbtn" id="setLitre">⛽ Indiquer le prix du litre pour voir le revenu par litre</button>`}
      <div class="pair-lbl" style="margin-top:14px">Par plateforme</div>
      <div class="calc">${platRows(w.plat).map(([n, s]) => `<span>${esc(n)} <small>${pct(s, w.ca)} %</small></span><span>${eur(r2(s))}</span>`).join("") || "<span>Aucune recette</span><span></span>"}</div>
      <div class="pair-lbl">Charges</div>
      <div class="calc"><span>Carburant</span><span>${eur(r2(w.carb))}</span><span>Repas / café</span><span>${eur(r2(w.repas))}</span><span>Autres dépenses</span><span>${eur(r2(w.autres))}</span></div>`;
}
function bindDetail(reopen) {
  $("sheet").insertAdjacentHTML("beforeend", `<button class="btn primary" id="pClose" style="width:100%;margin-top:10px">Fermer</button>`);
  $("pClose").onclick = closeSheet;
  $("sheet").querySelectorAll("tr[data-date]").forEach(tr => (tr.onclick = () => { curDate = tr.dataset.date; closeSheet(); showTab("jour"); }));
  $("sheet").querySelectorAll("tr[data-mon]").forEach(tr => (tr.onclick = () => openWeekDetail(fromIso(tr.dataset.mon))));
  if ($("setLitre")) $("setLitre").onclick = () => openLitre(reopen);
}
function openWeekDetail(mon) {
  mon = monday(mon);
  const w = weekDetail(mon), p = weekDetail(addDays(mon, -7));
  const best = w.days.filter(d => d.r > 0).sort((a, b) => b.r - a.r)[0];
  const sun = addDays(mon, 6), key = weekKeyOf(mon);
  openSheet(`
      <h3>Semaine du ${pad(mon.getDate())}/${pad(mon.getMonth() + 1)} au ${pad(sun.getDate())}/${pad(sun.getMonth() + 1)}</h3>
      <div class="cur">${cap(MOIS[key.m - 1])} ${key.y} · S${key.s} · ${w.jours} jour${w.jours > 1 ? "s" : ""} travaillé${w.jours > 1 ? "s" : ""}</div>
      ${kpiBlock(w, p, "sem. préc.")}
      <div class="pair-lbl">Jour par jour${best ? ` <span class="hint">· meilleur : ${dayName(best.date)} ${eur0(best.r)}</span>` : ""}</div>
      <div class="tbl-wrap"><table><thead><tr><th>Jour</th><th>CA</th><th>Heures</th><th>Km</th><th>€/h</th></tr></thead><tbody>
      ${w.days.map(d => `<tr${d.r ? "" : ' class="off"'} data-date="${d.date}"><td>${dayName(d.date)} ${d.date.slice(8)}</td><td>${d.r ? eur0(d.r) : "–"}</td><td>${d.h ? fmtH(d.h) : "–"}</td><td>${d.km ? Math.round(d.km) : "–"}</td><td>${d.h ? Math.round(d.r / d.h) + " €" : "–"}</td></tr>`).join("")}
      </tbody></table></div>
      <div class="row" style="margin-top:14px"><button class="btn ghost" id="pPrev">‹ Semaine préc.</button><button class="btn ghost" id="pNext"${iso(addDays(mon, 7)) > todayIso() ? " disabled" : ""}>Semaine suiv. ›</button></div>`);
  $("pPrev").onclick = () => openWeekDetail(addDays(mon, -7));
  $("pNext").onclick = () => { if (iso(addDays(mon, 7)) <= todayIso()) openWeekDetail(addDays(mon, 7)); };
  bindDetail(() => openWeekDetail(mon));
}
function openMonthDetail(d) {
  const ms = monthStart(d), me = monthEnd(d), today = todayIso();
  const isCur = iso(ms) <= today && today <= iso(me);
  const nbDays = me.getDate(), passed = isCur ? fromIso(today).getDate() : nbDays;
  // Mois en cours : on compare aux mêmes jours du mois précédent (1er → même date), pas au mois entier
  const ps = monthStart(addDays(ms, -1)), pe = monthEnd(ps);
  const w = periodDetail(ms, me), p = periodDetail(ps, isCur ? new Date(Math.min(addDays(ps, passed - 1), pe)) : pe);
  // Virements du mois (semaines rattachées à ce mois)
  const wk = [...S.weeks.values()].filter(x => x.y === ms.getFullYear() && x.m === ms.getMonth() + 1).map(weekCalc).filter(c => c.ca > 0);
  const vir = wk.reduce((a, c) => a + c.vir, 0), frais = wk.reduce((a, c) => a + c.frais, 0);
  const recu = [...S.weeks.values()].filter(x => x.y === ms.getFullYear() && x.m === ms.getMonth() + 1).reduce((a, x) => a + recvState(x, weekCalc(x)).recv, 0);
  const k = (lbl, val, sub) => `<div class="kpi"><div class="lbl">${lbl}</div><div class="v">${val}</div>${sub ? `<small>${sub}</small>` : ""}</div>`;
  let extra = "";
  if (isCur && passed > 0 && w.net) extra += k("Projection fin de mois", eur0(w.net / passed * nbDays), `au rythme actuel (${passed}/${nbDays} jours)`);
  if (wk.length) extra += k(ratOn() ? `Virements ${esc(ratName())}` : "Virements", eur0(vir), `${eur0(recu)} reçus` + (frais ? ` · frais ${eur0(frais)}` : ""));
  // Semaines (lundi → dimanche) qui touchent le mois, limitées aux jours du mois
  const weeks = [];
  for (let m0 = monday(ms); iso(m0) <= iso(me); m0 = addDays(m0, 7)) {
    const a = m0 < ms ? ms : m0, b = addDays(m0, 6) > me ? me : addDays(m0, 6);
    weeks.push({ mon: m0, a, b, ...periodDetail(a, b) });
  }
  const top = w.days.filter(x => x.r > 0).sort((a, b) => b.r - a.r).slice(0, 3);
  const nextStart = addDays(me, 1);
  openSheet(`
      <h3>${cap(MOIS[ms.getMonth()])} ${ms.getFullYear()}</h3>
      <div class="cur">${w.jours} jour${w.jours > 1 ? "s" : ""} travaillé${w.jours > 1 ? "s" : ""}${isCur ? ` · mois en cours (${nbDays - passed} jour${nbDays - passed > 1 ? "s" : ""} restant${nbDays - passed > 1 ? "s" : ""})` : ""}</div>
      ${kpiBlock(w, p, isCur ? `1–${passed} ${MOIS[ps.getMonth()].slice(0, 4)}.` : "mois préc.", extra)}
      <div class="pair-lbl">Par semaine <span class="hint">· touche une semaine pour le détail</span></div>
      <div class="tbl-wrap"><table class="clk"><thead><tr><th>Semaine</th><th>CA</th><th>Net</th><th>€/h</th><th>€/km</th></tr></thead><tbody>
      ${weeks.map(x => `<tr${x.ca || x.charges ? "" : ' class="off"'} data-mon="${iso(x.mon)}"><td>${pad(x.a.getDate())}–${pad(x.b.getDate())}</td><td>${x.ca ? eur0(x.ca) : "–"}</td><td class="n${x.net < 0 ? " neg" : ""}">${x.ca || x.charges ? eur0(x.net) : "–"}</td><td>${x.h ? Math.round(x.hCa / x.h) + " €" : "–"}</td><td>${x.km ? n2(x.kmCa / x.km) : "–"}</td></tr>`).join("")}
      </tbody></table></div>
      ${top.length ? `<div class="pair-lbl" style="margin-top:14px">Meilleurs jours</div><div class="calc">${top.map(x => `<span>${dayName(x.date)} ${x.date.slice(8)}/${x.date.slice(5, 7)}</span><span>${eur(r2(x.r))}</span>`).join("")}</div>` : ""}
      <div class="row" style="margin-top:14px"><button class="btn ghost" id="pPrev">‹ Mois préc.</button><button class="btn ghost" id="pNext"${iso(nextStart) > today ? " disabled" : ""}>Mois suiv. ›</button></div>`);
  $("pPrev").onclick = () => openMonthDetail(addDays(ms, -1));
  $("pNext").onclick = () => { if (iso(nextStart) <= today) openMonthDetail(nextStart); };
  bindDetail(() => openMonthDetail(ms));
}
function openLitre(back) {
  openSheet(`
      <h3>Prix du litre de carburant</h3>
      <div class="cur">Sert à estimer les litres achetés à partir de tes dépenses carburant (ex. 0,85 pour l'E85, 1,80 pour le gazole).</div>
      <input id="amt" type="text" inputmode="decimal" autocomplete="off" placeholder="ex. 0,85" value="${S.meta.prixLitre ? String(S.meta.prixLitre).replace(".", ",") : ""}">
      <div class="row"><button class="btn primary" id="saveL">Enregistrer</button><button class="btn ghost" id="clearL">Effacer</button></div>`, "amt");
  $("saveL").onclick = async () => { const n = parse($("amt").value); if (!(n > 0 && n < 10)) { toast("Prix invalide", true); return; } await setMeta("prixLitre", r2(n * 1000) / 1000); back ? back() : closeSheet(); };
  $("clearL").onclick = async () => { await setMeta("prixLitre", undefined); back ? back() : closeSheet(); };
}

// ---------- Stats : graphiques (SVG, sans librairie) ----------
const compact = n => { const a = Math.abs(n); return a >= 1000 ? (n / 1000).toLocaleString("fr-FR", { maximumFractionDigits: a >= 10000 ? 0 : 1 }) + " k" : String(Math.round(n)); };
function niceMax(m) {
  if (!(m > 0)) return 1;
  const raw = m / 3, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  return { max: Math.ceil(m / step) * step, step };
}
const tipAttr = t => ` data-tip="${esc(t)}"`;
const roundTop = (x, y, w, h, r) => { r = Math.min(r, h, w / 2); return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; };
const VW = 340, PL = 34, PB = 20, PT = 14;
// Graduations rondes entre lo et hi (lo peut être négatif)
function niceRange(lo, hi) {
  const span = Math.max(hi - lo, 1e-9), raw = span / 3, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  return { lo: Math.floor(lo / step) * step, hi: Math.ceil(hi / step) * step || step, step };
}
function gridAndAxis(H, ny, fmtY) {
  let g = ""; const lo = ny.lo || 0, hi = ny.hi != null ? ny.hi : ny.max;
  for (let v0 = lo; v0 <= hi + 1e-9; v0 += ny.step) {
    const y = PT + (H - PT - PB) * (1 - (v0 - lo) / (hi - lo));
    g += `<line x1="${PL}" x2="${VW}" y1="${y}" y2="${y}" class="vz-grid"/><text x="${PL - 6}" y="${y + 3.5}" class="vz-y">${fmtY(v0)}</text>`;
  }
  return g;
}
// Colonnes (empilées si plusieurs segments). items: {label, segs:[...], tip}
function colChart(items, opts) {
  const H = opts.H || 170, n = items.length; if (!n) return "";
  const tot = items.map(it => it.segs.reduce((a, b) => a + Math.max(0, b), 0));
  const ny = niceMax(Math.max(...tot)), ph = H - PT - PB, slot = (VW - PL) / n, bw = Math.min(24, slot * 0.62);
  const every = Math.ceil(n / 8);
  let g = gridAndAxis(H, ny, opts.fmtY || compact);
  items.forEach((it, i) => {
    const x = PL + slot * i + (slot - bw) / 2; let base = PT + ph;
    const segs = it.segs.map(Math.abs);
    const last = segs.reduce((li, v, k) => (v > 0 ? k : li), -1);
    segs.forEach((v, k) => {
      if (!(v > 0)) return;
      let h = ph * v / ny.max; const gap = k > 0 && base < PT + ph ? 2 : 0; // 2 px d'espace entre segments
      h = Math.max(0, h - gap); base -= gap;
      const y = base - h;
      g += k === last ? `<path d="${roundTop(x, y, bw, h, 4)}" fill="${opts.colors[k]}"/>` : `<rect x="${x}" y="${y}" width="${bw}" height="${h}" fill="${opts.colors[k]}"/>`;
      base = y;
    });
    if (it.mark) g += `<text x="${x + bw / 2}" y="${base - 5}" class="vz-val">${it.mark}</text>`;
    if (i % every === 0 || i === n - 1) g += `<text x="${x + bw / 2}" y="${H - 5}" class="vz-x">${esc(it.label)}</text>`;
    g += `<rect x="${PL + slot * i}" y="${PT}" width="${slot}" height="${ph}" fill="transparent" class="vz-hit"${tipAttr(it.tip)}/>`;
  });
  return `<svg viewBox="0 0 ${VW} ${H}" class="vz" role="img" aria-label="${esc(opts.aria || "")}">${g}</svg>`;
}
// Courbe une série. pts: {label, value, tip}
function lineChart(pts, opts) {
  const H = opts.H || 160, n = pts.length; if (n < 2) return "";
  const vals = pts.map(p => p.value);
  const ny = niceRange(Math.min(0, ...vals), Math.max(...vals)), ph = H - PT - PB, step = (VW - PL - 12) / (n - 1);
  const X = i => PL + 6 + step * i, Y = v => PT + ph * (1 - (v - ny.lo) / (ny.hi - ny.lo));
  const every = Math.ceil(n / 7);
  let g = gridAndAxis(H, ny, opts.fmtY || compact);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.value).toFixed(1)}`).join("");
  const y0 = Y(Math.max(ny.lo, 0));
  g += `<path d="${d}L${X(n - 1)},${y0}L${X(0)},${y0}Z" fill="${opts.color}" opacity=".1"/>`;
  g += `<path d="${d}" fill="none" stroke="${opts.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  pts.forEach((p, i) => {
    if (i % every === 0 || i === n - 1) g += `<text x="${X(i)}" y="${H - 5}" class="vz-x">${esc(p.label)}</text>`;
    if (i === n - 1) g += `<circle cx="${X(i)}" cy="${Y(p.value)}" r="4" fill="${opts.color}" class="vz-dot"/><text x="${X(i) - 6}" y="${Y(p.value) - 9}" class="vz-val" text-anchor="end">${(opts.fmtV || compact)(p.value)}</text>`;
    g += `<circle cx="${X(i)}" cy="${Y(p.value)}" r="14" fill="transparent" class="vz-hit"${tipAttr(p.tip)}/>`;
  });
  return `<svg viewBox="0 0 ${VW} ${H}" class="vz" role="img" aria-label="${esc(opts.aria || "")}">${g}</svg>`;
}
const chartCard = (title, sub, svg, legend) => svg ? `<div class="vz-card"><div class="vz-t">${title}</div>${sub ? `<div class="vz-s">${sub}</div>` : ""}${legend || ""}${svg}</div>` : "";
const legendHtml = list => `<div class="vz-leg">${list.map(([c, l]) => `<span><i style="background:${c}"></i>${l}</span>`).join("")}</div>`;
// Info-bulle : survol (ordinateur) ou appui (téléphone)
function bindTips(root) {
  const tip = $("vzTip");
  const show = (el, ev) => {
    tip.textContent = el.dataset.tip; tip.hidden = false;
    const r = root.getBoundingClientRect(), t = tip.getBoundingClientRect();
    const x = Math.min(Math.max(ev.clientX - r.left - t.width / 2, 4), r.width - t.width - 4);
    tip.style.left = x + "px"; tip.style.top = (ev.clientY - r.top - t.height - 12) + "px";
  };
  root.onpointerover = root.onpointerdown = ev => { const el = ev.target.closest && ev.target.closest("[data-tip]"); if (el) show(el, ev); else tip.hidden = true; };
  root.onpointerleave = () => (tip.hidden = true);
}

// ---------- Stats ----------
const RANGES = [["3m", "3 mois"], ["12m", "12 mois"], ["year", "Cette année"], ["all", "Tout"]];
let statsRange = (() => { try { return localStorage.getItem("vtcpro.statsRange") || "12m"; } catch (_) { return "12m"; } })();
function rangeStart(first) {
  const n = new Date();
  if (statsRange === "3m") return new Date(n.getFullYear(), n.getMonth() - 2, 1);
  if (statsRange === "12m") return new Date(n.getFullYear(), n.getMonth() - 11, 1);
  if (statsRange === "year") return new Date(n.getFullYear(), 0, 1);
  return first;
}
function renderStats() {
  const allDates = [...S.days.keys(), ...S.deps.filter(x => x.cat !== "Démarrage").map(x => x.date)].sort();
  if (!allDates.length) { $("stats").innerHTML = '<div class="list"><div class="item empty">Pas encore de données. Saisis ta première journée dans l\'onglet Jour.</div></div>'; return; }
  const first = monthStart(fromIso(allDates[0])), now = new Date(), today = todayIso();
  let from = rangeStart(first); if (from < first) from = first;
  const fromIsoS = iso(from);
  const P = periodDetail(from, now); // période choisie, jusqu'à aujourd'hui
  // Mois
  const months = [];
  for (let d = monthStart(from); d <= now; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const md = periodDetail(d, monthEnd(d) > now ? now : monthEnd(d));
    months.push({ d, ...md });
  }
  const actifs = months.filter(m => m.ca > 0);
  // Semaines (lundi → dimanche)
  const weeks = [];
  for (let m0 = monday(from); iso(m0) <= today; m0 = addDays(m0, 7)) weeks.push({ mon: m0, ...weekDetail(m0) });
  const wAct = weeks.filter(w => w.ca > 0);
  // Jours
  const workDays = P.days.filter(d => d.r > 0);
  const bestDay = workDays.slice().sort((a, b) => b.r - a.r)[0];
  const bestWeek = wAct.slice().sort((a, b) => b.net - a.net)[0];
  const bestMonth = actifs.slice().sort((a, b) => b.net - a.net)[0];
  const nbWeeks = Math.max(1, Math.round((now - from) / 864e5 / 7));
  const avgMonth = actifs.length ? actifs.reduce((a, m) => a + m.net, 0) / actifs.length : 0;

  const urssaf = S.deps.filter(x => x.cat === "Cotisations URSSAF").reduce((a, x) => a + depShare(x, fromIsoS, today), 0);
  const k = (lbl, val, sub, cls) => `<div class="kpi${cls ? " " + cls : ""}"><div class="lbl">${lbl}</div><div class="v">${val}</div>${sub ? `<small>${sub}</small>` : ""}</div>`;
  const mLbl = d => `${SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
  const dLbl = s => `${dayName(s)} ${s.slice(8)}/${s.slice(5, 7)}`;
  let h = `<div class="seg" role="tablist" aria-label="Période">${RANGES.map(([id, l]) => `<button role="tab" data-r="${id}" aria-selected="${id === statsRange}">${l}</button>`).join("")}</div>
    <div class="cur-range">${from.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} → aujourd'hui</div>
    <div class="kpis">
      ${k("Revenu net", eur0(P.net), `${P.jours} jours travaillés · ${pct(P.charges, P.ca)} % de charges`, "main")}
      ${k("Chiffre d'affaires", eur0(P.ca), P.jours ? eur0(P.ca / P.jours) + " / jour travaillé" : "")}
      ${k("Charges", eur0(P.charges), `carburant ${eur0(P.carb)}${urssaf > 0 ? ` · URSSAF ${eur0(urssaf)}` : ""}`)}
      ${urssaf > 0 ? k("Cotisations URSSAF", eur0(urssaf), `${pct(urssaf, P.ca)} % du CA`) : ""}
      ${k("Net moyen / mois", eur0(avgMonth), `${actifs.length} mois actif${actifs.length > 1 ? "s" : ""}`)}
      ${k("Net moyen / semaine", eur0(wAct.length ? wAct.reduce((a, w) => a + w.net, 0) / wAct.length : 0), `${n1(P.jours / nbWeeks)} jours / semaine`)}
      ${k("Net / jour travaillé", P.jours ? eur0(P.net / P.jours) : "–", "")}
      ${k("€ / heure", P.h ? n2(P.hCa / P.h) + " €" : "–", P.h ? `${fmtH(P.h)} saisies · net ${n2(P.hNet / P.h)} €/h` : "Saisis tes heures")}
      ${k("€ / km", P.km ? n2(P.kmCa / P.km) + " €" : "–", P.km ? `${Math.round(P.km).toLocaleString("fr-FR")} km saisis` : "Saisis tes km")}
      ${k("CA / 1 € carburant", P.carb ? n2(P.ca / P.carb) + " €" : "–", "")}
      ${k("Meilleur mois", bestMonth ? eur0(bestMonth.net) : "–", bestMonth ? cap(MOIS[bestMonth.d.getMonth()]) + " " + bestMonth.d.getFullYear() : "")}
      ${k("Meilleure semaine", bestWeek ? eur0(bestWeek.net) : "–", bestWeek ? "du " + bestWeek.from.slice(8) + "/" + bestWeek.from.slice(5, 7) : "")}
      ${k("Meilleur jour", bestDay ? eur0(bestDay.r) : "–", bestDay ? dLbl(bestDay.date) : "")}
      ${carBlock(P, (l, v, sb) => k(l, v, sb, "wide"))}
    </div>`;

  // Graphique 1 : CA par mois = net + charges
  const C1 = "var(--viz-1)", C2 = "var(--viz-2)";
  h += `<div class="vz-wrap">`;
  h += chartCard("Chiffre d'affaires par mois", "Hauteur = CA · touche une colonne pour voir les chiffres",
    colChart(months.map(m => ({ label: SHORT[m.d.getMonth()].replace(".", ""), segs: [Math.max(0, m.net), m.ca - Math.max(0, m.net)],
      tip: `${cap(MOIS[m.d.getMonth()])} ${m.d.getFullYear()} · CA ${eur0(m.ca)} · net ${eur0(m.net)} · charges ${eur0(m.charges)}` })),
      { colors: [C1, C2], aria: "Chiffre d'affaires par mois, partagé entre revenu net et charges" }),
    legendHtml([[C1, "Revenu net"], [C2, "Charges"]]));
  // Graphique 2 : net par semaine (16 dernières max)
  const wk16 = weeks.slice(-16);
  h += chartCard("Revenu net par semaine", wk16.length ? `${wk16.length} dernières semaines` : "",
    lineChart(wk16.map(w => ({ label: w.from.slice(8) + "/" + w.from.slice(5, 7), value: w.net, tip: `Semaine du ${w.from.slice(8)}/${w.from.slice(5, 7)} · net ${eur0(w.net)} · CA ${eur0(w.ca)}` })),
      { color: C1, aria: "Revenu net par semaine", fmtV: eur0 }));
  // Graphique 3 : jour de la semaine (CA moyen les jours travaillés)
  const wd = JOURS.map(() => ({ s: 0, n: 0 }));
  workDays.forEach(d => { const i = (fromIso(d.date).getDay() + 6) % 7; wd[i].s += d.r; wd[i].n++; });
  const wdAvg = wd.map(x => (x.n ? x.s / x.n : 0)), wdMax = Math.max(...wdAvg);
  h += chartCard("CA moyen selon le jour", "Jours travaillés seulement",
    colChart(JOURS.map((j, i) => ({ label: j, segs: [wdAvg[i]], mark: wdAvg[i] === wdMax && wdMax > 0 ? eur0(wdMax) : "",
      tip: `${j} · CA moyen ${eur0(wdAvg[i])} · ${wd[i].n} jour${wd[i].n > 1 ? "s" : ""}` })), { colors: [C1], H: 150, aria: "Chiffre d'affaires moyen par jour de la semaine" }));
  // Graphiques 4 et 5 : €/h et €/km par semaine (si saisis)
  const wH = weeks.filter(w => w.h > 0);
  if (wH.length >= 2) h += chartCard("€ / heure par semaine", "Recettes ÷ heures, semaines avec heures saisies",
    lineChart(wH.slice(-16).map(w => ({ label: w.from.slice(8) + "/" + w.from.slice(5, 7), value: w.hCa / w.h, tip: `Semaine du ${w.from.slice(8)}/${w.from.slice(5, 7)} · ${n2(w.hCa / w.h)} €/h · ${fmtH(w.h)}` })),
      { color: C1, aria: "Euros par heure par semaine", fmtV: x => Math.round(x) + " €", fmtY: x => Math.round(x) + "" }));
  const wK = weeks.filter(w => w.km > 0);
  if (wK.length >= 2) h += chartCard("€ / km par semaine", "Semaines avec km saisis",
    lineChart(wK.slice(-16).map(w => ({ label: w.from.slice(8) + "/" + w.from.slice(5, 7), value: w.kmCa / w.km, tip: `Semaine du ${w.from.slice(8)}/${w.from.slice(5, 7)} · ${n2(w.kmCa / w.km)} €/km · ${Math.round(w.km)} km` })),
      { color: C1, aria: "Euros par kilomètre par semaine", fmtV: x => n2(x), fmtY: x => n1(x) }));

  // Tableaux
  h += `</div>`;
  h += `<h2>Par mois <small class="hint">· touche un mois pour le détail</small></h2>
    <div class="tbl-wrap"><table class="clk"><thead><tr><th>Mois</th><th>CA</th><th>Charges</th><th>Net</th><th>€/h</th></tr></thead><tbody>`;
  months.slice().reverse().filter(m => m.ca || m.charges).forEach(m => {
    h += `<tr data-month="${iso(m.d)}"><td>${mLbl(m.d)}</td><td>${eur0(m.ca)}</td><td>${eur0(m.charges)}</td><td class="n${m.net < 0 ? " neg" : ""}">${eur0(m.net)}</td><td>${m.h ? Math.round(m.hCa / m.h) + " €" : "–"}</td></tr>`;
  });
  h += `<tr class="tot"><td>Total</td><td>${eur0(P.ca)}</td><td>${eur0(P.charges)}</td><td class="n">${eur0(P.net)}</td><td>${P.h ? Math.round(P.hCa / P.h) + " €" : "–"}</td></tr></tbody></table></div>`;
  const wks = wAct.slice(-12).reverse();
  if (wks.length) {
    h += `<h2>Par semaine <small class="hint">· touche une semaine pour le détail</small></h2><div class="tbl-wrap"><table class="clk"><thead><tr><th>Semaine</th><th>CA</th><th>Net</th><th>€/h</th><th>€/km</th></tr></thead><tbody>`;
    wks.forEach(w => { h += `<tr data-mon="${w.from}"><td>${w.from.slice(8)}/${w.from.slice(5, 7)}</td><td>${eur0(w.ca)}</td><td class="n${w.net < 0 ? " neg" : ""}">${eur0(w.net)}</td><td>${w.h ? Math.round(w.hCa / w.h) + " €" : "–"}</td><td>${w.km ? n2(w.kmCa / w.km) : "–"}</td></tr>`; });
    h += `</tbody></table></div>`;
  }
  // Répartition
  const plat = platRows(P.plat).map(([n, s]) => [esc(n), s]);
  const depIn = c => S.deps.filter(x => x.cat === c).reduce((a, x) => a + depShare(x, fromIsoS, today), 0);
  const byGrp = {};
  S.deps.forEach(x => { if (x.cat !== "Démarrage" && !DAY_DEP_CATS.includes(x.cat)) { const a = depShare(x, fromIsoS, today); if (a) {
    const k = STATUT_CATS.includes(x.cat) ? "c:" + x.cat : catGrp(x.cat), g = byGrp[k] || (byGrp[k] = { s: 0, det: {} }); g.s += a; g.det[catLbl(x.cat)] = (g.det[catLbl(x.cat)] || 0) + a; } } });
  const detTxt = det => Object.entries(det).sort((a, b) => b[1] - a[1]).map(([n, s]) => `${esc(n)} ${eur0(s)}`).join(" · ");
  const ch = [["Carburant", P.carb], ["Repas / café", P.repas]].concat(Object.entries(byGrp).sort((a, b) => b[1].s - a[1].s)
    .map(([k, g]) => k.startsWith("c:") ? [esc(k.slice(2)), g.s, `${pct(g.s, P.ca)} % du chiffre d'affaires`] : [esc(grpInfo(k).t), g.s, detTxt(g.det)])).filter(x => x[1] > 0);
  const bars = (list, cls, base) => { const max = Math.max(1, ...list.map(x => x[1]));
    return list.map(([n, s, det]) => `<div class="rowline"><div class="top"><span>${n} <small>${pct(s, base)} %</small></span><b>${eur0(s)}</b></div><div class="bar ${cls}"><i style="width:${(s / max * 100).toFixed(1)}%"></i></div>${det ? `<div class="rdet">${det}</div>` : ""}</div>`).join(""); };
  if (plat.length) h += `<h2>Par plateforme <small class="hint">· % du CA</small></h2><div class="list">${bars(plat, "", P.ca)}</div>`;
  if (ch.length) h += `<h2>Charges par catégorie <small class="hint">· % des charges</small></h2><div class="list">${bars(ch, "ch", P.charges)}</div>`;
  h += `<div class="vz-tip" id="vzTip" hidden></div>`;
  const root = $("stats"); root.innerHTML = h;
  root.querySelectorAll(".seg button").forEach(b => (b.onclick = () => { statsRange = b.dataset.r; try { localStorage.setItem("vtcpro.statsRange", statsRange); } catch (_) {} renderStats(); }));
  root.querySelectorAll("tr[data-mon]").forEach(tr => (tr.onclick = () => openWeekDetail(fromIso(tr.dataset.mon))));
  root.querySelectorAll("tr[data-month]").forEach(tr => (tr.onclick = () => openMonthDetail(fromIso(tr.dataset.month))));
  bindTips(root);
}
