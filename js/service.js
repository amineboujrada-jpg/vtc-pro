// VTC Rentable — Mode service : démarrer, pause, reprendre, terminer la journée
"use strict";

// Le service en cours est gardé dans S.meta.shiftStart (même donnée que l'heure de début des Heures) :
//   date     journée du service : le jour où il a commencé. Elle ne change pas tant que le service tourne, même après
//            minuit ou l'heure de fin de journée ; elle change quand on termine le service (voir svcJour)
//   time     heure de début du morceau en cours (« HH:MM »), ts : même instant en millisecondes
//   km       compteur au départ (facultatif)
//   pauseMs  durée des pauses terminées, pauseAt : début de la pause en cours (null si on roule)
//   prev     morceaux comptés sur des journées précédentes [{ date, min }] : seulement pour les services découpés
//            avant la 1.86 (ils ne le sont plus)
// À la fin, les heures et les km sont AJOUTÉS au jour ; tout reste modifiable à la main.
const SVC_ICO = {
  play: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><rect x="6.5" y="5.5" width="4" height="13" rx="1"/><rect x="13.5" y="5.5" width="4" height="13" rx="1"/></svg>',
  stop: '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>'
};
const SVC_MAX_H = 20; // au-delà, le service est considéré comme oublié : plus de découpage automatique

const svcRun = () => S.meta.shiftStart && S.meta.shiftStart.date ? S.meta.shiftStart : null;
// Journée affichée et « aujourd'hui » : pendant un service, c'est le jour où il a commencé (il ne passe pas au jour
// suivant à minuit) ; sans service, c'est la journée de travail (voir workDay)
const svcJour = () => { const s = svcRun(); return s ? s.date : workDay(); };
// Instant de début du morceau en cours (les anciens débuts, saisis dans Heures, n'ont que date + heure)
function svcTs(s) {
  if (typeof s.ts === "number") return s.ts;
  const m = toMin(s.time); if (m == null) return Date.now();
  const d = fromIso(s.date); if (m < finJourH() * 60) d.setDate(d.getDate() + 1); // avant l'heure de fin : lendemain
  d.setHours(0, m, 0, 0); return d.getTime();
}
// Minutes travaillées dans le morceau en cours, pauses retirées
function svcWorked(s, at) {
  const now = at || Date.now(), p = (s.pauseMs || 0) + (s.pauseAt ? Math.max(0, now - Math.max(s.pauseAt, svcTs(s))) : 0);
  return Math.max(0, Math.floor((now - svcTs(s) - p) / 60000));
}
const svcPauseMin = (s, at) => Math.round(((s.pauseMs || 0) + (s.pauseAt ? Math.max(0, (at || Date.now()) - s.pauseAt) : 0)) / 60000);
// Compteur proposé au départ : fin du service précédent du jour, sinon fin du dernier jour saisi
function svcKmGuess(date) {
  const d = S.days.get(date) || {};
  if (typeof d.kmEnd === "number") return d.kmEnd;
  if (typeof d.kmStart === "number") return d.kmStart;
  const p = lastKmEnd(date); return p ? p.km : null;
}
const svcDay = date => { const d = fromIso(date); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
async function svcAddDay(date, fn) {
  const d = Object.assign({ date }, S.days.get(date) || {}); fn(d);
  await put("days", d); S.days.set(date, d);
}

// Pas de découpage à minuit : un service qui passe minuit (ou l'heure de fin de journée) reste sur le jour où il
// a commencé, et ses heures et km vont tous sur ce jour à la fin.

let svcLastDay = null;
async function svcTick() {
  if (!idb) return;
  try {
    const was = svcLastDay, now = svcJour(); svcLastDay = now;
    // nouvelle journée pendant que l'appli est ouverte (pas de service en cours) : on y passe
    if (was && was !== now && curDate === was) { curDate = now; renderAll(); return; }
    const t = $("svcTime"), s = svcRun();
    if (t && s) t.textContent = s.pauseAt ? `En pause · ${Math.round((Date.now() - s.pauseAt) / 60000)} min` : fmtH(svcWorked(s) / 60);
  } catch (_) {}
}
setInterval(svcTick, 30000);

function renderService() {
  const box = $("service"); if (!box) return;
  if (!svcLastDay) svcLastDay = svcJour();
  const s = svcRun();
  if (!s) {
    box.innerHTML = curDate === workDay() ? `<button class="svc-pill" id="svcGo" type="button">${SVC_ICO.play}Démarrer ma journée</button>` : "";
    if ($("svcGo")) $("svcGo").onclick = svcStart;
    return;
  }
  const old = Date.now() - svcTs(s) >= SVC_MAX_H * 3600e3, since = `depuis ${s.date !== workDay() || old ? "le " + svcDay(s.date) + " " : ""}${esc(s.time)}`;
  box.innerHTML = s.pauseAt
    ? `<div class="svc-bar paused">${SVC_ICO.pause}<div class="svc-txt"><b id="svcTime">En pause · ${Math.round((Date.now() - s.pauseAt) / 60000)} min</b><small>travaillé ${fmtH(svcWorked(s) / 60)}</small></div>
        <button class="svc-ib go" id="svcRes" type="button" aria-label="Reprendre">${SVC_ICO.play}</button>
        <button class="svc-ib end" id="svcEnd" type="button" aria-label="Terminer ma journée">${SVC_ICO.stop}</button></div>`
    : `<div class="svc-bar"><i class="svc-dot"></i><div class="svc-txt"><b id="svcTime">${fmtH(svcWorked(s) / 60)}</b><small>${since}</small></div>
        <button class="svc-ib pause" id="svcPause" type="button" aria-label="Pause">${SVC_ICO.pause}</button>
        <button class="svc-ib end" id="svcEnd" type="button" aria-label="Terminer ma journée">${SVC_ICO.stop}</button></div>`;
  $("svcEnd").onclick = svcOpenEnd;
  if ($("svcPause")) $("svcPause").onclick = () => svcSetPause(true);
  if ($("svcRes")) $("svcRes").onclick = () => svcSetPause(false);
}

async function svcSetPause(on) {
  const s = svcRun(); if (!s) return;
  const n = Object.assign({}, s, { ts: svcTs(s) }), now = Date.now();
  if (on && !n.pauseAt) n.pauseAt = now;
  if (!on && n.pauseAt) { n.pauseMs = (n.pauseMs || 0) + Math.max(0, now - n.pauseAt); n.pauseAt = null; }
  await setMeta("shiftStart", n); renderJour();
  toast(on ? "Pause : le temps est arrêté" : `Reprise à ${nowHM()}`);
}

async function svcStart() {
  const date = workDay(), km = svcKmGuess(date);
  try {
    await setMeta("shiftStart", { date, time: nowHM(), ts: Date.now(), km: km != null ? km : undefined, pauseMs: 0, pauseAt: null, prev: [] });
    // Le compteur de début s'affiche aussi dans la tuile Km (premier service du jour seulement)
    const d = S.days.get(date);
    if (km != null && !(d && typeof d.kmStart === "number")) await svcAddDay(date, x => { x.kmStart = km; });
    curDate = date; svcLastDay = date; renderJour(); toast(`Bonne route ! Début ${S.meta.shiftStart.time}`);
  } catch (e) { toast("Enregistrement impossible : " + (e && e.message || e), true); }
}

function svcOpenEnd() {
  const s = svcRun(); if (!s) return;
  const prev = s.prev || [], prevMin = prev.reduce((a, x) => a + x.min, 0);
  openSheet(`
      <h3>Terminer ma journée</h3>
      <div class="cur">Ajouté au ${esc(cap(fromIso(s.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })))}${prevMin ? ` · déjà compté avant ${pad(finJourH())} h : ${fmtH(prevMin / 60)} sur le ${prev.map(x => svcDay(x.date)).join(", ")}` : ""}</div>
      <div class="svc-grid">
        <div><div class="pair-lbl">Début</div><input id="sStart" type="time" value="${esc(s.time)}" aria-label="Heure de début"></div>
        <div><div class="pair-lbl">Fin</div><input id="sEnd" type="time" value="${nowHM()}" aria-label="Heure de fin"></div>
        <div><div class="pair-lbl">Pauses (min)</div><input id="sPause" type="text" inputmode="numeric" autocomplete="off" placeholder="0" value="${svcPauseMin(s) || ""}"></div>
        <div><div class="pair-lbl">Compteur fin</div><input id="sKb" type="text" inputmode="numeric" autocomplete="off" placeholder="ex. 152 528"></div>
        <div><div class="pair-lbl">Compteur début</div><input id="sKa" type="text" inputmode="numeric" autocomplete="off" placeholder="facultatif" value="${typeof s.km === "number" ? s.km : ""}"></div>
        <div><div class="pair-lbl">Ou nombre de km</div><input id="sKm" type="text" inputmode="decimal" autocomplete="off" placeholder="sans compteur"></div>
      </div>
      <div class="calc" id="sCalc"></div>
      <button class="btn primary" id="sSave" style="width:100%">Enregistrer</button>
      <button class="linkbtn svc-cancel" id="sCancel" type="button">Annuler le service</button>`, "sKb");
  const num = id => { const t = $(id).value.trim(); if (t === "") return null; const n = parse(t); return isFinite(n) ? n : NaN; };
  const mins = () => {
    const a = toMin($("sStart").value), b = toMin($("sEnd").value), p = num("sPause");
    if (a == null || b == null) return { err: "Indique l'heure de début et de fin" };
    if (p != null && (isNaN(p) || p < 0)) return { err: "Pauses : un nombre de minutes" };
    let m = b - a; if (m <= 0) m += 1440; // passage de minuit
    m -= p || 0; return m < 0 ? { err: "Les pauses dépassent la durée" } : { m };
  };
  const kms = () => {
    const a = num("sKa"), b = num("sKb"), k = num("sKm");
    if ([a, b, k].some(x => x != null && isNaN(x))) return { err: "Tape un nombre" };
    if (a != null && b != null) return b < a ? { err: "Compteur fin plus petit que début" } : { km: r2(b - a), a, b };
    if (k != null) return k < 0 ? { err: "Nombre de km invalide" } : { km: r2(k) };
    return { km: 0, a, b };
  };
  const calc = () => {
    const t = mins(), k = kms();
    $("sCalc").innerHTML = `<span>Heures</span><span>${t.err ? `<span class="neg">${t.err}</span>` : "+" + fmtH(t.m / 60)}</span>` +
      `<span>Km</span><span>${k.err ? `<span class="neg">${k.err}</span>` : k.km ? "+" + k.km.toLocaleString("fr-FR") + " km" : "—"}</span>`;
  };
  ["sStart", "sEnd", "sPause", "sKa", "sKb", "sKm"].forEach(id => ($(id).oninput = calc));
  calc();
  $("sSave").onclick = async () => {
    const t = mins(), k = kms();
    if (t.err) { toast(t.err, true); return; }
    if (k.err) { toast(k.err, true); return; }
    // Km d'un service sur plusieurs journées : répartis selon les heures de chaque journée
    const parts = prev.concat({ date: s.date, min: t.m }), tot = parts.reduce((a, x) => a + x.min, 0);
    let rest = k.km;
    try {
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i], last = i === parts.length - 1;
        const share = last ? r2(rest) : r2(tot ? k.km * p.min / tot : 0); rest -= share;
        await svcAddDay(p.date, d => {
          if (last && t.m > 0) d.heures = r2(v(d, "heures") + t.m / 60);
          if (share > 0) d.km = r2(v(d, "km") + share);
          if (i === 0 && k.a != null && typeof d.kmStart !== "number") d.kmStart = k.a;
          if (last && k.b != null) d.kmEnd = k.b;
        });
      }
      await setMeta("shiftStart", undefined);
      // le service est fini : on passe à la journée de travail en cours
      closeSheet(); curDate = workDay(); svcLastDay = curDate; renderJour();
      toast(`Journée enregistrée : +${fmtH(t.m / 60)}${k.km ? " · +" + k.km.toLocaleString("fr-FR") + " km" : ""}`);
      setTimeout(() => entNotify().catch(() => {}), 2500);
    } catch (e) { toast("Enregistrement impossible : " + (e && e.message || e), true); }
  };
  $("sCancel").onclick = async () => {
    const b = $("sCancel");
    if (!b.dataset.ok) { b.dataset.ok = "1"; b.textContent = "Toucher encore pour annuler (rien de plus ne sera ajouté)"; return; }
    await setMeta("shiftStart", undefined); closeSheet(); renderJour(); toast("Service annulé");
  };
}
