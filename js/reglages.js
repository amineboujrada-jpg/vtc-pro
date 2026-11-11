// VTC Rentable — Réglages : activité, véhicule, statut, dépenses
"use strict";

// ---------- Mon activité : plateformes, rattachement, assurance ----------
function openActivite() {
  const c = cfg();
  const tg = (id, on, label, sub) => `<button class="toggle" type="button" id="${id}" aria-pressed="${!!on}"><span>${label}${sub ? `<small class="tsub">${sub}</small>` : ""}</span><span class="sw"></span></button>`;
  openSheet(backBtn() + `
      <h3>Mes plateformes</h3>
      <div class="cur">Coche les plateformes sur lesquelles tu roules. Elles apparaissent dans le Journal et les Virements. Courses privées et pourboires sont toujours là.</div>
      <div class="plist">${allPlats().map(p => tg("pl-" + p.k, c.plats[p.k], esc(p.t), c.custom.some(x => x.k === p.k) ? "ajoutée par toi" : "")).join("")}</div>
      <div class="addrow"><input id="newPlat" class="small" type="text" maxlength="24" autocomplete="off" placeholder="Autre plateforme (ex. Taxi G7)" aria-label="Nom d'une autre plateforme"><button class="btn ghost small" id="addPlat" type="button">Ajouter</button></div>
      <button class="btn primary" id="saveAct" style="width:100%;margin-top:12px">Enregistrer</button>`);
  bindBack();
  $("sheet").querySelectorAll(".plist .toggle").forEach(b => flip(b.id));
  const collect = () => { const n = cfg(); allPlats().forEach(p => { if ($("pl-" + p.k)) n.plats[p.k] = isOn("pl-" + p.k); }); return n; };
  $("addPlat").onclick = async () => {
    const t = $("newPlat").value.trim().replace(/\s+/g, " ");
    if (!t) { toast("Tape le nom de la plateforme", true); return; }
    const slug = "p_" + t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "").slice(0, 20);
    if (slug === "p_" || allPlats().some(p => p.k === slug || p.t.toLowerCase() === t.toLowerCase())) { toast("Cette plateforme existe déjà", true); return; }
    const n = collect(); n.custom = n.custom.concat({ k: slug, t }); n.plats[slug] = true;
    await saveCfg(n); openActivite(); toast(`${t} ajoutée`);
  };
  $("saveAct").onclick = async () => {
    try { await saveCfg(collect()); closeSheet(); renderAll(); toast("Plateformes enregistrées"); }
    catch (e) { toast("Enregistrement impossible", true); }
  };
}

// ---------- Véhicule : voiture (achat / location), assurance et entretien ----------
let vehTab = "voiture"; // onglet ouvert de la page Véhicule (gardé quand on revient d'une voiture)
function openVehicule() {
  const c = cfg(), e = entCfg(), cur = odoNow(null, null), num = x => (x ? String(x).replace(".", ",") : "");
  const st = entState(), ct = ctCfg(), cst = ctState();
  const ctTxt = !cst ? "Renseigne la date de ta dernière visite : je te rappelle la suivante un an après."
    : `<b style="color:var(${cst.level === "over" ? "--danger" : cst.level === "soon" ? "--charge" : "--net"})">${esc(ctLine(cst).t)}</b><br>${esc(ctLine(cst).s)}`;
  const entTxt = !st ? "Renseigne la date et le compteur de ton dernier entretien : je calcule les km restants avec tes saisies de compteur."
    : `<b style="color:var(${st.level === "over" ? "--danger" : st.level === "soon" ? "--charge" : "--net"})">${esc(entLine(st).t)}</b><br>${esc(entLine(st).s)}<br>Compteur actuel ≈ ${kmTxt(st.cur)} · fait depuis l'entretien : ${kmTxt(st.fait)} sur ${kmTxt(st.e.intervalle)}.`;
  openSheet(backBtn() + `
      <h3>Véhicule</h3>
      <div class="seg three vtabs" role="tablist" aria-label="Rubriques du véhicule">${[["voiture", "Voiture"], ["assurance", "Assurance"], ["entretien", "Entretien"]].map(([id, l]) => `<button type="button" role="tab" data-vtab="${id}" aria-selected="${vehTab === id}">${l}${id === "entretien" && (st && /over|soon/.test(st.level) || cst && /over|soon/.test(cst.level)) ? `<span class="vdot${(st && st.level === "over") || (cst && cst.level === "over") ? " over" : ""}" aria-label="à surveiller"></span>` : ""}</button>`).join("")}</div>
      <div data-vpane="voiture" ${vehTab === "voiture" ? "" : "hidden"}>
      <div class="vblock">
      <h4><span class="vic" aria-hidden="true">🚗</span>Ma voiture</h4>
      <div class="seg two" role="radiogroup" aria-label="Véhicule">${[["achat", "Achetée"], ["location", "En location"]].map(([id, l]) => `<button type="button" role="radio" data-veh="${id}" aria-checked="${c.vehicule.type === id}">${l}</button>`).join("")}</div>
      <div id="vehAchat" ${c.vehicule.type === "achat" ? "" : "hidden"}>
        <div class="cur">Le prix de la voiture est étalé sur sa durée d'utilisation. Le coût apparaît dans le détail de la semaine et du mois, sans être ajouté aux dépenses.</div>
        <div class="list cars">${c.vehicule.cars.length ? c.vehicule.cars.slice().sort((a, b) => a.date < b.date ? 1 : -1).map(x => {
        const now = carAt(todayIso()), isCur = now && now.id === x.id;
        return `<button type="button" class="item" data-car="${esc(x.id)}"><div><span class="car-name">${esc(x.nom)}</span>${isCur ? ' <span class="pill ok" style="float:none;margin:0 0 0 6px">Actuelle</span>' : ""}<small>Achetée le ${x.date.split("-").reverse().join("/")} · ${eur0(x.prix)} · ${numTxt(x.ans)} an${x.ans > 1 ? "s" : ""} · ${eur(r2(Math.max(0, x.prix - (x.revente || 0)) / (x.ans * 52)))} / semaine${x.kmAchat ? " · " + Math.round(x.kmAchat).toLocaleString("fr-FR") + " km à l'achat" : ""}</small></div><b>›</b></button>`; }).join("")
        : '<div class="item empty">Aucune voiture enregistrée.</div>'}</div>
        <button class="btn ghost" id="carAdd" type="button" style="width:100%">＋ Ajouter une voiture</button>
        ${tgl("carDed", c.vehicule.deduire, "Afficher aussi le net après voiture", "dans le détail de la semaine et du mois")}
      </div>
      <div id="vehLoc" ${c.vehicule.type === "location" ? "" : "hidden"}>
        <label class="fl" for="locAmt">Loyer de la voiture (€)</label>
        <div class="addrow"><input id="locAmt" type="text" inputmode="decimal" autocomplete="off" placeholder="ex. 900" value="${num(c.vehicule.loyer)}">
          <div class="seg two mini" role="radiogroup" aria-label="Loyer par">${[["mois", "/ mois"], ["semaine", "/ semaine"]].map(([id, l]) => `<button type="button" role="radio" data-per="${id}" aria-checked="${c.vehicule.periode === id}">${l}</button>`).join("")}</div></div>
        <div class="cur" id="locWeek"></div>
        ${tgl("locAss", c.vehicule.assurInclus, "Assurance incluse dans la location", "pas de ligne assurance à part")}
      </div>
      </div>
      </div>

      <div data-vpane="assurance" ${vehTab === "assurance" ? "" : "hidden"}>
      <div class="vblock">
      <h4><span class="vic" aria-hidden="true">🛡️</span>Assurance</h4>
      <div class="cur" id="assIncl" hidden>Ton assurance est incluse dans la location : rien à ajouter ici. Tu peux changer ça dans l'onglet Voiture.</div>
      <div id="assSec">
      ${tgl("assOn", c.assur.on, "Ajouter mon assurance chaque semaine", "le prix mensuel est réparti sur les semaines")}
      <div id="assBox" ${c.assur.on ? "" : "hidden"}>
        <label class="fl" for="assAmt">Prix par mois (€)</label>
        <input id="assAmt" type="text" inputmode="decimal" autocomplete="off" placeholder="ex. 160" value="${num(c.assur.mensuel)}">
        <div class="cur" id="assWeek"></div>
      </div>
      </div>
      </div>
      </div>

      <div data-vpane="entretien" ${vehTab === "entretien" ? "" : "hidden"}>
      <div class="vblock">
      <h4><span class="vic" aria-hidden="true">🔧</span>Entretien</h4>
      <div class="cur" id="eCur">${entTxt}</div>
      <label class="fl" for="eInt">Entretien tous les (km)</label>
      <input id="eInt" type="text" inputmode="numeric" autocomplete="off" placeholder="ex. 15 000" value="${numTxt(e.intervalle)}">
      <label class="fl" for="eDate">Date du dernier entretien</label>
      <input id="eDate" class="small" type="date" value="${esc(e.lastDate)}">
      <label class="fl" for="eKm">Compteur au dernier entretien (km)</label>
      <input id="eKm" type="text" inputmode="numeric" autocomplete="off" placeholder="${cur ? "ex. " + cur.toLocaleString("fr-FR") : "ex. 152 000"}" value="${e.lastDate ? numTxt(e.lastKm) : ""}">
      <button class="btn ghost small" id="eToday" type="button" style="margin-top:8px">Entretien fait aujourd'hui${cur ? " · compteur " + cur.toLocaleString("fr-FR") : ""}</button>
      </div>

      <div class="vblock">
      <h4><span class="vic" aria-hidden="true">📋</span>Visite technique</h4>
      <div class="cur">${ctTxt}</div>
      <label class="fl" for="ctLast">Date de la dernière visite technique</label>
      <input id="ctLast" class="small" type="date" value="${esc(ct.lastDate)}">
      <button class="btn ghost small" id="ctDone" type="button" style="margin-top:8px">✓ J'ai fait la visite technique</button>
      ${ct.hist.length ? `<div class="list" style="margin-top:10px">${ct.hist.map((h, i) => `<div class="item"><div>Visite du ${h.date.split("-").reverse().join("/")}<small>${h.prix ? eur(h.prix) : "prix non saisi"}</small></div><button class="xbtn" type="button" data-cth="${i}">Retirer</button></div>`).join("")}</div>` : ""}

      </div>

      <div class="vblock">
      <h4><span class="vic" aria-hidden="true">🔔</span>Rappels</h4>
      ${tgl("eNotif", e.notif, "Notifications sur le téléphone", "entretien à moins de 1 000 km, visite technique à moins de 30 jours, puis si c'est dépassé")}
      </div>
      </div>

      <p class="note">Loyer et assurance sont ajoutés automatiquement aux dépenses à partir de cette semaine, sans toucher à l'historique. Pour l'entretien, une pastille orange apparaît dans le Journal à moins de 1 000 km, et pour la visite technique à moins de 30 jours. Elle devient rouge si c'est dépassé.</p>
      <button class="btn primary" id="saveVeh" style="width:100%;margin-top:12px">Enregistrer</button>`);
  bindBack();
  ["assOn", "locAss", "carDed", "eNotif"].forEach(flip);
  let veh = c.vehicule.type, per = c.vehicule.periode;
  const vehUpd = () => {
    $("sheet").querySelectorAll("[data-veh]").forEach(b => b.setAttribute("aria-checked", String(b.dataset.veh === veh)));
    $("sheet").querySelectorAll("[data-per]").forEach(b => b.setAttribute("aria-checked", String(b.dataset.per === per)));
    $("vehAchat").hidden = veh !== "achat"; $("vehLoc").hidden = veh !== "location";
    $("assSec").hidden = veh === "location" && isOn("locAss"); $("assIncl").hidden = !$("assSec").hidden;
    const n = parse($("locAmt").value);
    $("locWeek").textContent = n > 0 ? (per === "semaine" ? `${eur(n)} ajoutés aux dépenses chaque semaine.` : `Soit ${eur(r2(n / WEEKS_PER_MONTH))} par semaine (${eur(n)} × 12 ÷ 52), ajoutés chaque semaine.`) : "Tape le montant du loyer.";
  };
  $("sheet").querySelectorAll("[data-veh]").forEach(b => (b.onclick = () => { veh = b.dataset.veh; vehUpd(); }));
  $("sheet").querySelectorAll("[data-per]").forEach(b => (b.onclick = () => { per = b.dataset.per; vehUpd(); }));
  $("locAss").addEventListener("click", vehUpd); $("locAmt").oninput = vehUpd; vehUpd();
  $("sheet").querySelectorAll("[data-vtab]").forEach(b => (b.onclick = () => {
    vehTab = b.dataset.vtab;
    $("sheet").querySelectorAll("[data-vtab]").forEach(x => x.setAttribute("aria-selected", String(x === b)));
    $("sheet").querySelectorAll("[data-vpane]").forEach(x => (x.hidden = x.dataset.vpane !== vehTab));
  }));
  $("carAdd").onclick = () => openCar(null);
  $("sheet").querySelectorAll("[data-car]").forEach(b => (b.onclick = () => openCar(cfg().vehicule.cars.find(x => x.id === b.dataset.car))));
  $("assOn").addEventListener("click", () => ($("assBox").hidden = !isOn("assOn")));
  const wk = () => { const n = parse($("assAmt").value);
    $("assWeek").textContent = n > 0 ? `Soit ${eur(r2(n / WEEKS_PER_MONTH))} par semaine (${eur(n)} × 12 mois ÷ 52 semaines).` : "Tape le prix mensuel de ton assurance."; };
  $("assAmt").oninput = wk; wk();
  $("ctDone").onclick = openCtDone;
  $("sheet").querySelectorAll("[data-cth]").forEach(b => (b.onclick = async () => {
    if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Confirmer"; b.classList.add("danger"); return; }
    const n = cfg(), hist = ctCfg().hist.filter((_, i) => i !== Number(b.dataset.cth)).sort((a, c) => a.date < c.date ? 1 : -1);
    n.ct = { lastDate: hist.length ? hist[0].date : "", hist }; await saveCfg(n); renderAll(); openVehicule(); toast("Visite retirée de l'historique");
  }));
  $("eToday").onclick = () => { $("eDate").value = todayIso(); if (cur) $("eKm").value = String(cur); };
  $("eNotif").addEventListener("click", async () => {
    if (!isOn("eNotif")) return;
    if (!("Notification" in window)) { $("eNotif").setAttribute("aria-pressed", "false"); toast("Notifications : ouvre l'appli depuis l'icône de l'écran d'accueil", true); return; }
    try { if (Notification.permission !== "granted" && await Notification.requestPermission() !== "granted") { $("eNotif").setAttribute("aria-pressed", "false"); toast("Notifications refusées dans les réglages du téléphone", true); } } catch (_) {}
  });
  $("saveVeh").onclick = async () => {
    const n = cfg(), old = cfg(), monIso = iso(monday(new Date()));
    const assOnNew = isOn("assOn"), aa = parse($("assAmt").value), la = parse($("locAmt").value), locIncl = isOn("locAss");
    if (veh === "location" && !(la > 0)) { toast("Tape le loyer de la voiture", true); return; }
    if (assOnNew && !(veh === "location" && locIncl) && !(aa > 0)) { toast("Tape le prix mensuel de l'assurance", true); return; }
    // entretien : facultatif, mais complet si commencé
    const it = parse($("eInt").value), date = $("eDate").value, kmRaw = $("eKm").value.trim(), km = parse(kmRaw);
    if (date || kmRaw) {
      if (!(it >= 500 && it <= 100000)) { toast("Entretien : tape un intervalle entre 500 et 100 000 km", true); return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { toast("Entretien : choisis la date du dernier entretien", true); return; }
      if (date > todayIso()) { toast("Entretien : la date ne peut pas être dans le futur", true); return; }
      if (!(km >= 0) || !kmRaw) { toast("Entretien : tape le compteur du dernier entretien", true); return; }
    }
    n.vehicule = { type: veh, periode: per, assurInclus: locIncl, loyer: veh === "location" ? r2(la) : old.vehicule.loyer,
      cars: old.vehicule.cars, deduire: isOn("carDed"),
      depuis: veh === "location" && (old.vehicule.type !== "location" || !(old.vehicule.loyer > 0)) ? monIso : old.vehicule.depuis || monIso };
    n.assur = { on: assOnNew, mensuel: assOnNew && aa > 0 ? r2(aa) : old.assur.mensuel,
      depuis: assOnNew && !old.assur.on ? monIso : old.assur.depuis || monIso };
    const oe = entCfg(), nk = date ? Math.round(km) : 0;
    const hist = oe.lastDate && date > oe.lastDate ? [{ date: oe.lastDate, km: oe.lastKm }].concat(oe.hist).slice(0, 10) : oe.hist;
    const ctd = $("ctLast").value;
    if (ctd && ctd > todayIso()) { toast("Visite technique : la date ne peut pas être dans le futur", true); return; }
    const oc = ctCfg();
    // la date saisie corrige la dernière visite (pas une visite de plus)
    if (ctd !== oc.lastDate) {
      let hist = oc.hist.filter(h => h.date !== ctd);
      const i = hist.findIndex(h => h.date === oc.lastDate);
      if (ctd) { if (i >= 0) hist[i] = { ...hist[i], date: ctd }; else hist.push({ date: ctd, prix: 0, dep: "" }); } else if (i >= 0) hist.splice(i, 1);
      hist = hist.sort((a, b) => a.date < b.date ? 1 : -1);
      n.ct = { lastDate: hist.length ? hist[0].date : "", hist };
    }
    n.entretien = { intervalle: it > 0 ? Math.round(it) : oe.intervalle, lastDate: date || "", lastKm: nk, notif: isOn("eNotif"), hist };
    try { await saveCfg(n); await autoCharges(true); closeSheet(); renderAll(); toast("Véhicule enregistré"); }
    catch (err) { toast("Enregistrement impossible", true); }
  };
}

const tgl = (id, on, label, sub) => `<button class="toggle" type="button" id="${id}" aria-pressed="${!!on}"><span>${label}${sub ? `<small class="tsub">${sub}</small>` : ""}</span><span class="sw"></span></button>`;
const flip = id => ($(id).onclick = () => $(id).setAttribute("aria-pressed", $(id).getAttribute("aria-pressed") === "true" ? "false" : "true"));
const isOn = id => $(id).getAttribute("aria-pressed") === "true";
const numTxt = x => (x || x === 0 ? String(x).replace(".", ",") : "");

// ---------- Une voiture achetée (ajout ou modification) ----------
function openCar(x) {
  const e = x || { id: "", nom: "", date: todayIso(), prix: "", kmAchat: "", ans: 3, revente: "" };
  openSheet(`<button class="backlink" id="carBack" type="button">‹ Véhicule</button>
      <h3>${x ? "Modifier la voiture" : "Nouvelle voiture"}</h3>
      <label class="fl" for="cNom">Nom de la voiture</label>
      <input id="cNom" class="small" type="text" maxlength="40" autocomplete="off" placeholder="ex. Toyota C-HR hybride" value="${esc(e.nom)}">
      <label class="fl" for="cDate">Date d'achat</label>
      <input id="cDate" class="small" type="date" value="${esc(e.date)}">
      <label class="fl" for="cPrix">Prix d'achat (€)</label>
      <input id="cPrix" type="text" inputmode="decimal" autocomplete="off" placeholder="ex. 15 000" value="${numTxt(e.prix)}">
      <label class="fl" for="cKm">Km au compteur à l'achat</label>
      <input id="cKm" type="text" inputmode="numeric" autocomplete="off" placeholder="ex. 45 000" value="${numTxt(e.kmAchat)}">
      <label class="fl" for="cAns">Durée d'utilisation prévue (années)</label>
      <input id="cAns" type="text" inputmode="decimal" autocomplete="off" placeholder="ex. 3" value="${numTxt(e.ans)}">
      <label class="fl" for="cRev">Prix de revente prévu (€, facultatif)</label>
      <input id="cRev" type="text" inputmode="decimal" autocomplete="off" placeholder="ex. 4 000" value="${numTxt(e.revente)}">
      <div class="cur" id="cCalc"></div>
      <div class="stack" style="margin-top:12px">
        <button class="btn primary" id="cSave">Enregistrer</button>
        ${x ? `<button class="btn ghost" id="cDel">Retirer cette voiture</button>` : ""}
      </div>
      <p class="note">Tu changes de voiture ? Ajoute la nouvelle avec sa date d'achat : elle prend le relais à partir de ce jour, l'ancienne garde son historique.</p>`, "cNom");
  $("carBack").onclick = openVehicule;
  const calc = () => { const p = parse($("cPrix").value), a = parse($("cAns").value), r = parse($("cRev").value) || 0;
    $("cCalc").textContent = p > 0 && a > 0 ? `Coût : ${eur(r2(Math.max(0, p - r) / (a * 12)))} par mois, soit ${eur(r2(Math.max(0, p - r) / (a * 52)))} par semaine pendant ${numTxt(a)} an${a > 1 ? "s" : ""}.` : "Tape le prix et la durée pour voir le coût par semaine."; };
  ["cPrix", "cAns", "cRev"].forEach(id => ($(id).oninput = calc)); calc();
  $("cSave").onclick = async () => {
    const nom = $("cNom").value.trim(), date = $("cDate").value, p = parse($("cPrix").value), a = parse($("cAns").value), km = parse($("cKm").value), r = parse($("cRev").value);
    if (!nom) { toast("Tape le nom de la voiture", true); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { toast("Choisis la date d'achat", true); return; }
    if (!(p > 0)) { toast("Tape le prix d'achat", true); return; }
    if (!(a > 0 && a <= 20)) { toast("Tape une durée entre 1 et 20 ans", true); return; }
    if (r > 0 && r >= p) { toast("La revente doit être inférieure au prix d'achat", true); return; }
    const n = cfg(), rec = { id: x ? x.id : "car" + Date.now().toString(36), nom, date, prix: r2(p), ans: r2(a), kmAchat: km > 0 ? Math.round(km) : 0, revente: r > 0 ? r2(r) : 0 };
    n.vehicule.cars = n.vehicule.cars.filter(c => c.id !== rec.id).concat(rec);
    if (n.vehicule.type !== "achat") n.vehicule.type = "achat";
    await saveCfg(n); renderAll(); openVehicule(); toast(x ? "Voiture modifiée" : `${nom} ajoutée`);
  };
  if (x) $("cDel").onclick = async () => {
    const b = $("cDel");
    if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.className = "btn danger"; b.textContent = "Confirmer : retirer " + x.nom; return; }
    const n = cfg(); n.vehicule.cars = n.vehicule.cars.filter(c => c.id !== x.id); await saveCfg(n); renderAll(); openVehicule(); toast("Voiture retirée");
  };
}

// ---------- Mon statut : société, auto-entrepreneur ou salarié ----------
function openStatut(back) {
  const c = cfg(), st = c.statut;
  // Informations de l'exploitant, gardées à part : société de rattachement (salarié) ou ta propre entreprise
  const pick = o => { const r = {}; EX_FIELDS.forEach(k => (r[k] = (o && o[k]) || "")); return r; };
  const drafts = { rat: pick(c.exploitRat || c.societe), pro: pick(c.exploitPro) };
  if (!drafts.rat.nom && c.rattach.nom && c.rattach.nom !== "Rattachement") drafts.rat.nom = c.rattach.nom;
  const chf = (() => { const o = c.chauffeur || c.societe || {}; const r = {}; CH_INFO.forEach(k => (r[k] = o[k] || "")); return r; })();
  const kindOf = t => t === "salarie" ? "rat" : "pro";
  const sf = (id, lbl, ph, type = "text", mode = "", val = "") => `<label class="fl" for="so-${id}" id="lb-${id}">${lbl}</label><input id="so-${id}" class="small" type="${type}"${mode ? ` inputmode="${mode}"` : ""} autocomplete="off" placeholder="${ph}" value="${esc(val)}">`;
  openSheet(backBtn() + `
      <h3>Statut et société</h3>
      <div class="cur">L'appli retire de ton chiffre d'affaires les charges liées à ton statut, chaque semaine.</div>
      <div class="stack" role="radiogroup" aria-label="Statut">${Object.entries(STATUTS).map(([id, l]) => `<button type="button" class="radio-row" role="radio" data-st="${id}" aria-checked="${st.type === id}"><span class="dot"></span>${l}</button>`).join("")}</div>

      <div id="bxSoc" class="stbox">
        <label class="fl" for="provPct">Part à mettre de côté pour les charges et l'impôt (% du bénéfice)</label>
        <input id="provPct" type="text" inputmode="decimal" autocomplete="off" placeholder="ex. 25" value="${numTxt(st.provision)}">
        <p class="note">Chaque semaine, ce pourcentage du bénéfice (CA − dépenses) est mis de côté dans « Provision impôts et charges ». Fixe-le avec ton comptable.</p>
      </div>

      <div id="bxAuto" class="stbox">
        <label class="fl" for="tauxCot">Cotisations sociales (% du CA)</label>
        <input id="tauxCot" type="text" inputmode="decimal" autocomplete="off" placeholder="21,2" value="${numTxt(st.taux)}">
        <label class="fl" for="tauxCfp">Formation professionnelle, CFP (% du CA)</label>
        <input id="tauxCfp" type="text" inputmode="decimal" autocomplete="off" placeholder="0,1" value="${numTxt(st.cfp)}">
        <div class="pair-lbl" style="margin-top:14px">ACRE (aide à la création)</div>
        <div class="seg three" role="radiogroup" aria-label="ACRE">${[["non", "Pas d'ACRE"], ["50", "− 50 %"], ["25", "− 25 %"]].map(([id, l]) => `<button type="button" role="radio" data-acre="${id}" aria-checked="${st.acre === id}">${l}</button>`).join("")}</div>
        <div class="cur">− 50 % si ton activité a été créée avant le 1er juillet 2026, − 25 % si elle a été créée depuis. L'ACRE réduit seulement les cotisations sociales.</div>
        <div id="acreRow"><label class="fl" for="acreFin">ACRE jusqu'au</label>
        <input id="acreFin" class="small" type="date" value="${esc(st.acreFin)}"></div>
        <div class="pair-lbl" style="margin-top:14px">Impôt sur le revenu</div>
        ${tgl("vlOn", st.vl, `Versement libératoire (${numTxt(VL_RATE)} % du CA)`, "l'impôt est payé avec les cotisations")}
        <div class="cur" id="vlNote"></div>
        <div class="cur" id="autoEx"></div>
      </div>

      <div id="bxSal" class="stbox">
        ${tgl("ratOn", c.rattach.on, "Je paie un rattachement chaque semaine", "ajouté aux dépenses chaque semaine travaillée")}
        <div id="ratBox">
          <label class="fl" for="ratAmt">Commission par semaine (€)</label>
          <input id="ratAmt" type="text" inputmode="decimal" autocomplete="off" placeholder="ex. 50" value="${numTxt(c.rattach.montant)}">
        </div>
      </div>

      <div id="bxRetro">${tgl("retroOn", false, "Appliquer aussi à mes semaines déjà saisies", "ajoute les cotisations sur tout l'historique du Journal (sinon : à partir de cette semaine)")}</div>

      <div class="vblock" style="margin-top:16px">
        <h4><span class="vic" aria-hidden="true">🏢</span><span id="exTitle"></span></h4>
        <div class="cur" id="exIntro"></div>
        ${sf("nom", "", "", "text", "", "")}
        ${sf("adresse", "Adresse complète", "ex. 59 rue …, 75008 Paris")}
        ${sf("tel", "Téléphone", "ex. 01 23 45 67 89", "tel")}${sf("email", "Email (facultatif)", "ex. contact@…", "email")}
        ${sf("registre", "N° d'inscription au registre VTC", "ex. EVTC075…")}${sf("siren", "", "ex. 123 456 789 00012", "text", "numeric")}
      </div>
      <div class="vblock">
        <h4><span class="vic" aria-hidden="true">🪪</span>Chauffeur</h4>
        ${sf("chauffeur", "Nom et prénom du chauffeur", "Nom Prénom", "text", "", chf.chauffeur)}${sf("carte", "N° de carte professionnelle VTC", "facultatif", "text", "", chf.carte)}${sf("immat", "Immatriculation du véhicule", "ex. AB-123-CD", "text", "", chf.immat)}
        <div class="cur">Ces informations sont imprimées sur tes bons de commande.</div>
      </div>
      <p class="note">Taux 2026 indicatifs : vérifie-les sur ton espace URSSAF. Les montants sont ajoutés à partir de cette semaine, sans toucher à l'historique (sauf si tu actives « Appliquer aussi à mes semaines déjà saisies »). Si tu changes de statut, les informations de ta société de rattachement et celles de ta propre entreprise restent gardées à part.</p>
      <button class="btn primary" id="saveSt" style="width:100%;margin-top:12px">Enregistrer</button>`);
  bindBack(); flip("vlOn"); flip("ratOn"); flip("retroOn");
  let type = st.type, acre = st.acre, kind = kindOf(type);
  const exFill = () => {
    const d = drafts[kind];
    EX_FIELDS.forEach(k => ($("so-" + k).value = d[k] || ""));
    $("exTitle").textContent = ({ salarie: "Ma société de rattachement", auto: "Mon entreprise", societe: "Ma société" })[type];
    $("exIntro").textContent = type === "salarie" ? "C'est l'exploitant VTC sur tes bons de commande. Tu trouves ses informations en haut d'un bon de commande Uber."
      : type === "auto" ? "Auto-entrepreneur : c'est toi l'exploitant VTC sur tes bons de commande." : "Ta société (SASU, EURL…) est l'exploitant VTC sur tes bons de commande.";
    $("lb-nom").textContent = type === "salarie" ? "Nom de la société de rattachement" : type === "auto" ? "Ton nom ou nom commercial" : "Raison sociale";
    $("so-nom").placeholder = type === "salarie" ? "comme sur ton bon de commande Uber" : "";
    $("lb-siren").textContent = type === "salarie" ? "SIREN ou SIRET (facultatif)" : "SIRET";
  };
  const exKeep = () => EX_FIELDS.forEach(k => (drafts[kind][k] = $("so-" + k).value.trim()));
  const upd = () => {
    $("sheet").querySelectorAll("[data-st]").forEach(b => b.setAttribute("aria-checked", String(b.dataset.st === type)));
    $("sheet").querySelectorAll("[data-acre]").forEach(b => b.setAttribute("aria-checked", String(b.dataset.acre === acre)));
    $("bxSoc").hidden = type !== "societe"; $("bxAuto").hidden = type !== "auto"; $("bxSal").hidden = type !== "salarie"; $("bxRetro").hidden = type === "salarie";
    $("acreRow").hidden = acre === "non"; $("ratBox").hidden = !isOn("ratOn");
    $("vlNote").textContent = isOn("vlOn") ? "" : "Sans versement libératoire, l'impôt est calculé sur ta déclaration annuelle (abattement de 50 % sur le CA) : l'appli ne le déduit pas chaque semaine.";
    const t = parse($("tauxCot").value) || 0, f = parse($("tauxCfp").value) || 0, red = ACRE_RED[acre] || 0;
    const tot = t * (1 - red) + f + (isOn("vlOn") ? VL_RATE : 0);
    $("autoEx").textContent = `Total retenu : ${numTxt(r2(tot))} % du CA, soit ${eur(r2(1000 * tot / 100))} pour 1 000 € de CA${red ? " pendant l'ACRE" : ""}.`;
  };
  $("sheet").querySelectorAll("[data-st]").forEach(b => (b.onclick = () => { exKeep(); type = b.dataset.st; kind = kindOf(type); exFill(); upd(); }));
  exFill();
  $("sheet").querySelectorAll("[data-acre]").forEach(b => (b.onclick = () => { acre = b.dataset.acre; upd(); }));
  ["vlOn", "ratOn"].forEach(id => $(id).addEventListener("click", upd));
  ["tauxCot", "tauxCfp"].forEach(id => ($(id).oninput = upd)); upd();
  $("saveSt").onclick = async () => {
    const n = cfg(), old = cfg(), monIso = iso(monday(new Date()));
    const pv = parse($("provPct").value), tc = parse($("tauxCot").value), tf = parse($("tauxCfp").value), ra = parse($("ratAmt").value);
    if (type === "societe" && !(pv >= 0 && pv <= 90)) { toast("Tape un pourcentage entre 0 et 90", true); return; }
    if (type === "auto" && !(tc >= 0 && tc <= 60) ) { toast("Tape le taux de cotisations", true); return; }
    if (type === "auto" && acre !== "non" && !$("acreFin").value) { toast("Indique la date de fin de l'ACRE", true); return; }
    if (type === "salarie" && isOn("ratOn") && !(ra > 0)) { toast("Tape la commission par semaine", true); return; }
    n.statut = { type, provision: type === "societe" ? r2(pv) : old.statut.provision, taux: type === "auto" ? r2(tc) : old.statut.taux,
      cfp: type === "auto" && tf >= 0 ? r2(tf) : old.statut.cfp, acre, acreFin: acre === "non" ? "" : $("acreFin").value, vl: isOn("vlOn"),
      depuis: type !== old.statut.type || !(S.cfg && S.cfg.statut) ? monIso : old.statut.depuis || monIso };
    if (type !== "salarie" && isOn("retroOn")) { const f = [...S.days.keys()].sort()[0]; if (f) n.statut.depuis = iso(monday(fromIso(f))); } // depuis le début du Journal
    exKeep();
    n.exploitRat = { ...(old.exploitRat || {}), ...drafts.rat }; n.exploitPro = { ...(old.exploitPro || {}), ...drafts.pro };
    n.chauffeur = {}; CH_INFO.forEach(k => (n.chauffeur[k] = $("so-" + k).value.trim()));
    if (type === "salarie") n.rattach = { on: isOn("ratOn"), nom: drafts.rat.nom || old.rattach.nom || "Rattachement", montant: isOn("ratOn") ? r2(ra) : old.rattach.montant,
      depuis: isOn("ratOn") && (!old.rattach.on || old.statut.type !== "salarie") ? monIso : old.rattach.depuis || monIso };
    try {
      await saveCfg(n);
      // changement de statut : on retire les lignes automatiques de l'ancien statut à partir de cette semaine
      if (type !== old.statut.type) for (const x of S.deps.filter(x => x.auto && x.date >= monIso && /^(urssaf|ir|prov|rat)-/.test(x.id))) {
        if (x.id.startsWith("rat-") && type === "salarie") continue;
        await del("depenses", x.id); S.deps = S.deps.filter(d => d.id !== x.id);
      }
      await autoCharges(true); renderAll(); toast("Enregistré");
      if (back && back.id) openResa(back); else closeSheet();
    } catch (e) { toast("Enregistrement impossible", true); }
  };
}

// ---------- Mes dépenses : catégories perso et charges fixes ----------
let depTab = "resume"; // onglet ouvert de la page Mes dépenses (gardé après un ajout ou un retrait)
function openDepCfg() {
  const c = cfg();
  openSheet(backBtn() + `
      <h3>Mes dépenses</h3>
      <div class="seg three vtabs" role="tablist" aria-label="Rubriques des dépenses">${[["resume", "Résumé"], ["fixes", "Charges fixes"], ["cats", "Catégories"]].map(([id, l]) => `<button type="button" role="tab" data-dtab="${id}" aria-selected="${depTab === id}">${l}</button>`).join("")}</div>
      <div data-dpane="resume" ${depTab === "resume" ? "" : "hidden"}>
      <div class="cur">Ajoutées automatiquement à tes dépenses chaque semaine. Touche une ligne pour la modifier.</div>
      ${(() => { const st = c.statut, rows = [];
      if (ratOn()) rows.push(["statut", "Rattachement · " + esc(ratName()), eur(c.rattach.montant) + " / semaine", c.rattach.montant]);
      if (st.type === "auto") rows.push(["statut", "Cotisations URSSAF", numTxt(st.taux) + " % du CA" + (st.vl ? " + impôt " + numTxt(VL_RATE) + " %" : ""), 0]);
      if (st.type === "societe") rows.push(["statut", "Provision impôts et charges", numTxt(st.provision) + " % du CA", 0]);
      if (loyerWeek()) rows.push(["vehicule", "Location voiture", eur(loyerWeek()) + " / semaine", loyerWeek()]);
      if (assurWeek()) rows.push(["vehicule", "Assurance", eur(c.assur.mensuel) + " / mois · " + eur(assurWeek()) + " / semaine", assurWeek()]);
      c.fixes.forEach(f => rows.push(["", esc(f.nom), eur(f.montant) + " " + PER_LBL[f.periode] + (f.periode !== "semaine" ? " · " + eur(fixWeek(f)) + " / semaine" : ""), fixWeek(f)]));
      const tot = r2(rows.reduce((a, r) => a + r[3], 0));
      return `<div class="list">${rows.length ? rows.map(([pg, t, v]) => pg ? `<button class="item" data-go="${pg}"><div>${t}<small>${v}</small></div><b>›</b></button>` : `<button class="item" data-gofix><div>${t}<small>${v}</small></div><b>›</b></button>`).join("") +
        `<div class="item"><div><b>Total fixe</b><small>sans les montants en % du CA</small></div><b>${eur(tot)} / semaine</b></div>` : `<div class="item empty">Aucune charge automatique pour l'instant.</div>`}</div>`; })()}
      </div>
      <div data-dpane="fixes" ${depTab === "fixes" ? "" : "hidden"}>
      <div class="cur">Téléphone, comptable, mutuelle, abonnement… Le montant est réparti et ajouté aux dépenses chaque semaine.</div>
      <div class="list">${c.fixes.length ? c.fixes.map(f => `<div class="item"><div>${esc(f.nom)}<small>${eur(f.montant)} ${PER_LBL[f.periode]}${f.periode !== "semaine" ? " · " + eur(fixWeek(f)) + " / semaine" : ""}</small></div><button class="xbtn" data-fix="${esc(f.id)}" aria-label="Retirer ${esc(f.nom)}">Retirer</button></div>`).join("") : `<div class="item empty">Aucune charge fixe.</div>`}</div>
      <label class="fl" for="fxNom">Nouvelle charge fixe</label>
      <input id="fxNom" class="small" type="text" maxlength="30" autocomplete="off" placeholder="ex. Téléphone">
      <div class="addrow"><input id="fxAmt" type="text" inputmode="decimal" autocomplete="off" placeholder="Montant €" aria-label="Montant">
        <div class="seg three mini" role="radiogroup" aria-label="Période">${Object.entries(PER_LBL).map(([id, l]) => `<button type="button" role="radio" data-fper="${id}" aria-checked="${id === "mois"}">${l.replace("/ ", "")}</button>`).join("")}</div></div>
      <button class="btn ghost" id="fxAdd" style="width:100%">Ajouter la charge fixe</button>
      </div>
      <div data-dpane="cats" ${depTab === "cats" ? "" : "hidden"}>
      <div class="cur">Les dépenses sont rangées en 4 groupes : ${CAT_GROUPS.map(g => g.t).join(", ")}. Ajoute tes propres détails dans le groupe de ton choix (ex. Voiture · Carrosserie).</div>
      <div class="chips">${c.cats.length ? c.cats.map(t => `<button class="chip" data-cat="${esc(t)}" aria-label="Retirer ${esc(t)}">${esc(grpInfo(catGrp(t)).t)} · ${esc(t)} ✕</button>`).join("") : '<span class="cur">Aucun détail ajouté.</span>'}</div>
      <div class="seg" role="radiogroup" aria-label="Groupe du nouveau détail">${CAT_GROUPS.map((g, i) => `<button type="button" role="radio" data-ctg="${g.k}" aria-checked="${i === 0}">${g.t.replace(" et administratif", "")}</button>`).join("")}</div>
      <div class="addrow"><input id="ctNom" class="small" type="text" maxlength="24" autocomplete="off" placeholder="Nouveau détail (ex. Carrosserie)" aria-label="Nouveau détail"><button class="btn ghost small" id="ctAdd" type="button">Ajouter</button></div>
      </div>
      <p class="note">Retirer une catégorie ou une charge fixe ne supprime pas les dépenses déjà enregistrées.</p>`);
  bindBack();
  const showDep = t => { depTab = t; $("sheet").querySelectorAll("[data-dtab]").forEach(x => x.setAttribute("aria-selected", String(x.dataset.dtab === t))); $("sheet").querySelectorAll("[data-dpane]").forEach(x => (x.hidden = x.dataset.dpane !== t)); };
  $("sheet").querySelectorAll("[data-dtab]").forEach(b => (b.onclick = () => showDep(b.dataset.dtab)));
  $("sheet").querySelectorAll("[data-gofix]").forEach(b => (b.onclick = () => showDep("fixes")));
  $("sheet").querySelectorAll("[data-go]").forEach(b => (b.onclick = () => openSettings(b.dataset.go)));
  let fper = "mois";
  $("sheet").querySelectorAll("[data-fper]").forEach(b => (b.onclick = () => { fper = b.dataset.fper; $("sheet").querySelectorAll("[data-fper]").forEach(x => x.setAttribute("aria-checked", String(x === b))); }));
  $("fxAdd").onclick = async () => {
    const nom = $("fxNom").value.trim().replace(/\s+/g, " "), m = parse($("fxAmt").value);
    if (!nom) { toast("Tape le nom de la charge", true); return; }
    if (!(m > 0)) { toast("Tape le montant", true); return; }
    const n = cfg();
    if (n.fixes.some(f => f.nom.toLowerCase() === nom.toLowerCase())) { toast("Cette charge existe déjà", true); return; }
    n.fixes.push({ id: Date.now().toString(36), nom, montant: r2(m), periode: fper, depuis: iso(monday(new Date())) });
    await saveCfg(n); await autoCharges(true); renderAll(); openDepCfg(); toast(`${nom} ajoutée`);
  };
  $("sheet").querySelectorAll("[data-fix]").forEach(b => (b.onclick = async () => {
    if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Confirmer"; b.classList.add("danger"); return; }
    const n = cfg(); n.fixes = n.fixes.filter(f => f.id !== b.dataset.fix); await saveCfg(n); renderAll(); openDepCfg(); toast("Charge fixe retirée");
  }));
  let ctg = "voiture";
  $("ctAdd").onclick = async () => {
    const t = $("ctNom").value.trim().replace(/\s+/g, " ");
    if (!t) { toast("Tape le nom de la catégorie", true); return; }
    if (catList().some(x => x.toLowerCase() === t.toLowerCase())) { toast("Cette catégorie existe déjà", true); return; }
    const n = cfg(); n.cats.push(t); n.catGrp = { ...(n.catGrp || {}), [t]: ctg }; await saveCfg(n); openDepCfg(); toast(`${grpInfo(ctg).t} · ${t} ajouté`);
  };
  $("sheet").querySelectorAll("[data-ctg]").forEach(b => (b.onclick = () => { ctg = b.dataset.ctg; $("sheet").querySelectorAll("[data-ctg]").forEach(x => x.setAttribute("aria-checked", String(x === b))); }));
  $("sheet").querySelectorAll("[data-cat]").forEach(b => (b.onclick = async () => {
    if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Retirer " + b.dataset.cat + " ?"; b.classList.add("danger"); return; }
    const n = cfg(); n.cats = n.cats.filter(x => x !== b.dataset.cat); await saveCfg(n); openDepCfg();
  }));
}

// ---------- Dépenses automatiques de chaque semaine ----------
// Rattachement : chaque semaine où il y a du chiffre d'affaires. Assurance : chaque semaine (prix mensuel × 12 ÷ 52).
// Seulement à partir de la semaine où l'option a été activée ; la semaine en cours suit le prix des réglages.
let autoBusy = false;
async function autoCharges(force) {
  if (autoBusy || !S.cfg || needsOnboarding()) return 0;
  autoBusy = true; let n = 0;
  try {
    n += await migrateDayDeps();
    n += await migrateCats();
    const c = cfg(), curMon = monday(new Date());
    const upsert = async rec => {
      if (c.skip.includes(rec.id)) return;
      const ex = S.deps.find(x => x.id === rec.id);
      if (ex && !(force && iso(monday(fromIso(ex.date))) === iso(curMon) && ex.auto && (ex.montant !== rec.montant || ex.desc !== rec.desc))) return;
      await put("depenses", ex ? { ...ex, montant: rec.montant, desc: rec.desc } : rec);
      S.deps = S.deps.filter(x => x.id !== rec.id).concat(ex ? { ...ex, montant: rec.montant, desc: rec.desc } : rec)
        .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
      n++;
    };
    const weeksFrom = d => { const out = []; for (let m = monday(fromIso(d)); m <= curMon; m = addDays(m, 7)) out.push(m); return out.slice(-60); };
    if (ratOn()) for (const mon of weeksFrom(c.rattach.depuis)) {
      const sun = addDays(mon, 6), k = weekKeyOf(mon);
      if (!(periodTotals(iso(mon), iso(sun)).ca > 0)) continue;
      const id = "rat-" + weekId(k), label = `${ratName()} S${k.s} ${MOIS[k.m - 1]} ${k.y}`;
      // déjà saisi à la main avec le même libellé : on ne double pas
      if (S.deps.some(x => x.id !== id && x.cat === "Rattachement" && (x.desc || "").trim().toLowerCase() === label.toLowerCase())) continue;
      const wkRec = S.weeks.get(weekId(k)), fr = wkRec && typeof wkRec.frais === "number" ? wkRec.frais : c.rattach.montant;
      await upsert({ id, date: iso(sun), cat: "Rattachement", desc: label, montant: r2(fr), auto: true });
    }
    const lw = loyerWeek();
    if (lw) for (const mon of weeksFrom(cfg().vehicule.depuis))
      await upsert({ id: "loc-" + iso(mon), date: iso(mon), cat: "Location voiture", desc: `Location voiture · semaine du ${pad(mon.getDate())}/${pad(mon.getMonth() + 1)}`, montant: lw, auto: true });
    const aw = assurWeek();
    if (aw) for (const mon of weeksFrom(c.assur.depuis))
      await upsert({ id: "ass-" + iso(mon), date: iso(mon), cat: "Assurance", desc: `Assurance · semaine du ${pad(mon.getDate())}/${pad(mon.getMonth() + 1)}`, montant: aw, auto: true });
    const wd = mon => `semaine du ${pad(mon.getDate())}/${pad(mon.getMonth() + 1)}`;
    for (const f of c.fixes) for (const mon of weeksFrom(f.depuis))
      await upsert({ id: "fix-" + f.id + "-" + iso(mon), date: iso(mon), cat: f.nom, desc: `${f.nom} · ${wd(mon)}`, montant: fixWeek(f), auto: true });
    // Montants qui suivent le CA de la semaine : recalculés quand le CA change
    const upsertDyn = async rec => {
      if (c.skip.includes(rec.id)) return;
      const ex = S.deps.find(x => x.id === rec.id);
      if (!(rec.montant > 0)) { if (ex && ex.auto) { await del("depenses", ex.id); S.deps = S.deps.filter(x => x.id !== ex.id); n++; } return; }
      if (ex && (!ex.auto || (ex.montant === rec.montant && ex.desc === rec.desc))) return;
      const nr = ex ? { ...ex, montant: rec.montant, desc: rec.desc } : rec;
      await put("depenses", nr);
      S.deps = S.deps.filter(x => x.id !== rec.id).concat(nr).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
      n++;
    };
    const st = c.statut;
    if (st.type === "auto" || st.type === "societe") for (const mon of weeksFrom(st.depuis)) {
      const sun = addDays(mon, 6), t = periodTotals(iso(mon), iso(sun));
      if (st.type === "auto") {
        const red = st.acre !== "non" && st.acreFin && iso(mon) <= st.acreFin ? ACRE_RED[st.acre] || 0 : 0;
        await upsertDyn({ id: "urssaf-" + iso(mon), date: iso(sun), cat: "Cotisations URSSAF", desc: `Cotisations URSSAF · ${wd(mon)}${red ? " · ACRE" : ""}`,
          montant: r2(t.ca * ((st.taux || 0) * (1 - red) + (st.cfp || 0)) / 100), auto: true });
        await upsertDyn({ id: "ir-" + iso(mon), date: iso(sun), cat: "Impôt", desc: `Impôt (versement libératoire) · ${wd(mon)}`, montant: st.vl ? r2(t.ca * VL_RATE / 100) : 0, auto: true });
      } else {
        const own = S.deps.find(x => x.id === "prov-" + iso(mon));
        const benef = t.ca - (t.charges - (own ? own.montant : 0));
        await upsertDyn({ id: "prov-" + iso(mon), date: iso(sun), cat: "Provision impôts et charges", desc: `Provision impôts et charges · ${wd(mon)}`,
          montant: r2(Math.max(0, benef) * (st.provision || 0) / 100), auto: true });
      }
    }
  } finally { autoBusy = false; }
  return n;
}

async function exportData() {
  const data = snapshot();
  const name = `vtc-sauvegarde-${todayIso()}.json`;
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  let done = false;
  try {
    const file = new File([blob], name, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "Sauvegarde VTC" }); done = true; }
  } catch (e) { if (e && e.name === "AbortError") { toast("Sauvegarde annulée", true); return; } }
  if (!done) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); done = true;
  }
  S.meta.lastBackup = Date.now(); await put("meta", { k: "lastBackup", v: S.meta.lastBackup });
  closeSheet(); renderBanner(); toast("Sauvegarde créée");
}
$("fileIn").onchange = async e => {
  const f = e.target.files && e.target.files[0]; e.target.value = "";
  if (!f) return;
  let data;
  try { data = JSON.parse(await f.text()); } catch (_) { toast("Ce fichier n'est pas une sauvegarde VTC", true); return; }
  confirmRestore(data, "fichier", () => { markDirty(); });
};
function confirmRestore(data, source, after) {
  if (!data || data.app !== "vtc" || !Array.isArray(data.days)) { toast("Ce n'est pas une sauvegarde VTC", true); return; }
  const exist = S.days.size + S.deps.length + S.weeks.size;
  const when = data.exportedAt ? ` du ${hhmm(Date.parse(data.exportedAt))}` : "";
  const hasResas = Array.isArray(data.resas);
  openSheet(`
      <h3>Restaurer la sauvegarde du fichier${when} ?</h3>
      <div class="cur">Elle contient ${data.days.length} jours, ${(data.depenses || []).length} dépenses, ${(data.weeks || []).length} semaines et ${(data.resas || []).length} réservations.
      ${exist ? "Les données actuelles de ce téléphone seront remplacées." : ""}</div>
      ${hasResas ? `<label class="import-option"><input id="importResas" type="checkbox" checked>Importer également les réservations du fichier</label><div class="cur">Si cette option est décochée, les réservations déjà présentes sur cet appareil sont conservées.</div>` : ""}
      <div class="stack"><button class="btn primary" id="okImport">Restaurer</button><button class="btn ghost" id="noImport">Annuler</button></div>`);
  $("noImport").onclick = closeSheet;
  $("okImport").onclick = async () => {
    try {
      const restoreData = { ...data };
      if (hasResas && !$("importResas").checked) delete restoreData.resas;
      const before = new Set(DATA_STORES.flatMap(st => st === "days" ? [...S.days.keys()].map(k => "days/" + k) : st === "depenses" ? S.deps.map(x => "depenses/" + x.id) : st === "weeks" ? [...S.weeks.keys()].map(k => "weeks/" + k) : st === "resas" ? (Array.isArray(restoreData.resas) ? S.resas.map(x => "resas/" + x.id) : []) : S.cfg ? ["settings/config"] : []));
      await replaceAll(restoreData); await loadAll();
      await cloud.queueAll(before); // tout le contenu du fichier part sur le serveur
      if (after) await after(); closeSheet(); renderAll(); toast("Données restaurées");
    }
    catch (err) { toast("Restauration impossible", true); }
  };
}

// Mise à jour forcée : oublie la copie de l'appli gardée dans le téléphone et recharge depuis internet
async function forceUpdate() {
  if (!navigator.onLine) { toast("Connecte-toi à internet pour mettre à jour", true); return; }
  toast("Mise à jour…");
  try { await cloud.syncNow(true); } catch (_) {}
  try { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.filter(r => r.scope.includes(SITE)).map(r => r.unregister())); } catch (_) {}
  try { const keys = await caches.keys(); await Promise.all(keys.filter(k => k.startsWith("vtcpro-")).map(k => caches.delete(k))); } catch (_) {}
  location.replace(SITE + "?maj=" + Date.now());
}
function renderBanner() {
  const b = $("banner");
  const empty = !S.days.size && !S.deps.length && !S.weeks.size;
  const old = S.meta.lastBackup ? (Date.now() - S.meta.lastBackup) > 7 * 86400000 : true;
  if (empty) {
    b.className = "banner"; b.hidden = false;
    b.innerHTML = `<b>Bienvenue dans ton appli VTC</b>Tu as un fichier de sauvegarde (par exemple ton historique) ? Charge-le pour retrouver toutes tes données.<div class="row"><button class="btn primary small" id="bImport">Restaurer une sauvegarde</button></div>`;
    $("bImport").onclick = () => $("fileIn").click();
  } else b.hidden = true;
  $("quickSave").classList.toggle("due", !empty && old);
  $("quickSave").setAttribute("aria-label", !empty && old ? "Sauvegarder mes données (à faire)" : "Sauvegarder mes données");
  updateStatus(); renderSyncBtn();
}

  // ---------- Onglets ----------
function renderAll() {
  renderBanner(); renderEnt(); if (tab === "jour") renderJour(); else if (tab === "vir") renderVir(); else if (tab === "resa") renderResa(); else renderStats();
  runAuto(); entNotify().catch(() => {});
}
// Réglages créés une seule fois, après la première synchro (pour ne pas écraser ceux d'un autre appareil)
async function runAuto() {
  try {
    // seulement une fois connecté ET après la première synchro : jamais avant, sinon on écraserait les réglages du compte
    // compte vraiment neuf seulement : connecté, ET une synchro complète faite pour CE compte, ET toujours aucun réglage
    if (!S.cfg && cloud.session && cloud.pulled === cloud.session.user.id && !cloud.busy) await saveCfg({ ...defaultCfg(), onboarded: false });
    if (await autoCharges(false)) renderAll();
    if (needsOnboarding() && !onbShown && $("auth").hidden && !$("sheet").classList.contains("open")) openOnboarding();
  } catch (_) {}
}
function showTab(t) {
  tab = t;
  ["jour", "vir", "resa", "stats"].forEach(k => { if ($("t-" + k)) $("t-" + k).setAttribute("aria-selected", String(k === t)); $("p-" + k).hidden = k !== t; });
  $("fab").hidden = t !== "jour"; window.scrollTo(0, 0); renderAll();
}
$("t-jour").onclick = () => showTab("jour");
$("t-resa").onclick = () => showTab("resa");
$("resaNew").onclick = () => openResaForm(null);
$("t-stats").onclick = () => showTab("stats");
$("prev").onclick = () => { curDate = iso(addDays(fromIso(curDate), -1)); renderJour(); };
$("next").onclick = () => { if (curDate < todayIso()) { curDate = iso(addDays(fromIso(curDate), 1)); renderJour(); } };
$("fab").onclick = () => openDepense(null);
$("wCard").onclick = () => openWeekDetail(fromIso(curDate));
$("mCard").onclick = () => openMonthDetail(fromIso(curDate));
$("mCard").onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openMonthDetail(fromIso(curDate)); } };
$("wCard").onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openWeekDetail(fromIso(curDate)); } };
$("menuBtn").onclick = () => openMenu();
$("dshade").onclick = closeMenu;
document.addEventListener("keydown", e => { if (e.key === "Escape") closeMenu(); });
$("quickSave").onclick = exportData;
$("syncBtn").onclick = () => syncSheet(false);

// Nouveau jour quand l'appli revient au premier plan
document.addEventListener("visibilitychange", () => {
  if (!idb) return;
  if (document.visibilityState === "visible") {
    if (curDate > todayIso() || $("dayLabel").textContent.includes("Aujourd'hui")) curDate = todayIso();
    renderAll(); if (S.meta.unsynced) scheduleSync(2000);
    cloud.syncNow(true); theme.apply();
    // l'iPhone ne relance pas toujours l'appli : on vérifie s'il existe une nouvelle version
    if (navigator.serviceWorker) navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => {});
  } else { flushSync(); cloud.flush(); }
});
addEventListener("online", () => { updateStatus(); if (S.meta.unsynced) scheduleSync(2000); cloud.syncNow(true); });
addEventListener("offline", updateStatus);
