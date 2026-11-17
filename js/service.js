// VTC Rentable — Mode service : « Démarrer ma journée » / « Terminer ma journée »
"use strict";

// Le service en cours est gardé dans S.meta.shiftStart = { date, time, km } (même donnée que l'heure de début des
// Heures). À la fin, les heures et les km sont AJOUTÉS au jour du départ (passage de minuit compris) ; tout reste
// modifiable à la main avant d'enregistrer, puis dans les tuiles Heures et Km.
let svcTimer = null;
const SVC_ICO = {
  play: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  stop: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>'
};

const svcRun = () => S.meta.shiftStart && S.meta.shiftStart.date ? S.meta.shiftStart : null;
// Minutes écoulées depuis le début du service (date + heure de début → maintenant)
function svcElapsed(s) {
  const m = toMin(s.time); if (m == null) return 0;
  const start = fromIso(s.date); start.setHours(0, m, 0, 0);
  return Math.max(0, Math.floor((Date.now() - start.getTime()) / 60000));
}
// Compteur proposé au départ : fin du service précédent du jour, sinon fin du dernier jour saisi
function svcKmGuess(date) {
  const d = S.days.get(date) || {};
  if (typeof d.kmEnd === "number") return d.kmEnd;
  if (typeof d.kmStart === "number") return d.kmStart;
  const p = lastKmEnd(date); return p ? p.km : null;
}
const svcDay = date => { const d = fromIso(date); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };

function renderService() {
  const box = $("service"); if (!box) return;
  clearInterval(svcTimer); svcTimer = null;
  const s = svcRun(), today = todayIso();
  if (!s) {
    if (curDate !== today) { box.innerHTML = ""; return; }
    const g = svcKmGuess(today);
    box.innerHTML = `<button class="svc-go" id="svcGo" type="button">${SVC_ICO.play}Démarrer ma journée</button>` +
      (g != null ? `<div class="svc-hint">Compteur repris : ${g.toLocaleString("fr-FR")} km</div>` : "");
    $("svcGo").onclick = svcStart;
    return;
  }
  const other = s.date !== today;
  box.innerHTML = `<div class="svc-card">
      <div class="svc-st"><i class="svc-dot"></i>En service depuis ${other ? "le " + svcDay(s.date) + " à " : ""}${esc(s.time)}</div>
      <div class="svc-time" id="svcTime">${fmtH(svcElapsed(s) / 60)}</div>
      ${typeof s.km === "number" ? `<div class="svc-hint">Compteur au départ : ${s.km.toLocaleString("fr-FR")}</div>` : ""}
      <button class="btn danger" id="svcEnd" type="button">${SVC_ICO.stop}Terminer ma journée</button>
    </div>`;
  $("svcEnd").onclick = svcOpenEnd;
  svcTimer = setInterval(() => { const t = $("svcTime"), r = svcRun(); if (t && r) t.textContent = fmtH(svcElapsed(r) / 60); }, 30000);
}

async function svcStart() {
  const date = todayIso(), km = svcKmGuess(date);
  try {
    await setMeta("shiftStart", { date, time: nowHM(), km: km != null ? km : undefined });
    // Le compteur de début s'affiche aussi dans la tuile Km (premier service du jour seulement)
    const d = S.days.get(date);
    if (km != null && !(d && typeof d.kmStart === "number")) {
      const nd = Object.assign({ date }, d || {}, { kmStart: km });
      await put("days", nd); S.days.set(date, nd);
    }
    curDate = date; renderJour(); toast(`Bonne route ! Début ${S.meta.shiftStart.time}`);
  } catch (e) { toast("Enregistrement impossible : " + (e && e.message || e), true); }
}

function svcOpenEnd() {
  const s = svcRun(); if (!s) return;
  const sameDay = s.date === todayIso();
  openSheet(`
      <h3>Terminer ma journée</h3>
      <div class="cur">Ajouté au ${esc(cap(fromIso(s.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })))}</div>
      <div class="svc-grid">
        <div><div class="pair-lbl">Début${sameDay ? "" : ` <span class="hint">· le ${svcDay(s.date)}</span>`}</div><input id="sStart" type="time" value="${esc(s.time)}" aria-label="Heure de début"></div>
        <div><div class="pair-lbl">Fin</div><input id="sEnd" type="time" value="${nowHM()}" aria-label="Heure de fin"></div>
        <div><div class="pair-lbl">Compteur début</div><input id="sKa" type="text" inputmode="numeric" autocomplete="off" placeholder="facultatif" value="${typeof s.km === "number" ? s.km : ""}"></div>
        <div><div class="pair-lbl">Compteur fin</div><input id="sKb" type="text" inputmode="numeric" autocomplete="off" placeholder="ex. 152 528"></div>
      </div>
      <div class="pair-lbl">Ou nombre de km</div>
      <input id="sKm" type="text" inputmode="decimal" autocomplete="off" placeholder="si pas de compteur">
      <div class="calc" id="sCalc"></div>
      <button class="btn primary" id="sSave" style="width:100%">Enregistrer</button>
      <button class="linkbtn svc-cancel" id="sCancel" type="button">Annuler le service</button>`, "sKb");
  const num = id => { const t = $(id).value.trim(); if (t === "") return null; const n = parse(t); return isFinite(n) ? n : NaN; };
  // Durée : début du jour du départ → fin (si la fin est plus tôt que le début, c'est le lendemain)
  const mins = () => {
    const a = toMin($("sStart").value), b = toMin($("sEnd").value); if (a == null || b == null) return null;
    let m = b - a; if (m <= 0) m += 1440;
    const days = Math.round((fromIso(todayIso()) - fromIso(s.date)) / 864e5); // service oublié plusieurs jours
    if (days > 1) m += (days - 1) * 1440;
    return m;
  };
  const kms = () => {
    const a = num("sKa"), b = num("sKb"), k = num("sKm");
    if ([a, b, k].some(x => x != null && isNaN(x))) return { err: "Tape un nombre" };
    if (a != null && b != null) return b < a ? { err: "Compteur fin plus petit que début" } : { km: r2(b - a), a, b };
    if (k != null) return k < 0 ? { err: "Nombre de km invalide" } : { km: r2(k) };
    return { km: 0, a, b };
  };
  const calc = () => {
    const m = mins(), k = kms();
    $("sCalc").innerHTML = `<span>Heures</span><span>${m == null ? "—" : "+" + fmtH(m / 60)}</span>` +
      `<span>Km</span><span>${k.err ? `<span class="neg">${k.err}</span>` : k.km ? "+" + k.km.toLocaleString("fr-FR") + " km" : "—"}</span>`;
  };
  ["sStart", "sEnd", "sKa", "sKb", "sKm"].forEach(id => ($(id).oninput = calc));
  calc();
  $("sSave").onclick = async () => {
    const m = mins(), k = kms();
    if (m == null) { toast("Indique l'heure de début et de fin", true); return; }
    if (k.err) { toast(k.err, true); return; }
    const h = r2(m / 60), d = Object.assign({ date: s.date }, S.days.get(s.date) || {});
    if (h > 0) d.heures = r2(v(d, "heures") + h);
    if (k.km > 0) d.km = r2(v(d, "km") + k.km);
    if (k.a != null && typeof d.kmStart !== "number") d.kmStart = k.a;
    if (k.b != null) d.kmEnd = k.b;
    try {
      await put("days", d); S.days.set(s.date, d);
      await setMeta("shiftStart", undefined);
      closeSheet(); curDate = s.date; renderJour();
      toast(`Journée enregistrée : +${fmtH(h)}${k.km ? " · +" + k.km.toLocaleString("fr-FR") + " km" : ""}`);
      setTimeout(() => entNotify().catch(() => {}), 2500);
    } catch (e) { toast("Enregistrement impossible : " + (e && e.message || e), true); }
  };
  $("sCancel").onclick = async () => {
    const b = $("sCancel");
    if (!b.dataset.ok) { b.dataset.ok = "1"; b.textContent = "Toucher encore pour annuler (rien ne sera ajouté)"; return; }
    await setMeta("shiftStart", undefined); closeSheet(); renderJour(); toast("Service annulé");
  };
}
