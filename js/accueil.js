// VTC Rentable — Accueil du premier lancement
"use strict";

// ---------- Accueil du premier lancement : statut, rattachement, plateformes ----------
// Un nouveau compte n'a aucune charge automatique tant que ces réponses ne sont pas données.
let onbShown = false;
const needsOnboarding = () => !!(S.cfg && S.cfg.onboarded === false);
function openOnboarding() {
  onbShown = true;
  const c = cfg(); let type = "", plats = { ...c.plats };
  const step1 = () => {
    openSheet(`<h3>Bienvenue dans VTC Rentable</h3>
        <div class="cur">Deux questions pour calculer ton revenu net. Tu pourras tout changer ensuite dans le menu ☰.</div>
        <div class="pair-lbl">Ton statut</div>
        <div class="stack">${[["salarie", "Salarié d'une société de rattachement", "Tu verses une commission chaque semaine"], ["auto", "Auto-entrepreneur", "Cotisations URSSAF sur ton chiffre d'affaires"], ["societe", "Société (SASU, EURL…)", "Tu mets de côté un % pour impôts et charges"]]
        .map(([id, t, s]) => `<button class="setlink" data-onb="${id}" type="button" style="border:1px solid var(--line);border-radius:14px"><span class="stx"><b>${t}</b><small>${s}</small></span><span class="chev" aria-hidden="true">›</span></button>`).join("")}</div>`);
    $("sheet").querySelectorAll("[data-onb]").forEach(b => (b.onclick = () => { type = b.dataset.onb; step2(); }));
  };
  const step2 = () => {
    const st = c.statut;
    const body = type === "salarie" ? `
          ${tgl("oRat", true, "Je paie une commission à ma société de rattachement")}
          <div id="oRatBox"><label class="fl" for="oRatNom">Nom de la société de rattachement</label>
          <input id="oRatNom" class="small" type="text" maxlength="30" autocomplete="off" placeholder="comme sur ton bon de commande Uber">
          <label class="fl" for="oRatAmt">Commission par semaine (€)</label>
          <input id="oRatAmt" type="text" inputmode="decimal" autocomplete="off" placeholder="ex. 50"></div>`
      : type === "auto" ? `<label class="fl" for="oTaux">Taux de cotisations URSSAF (%)</label>
          <input id="oTaux" type="text" inputmode="decimal" autocomplete="off" value="${numTxt(st.taux)}">
          <div class="cur" style="margin-top:6px">ACRE et versement libératoire se règlent ensuite dans ☰ → Mon statut.</div>`
      : `<label class="fl" for="oProv">Part à mettre de côté pour impôts et charges (%)</label>
          <input id="oProv" type="text" inputmode="decimal" autocomplete="off" value="${numTxt(st.provision)}">`;
    openSheet(`<button class="backlink" id="oBack" type="button">‹ Statut</button>
        <h3>${STATUTS[type]}</h3>${body}
        <div class="pair-lbl" style="margin-top:16px">Tes plateformes</div>
        <div class="plist">${allPlats().map(p => tgl("op-" + p.k, plats[p.k], esc(p.t))).join("")}</div>
        <button class="btn primary" id="oSave" style="width:100%;margin-top:14px">C'est parti</button>`);
    $("oBack").onclick = step1;
    $("sheet").querySelectorAll(".plist .toggle").forEach(b => flip(b.id));
    if (type === "salarie") { flip("oRat"); $("oRat").addEventListener("click", () => ($("oRatBox").hidden = !isOn("oRat"))); }
    $("oSave").onclick = async () => {
      const n = cfg(), monIso = iso(monday(new Date()));
      if (type === "salarie") {
        const on = isOn("oRat"), nom = $("oRatNom").value.trim(), m = parse($("oRatAmt").value);
        if (on && !nom) { toast("Tape le nom de ta société de rattachement", true); return; }
        if (on && !(m > 0)) { toast("Tape la commission par semaine", true); return; }
        n.rattach = { on, nom: on ? nom : "", montant: on ? r2(m) : 0, depuis: monIso };
      } else n.rattach = { on: false, nom: "", montant: 0, depuis: monIso };
      if (type === "auto") { const t = parse($("oTaux").value); if (!(t >= 0 && t <= 60)) { toast("Tape le taux de cotisations", true); return; } n.statut = { ...n.statut, type, taux: r2(t), depuis: monIso }; }
      else if (type === "societe") { const pv = parse($("oProv").value); if (!(pv >= 0 && pv <= 90)) { toast("Tape un pourcentage entre 0 et 90", true); return; } n.statut = { ...n.statut, type, provision: r2(pv), depuis: monIso }; }
      else n.statut = { ...n.statut, type, depuis: monIso };
      allPlats().forEach(p => { if ($("op-" + p.k)) n.plats[p.k] = isOn("op-" + p.k); });
      if (!Object.values(n.plats).some(Boolean)) { toast("Coche au moins une plateforme", true); return; }
      n.onboarded = true;
      try {
        await saveCfg(n);
        // lignes automatiques de cette semaine recalculées avec les vraies réponses
        for (const x of S.deps.filter(x => x.auto && x.date >= monIso && /^(urssaf|ir|prov|rat)-/.test(x.id))) { await del("depenses", x.id); S.deps = S.deps.filter(d => d.id !== x.id); }
        await autoCharges(true); closeSheet(); renderAll(); toast("C'est réglé, bonne route !");
      } catch (_) { toast("Enregistrement impossible", true); }
    };
  };
  step1();
}
