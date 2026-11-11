// VTC Rentable — Dépenses
"use strict";

// ---------- Dépenses ----------
function baldiLabel(dIso) {
  const k = weekKeyOf(fromIso(dIso));
  return `${ratName()} S${k.s} ${MOIS[k.m - 1]} ${k.y}`;
}
function openDepense(existing) {
  const x = existing || null;
  openSheet(`
      <h3>${x ? "Modifier la dépense" : "Nouvelle dépense"}</h3>
      <div class="cur">Date</div>
      <input id="ddate" class="small" type="date" value="${x ? x.date : curDate}" aria-label="Date">
      <div class="pair-lbl" style="margin-top:10px">Catégorie</div>
      <div class="cgrid" role="radiogroup" aria-label="Groupe de dépense" id="cgrid"></div>
      <div class="chips cdet" role="radiogroup" aria-label="Détail" id="cdet"></div>
      <div class="cur" id="catNote" hidden></div>
      <input id="desc" class="small" type="text" placeholder="Description (ex. vidange)" aria-label="Description" value="${x ? esc(x.desc) : ""}">
      <input id="damt" type="text" inputmode="decimal" autocomplete="off" placeholder="Montant en €" aria-label="Montant" value="${x ? String(x.montant).replace(".", ",") : ""}">
      <div class="stack">
        <button class="btn primary" id="saveDep">Enregistrer</button>
        ${x ? `<button class="btn ghost" id="delDep">Supprimer cette dépense</button>` : ""}
      </div>`);
  // Groupes proposés : les 4 groupes, plus « Charges de la semaine » si une charge n'est pas automatique (ou pour modifier une ligne existante)
  const weekCats = [...new Set(manualWeekCats().concat(x && catGrp(x.cat) === "semaine" ? [x.cat] : []))];
  const groups = CAT_GROUPS.map(g => g.k).concat(weekCats.length ? ["semaine"] : []);
  const detOf = k => k === "semaine" ? weekCats : [...new Set(grpCats(k).concat(x && catGrp(x.cat) === k && !grpCats(k).includes(x.cat) ? [x.cat] : []))];
  let grp = x ? catGrp(x.cat) : "voiture", selCat = x ? x.cat : detOf("voiture")[0];
  if (x && x.cat === "Péage / parking") selCat = catV2(x);
  const drawCats = () => {
    $("cgrid").innerHTML = groups.map(k => { const g = grpInfo(k); return `<button type="button" role="radio" class="cgrp" data-grp="${k}" aria-checked="${k === grp}"><span aria-hidden="true">${g.ic}</span>${g.t}</button>`; }).join("");
    $("cdet").innerHTML = detOf(grp).map(c => `<button type="button" role="radio" class="chip" data-c="${esc(c)}" aria-checked="${c === selCat}">${esc(catLbl(c))}</button>`).join("");
    $("catNote").hidden = selCat !== "Démarrage"; $("catNote").textContent = "Frais de démarrage (achat de la voiture, carte VTC, immatriculation…) : gardés à part, ils ne comptent pas dans ton revenu net.";
    $("cgrid").querySelectorAll("[data-grp]").forEach(b => (b.onclick = () => { grp = b.dataset.grp; selCat = detOf(grp)[0]; drawCats(); defaults(); }));
    $("cdet").querySelectorAll("[data-c]").forEach(b => (b.onclick = () => { selCat = b.dataset.c; drawCats(); defaults(); }));
  };
  const defaults = () => {
    if (x) return;
    const c = selCat;
    if (c === "Rattachement") { $("desc").value = baldiLabel($("ddate").value || curDate); $("damt").value = ratOn() ? String(cfg().rattach.montant).replace(".", ",") : ""; }
    else if (c === "Location voiture") { $("desc").value = "Location voiture"; $("damt").value = loyerWeek() ? String(loyerWeek()).replace(".", ",") : ""; }
    else if (c === "Assurance") { $("desc").value = "Assurance"; $("damt").value = assurWeek() ? String(cfg().assur.mensuel).replace(".", ",") : ""; }
    else { $("desc").value = ""; $("damt").value = ""; }
  };
  drawCats(); defaults();
  $("saveDep").onclick = async () => {
    const n = parse($("damt").value), date = $("ddate").value;
    if (!(n > 0)) { toast("Tape un montant", true); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { toast("Choisis une date", true); return; }
    const rec = { id: x ? x.id : "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), date, cat: selCat, grp: catGrp(selCat), desc: $("desc").value.trim() || catLbl(selCat), montant: r2(n) };
    if (x && x.auto) rec.auto = true;
    try {
      await put("depenses", rec);
      S.deps = S.deps.filter(d => d.id !== rec.id).concat(rec).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
      closeSheet(); renderAll(); toast(x ? "Dépense modifiée" : "Dépense enregistrée");
    } catch (e) { toast("Enregistrement impossible", true); }
  };
  if (x) $("delDep").onclick = () => {
    const b = $("delDep");
    if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.className = "btn danger"; b.textContent = "Confirmer la suppression"; return; }
    del("depenses", x.id).then(async () => {
      S.deps = S.deps.filter(d => d.id !== x.id);
      // dépense ajoutée automatiquement : on retient qu'elle a été supprimée pour ne pas la recréer
      if (x.auto) { const c = cfg(); if (!c.skip.includes(x.id)) { c.skip.push(x.id); await saveCfg(c); } }
      closeSheet(); renderAll(); toast("Dépense supprimée");
    });
  };
}
