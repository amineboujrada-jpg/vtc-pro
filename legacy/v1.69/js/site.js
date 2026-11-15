// VTC Rentable — Mon site vitrine (option) : adresse, modèle, textes, version anglaise, aperçu, demande de mise en ligne
"use strict";

// Le site de chaque chauffeur est servi sur <adresse>.vtcrentable.fr. Il est gardé sur le serveur (table sites),
// pas dans l'appareil : cet écran demande donc du réseau. L'option s'active dans Réglages › Site vitrine.
const SITE_DOMAINE = "vtcrentable.fr";
const SITE_MODELES = [["nuit", "Nuit", "#0f1116", "#f2a614"], ["clair", "Clair", "#ffffff", "#1d4ed8"], ["prestige", "Prestige", "#0b0b0c", "#c9a45c"]];
const SITE_SERVICES = ["Transferts aéroport", "Transferts gare", "Trajets longue distance", "Mise à disposition", "Déplacements professionnels", "Soirées et événements", "Siège enfant sur demande", "Courses médicales"];
const SITE_ETATS = { brouillon: ["Brouillon", "wait", "Pas encore en ligne. Enregistre, regarde l'aperçu, puis demande la mise en ligne."],
  demande: ["Demande envoyée", "wait", "On vérifie ton site et on te contacte pour la mise en ligne. Tu peux encore le modifier."],
  en_ligne: ["En ligne", "ok", "Tes modifications apparaissent sur ton site en une minute environ."],
  suspendu: ["Suspendu", "bad", "Ton site n'est plus visible. Écris à contact@vtcrentable.com."] };
const siteSlug = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "").slice(0, 30).replace(/-+$/, "");

// Offre de lancement : site gratuit à vie pour les 100 premiers inscrits à l'appli (le rang est calculé sur le serveur)
const SITE_PROMO = "Offre de lancement : site <b>gratuit à vie</b> pour les 100 premiers chauffeurs inscrits à l'appli. Ensuite, 19,99 € HT par mois, sans engagement.";

const monSite = {
  cur: null, timer: null, seq: 0, gratuit: null, // gratuit : true ou false une fois la réponse du serveur reçue
  on: () => !!cfg().siteOn,
  sub: () => monSite.on() ? "Adresse, modèle, textes et réservation" : "Option · gratuite à vie pour les 100 premiers",

  // Texte du prix, selon que le compte fait partie des 100 premiers inscrits ou non
  prix() {
    if (monSite.gratuit === true) return "Tu fais partie des 100 premiers inscrits : ton site est <b>gratuit à vie</b>, tant qu'il reste actif.";
    if (monSite.gratuit === false) return "Les 100 premiers inscrits ont le site gratuit à vie. Pour ton compte : option à <b>19,99 € HT par mois</b>, sans engagement.";
    return SITE_PROMO;
  },
  // Demande au serveur si le compte a droit au site gratuit, puis met à jour le texte affiché (id msPrix)
  async loadPromo() {
    if (suivi.ready()) { // redemandé à chaque ouverture : le compte connecté peut avoir changé
      try { monSite.gratuit = !!((await suivi.rpc("site_promo")) || {}).gratuit; } catch (_) {}
    }
    if ($("msPrix")) $("msPrix").innerHTML = monSite.prix();
  },

  async open() {
    if (!monSite.on()) return monSite.openOffre();
    openSheet(backBtn() + `<h3>Mon site vitrine</h3><div class="cur" id="msLoad">Chargement…</div>`); bindBack();
    if (!suivi.ready()) { $("msLoad").textContent = "Cet écran demande une connexion internet et un compte connecté."; return; }
    try { monSite.cur = await suivi.rpc("site_get"); }
    catch (e) { if ($("msLoad")) $("msLoad").textContent = "Chargement impossible : " + (e.message || "réessaie plus tard"); return; }
    if ($("msLoad")) { monSite.form(); monSite.loadPromo(); }
  },

  // Option pas encore activée : présentation courte et bouton d'activation
  openOffre() {
    openSheet(backBtn("reglages") + `<h3>Site vitrine avec réservation</h3>
      <div class="cur">Une page à ton nom sur <b>ton-nom.${SITE_DOMAINE}</b> : tes clients réservent en ligne, la demande arrive dans tes Réservations, sans commission.</div>
      <div class="cur" id="msPrix">${monSite.prix()}</div>
      <div class="cur">Tu prépares ton site librement ; il est mis en ligne après validation par l'équipe.</div>
      <button class="btn primary" id="msOn" style="width:100%;margin-top:6px">Activer l'option et créer mon site</button>
      <p class="note">Sans cette option, rien ne change dans l'appli.</p>`);
    bindBack(); monSite.loadPromo();
    $("msOn").onclick = async () => {
      try { await saveCfg({ ...cfg(), siteOn: true }); toast("Option activée : « Mon site » est dans le menu"); monSite.open(); }
      catch (_) { toast("Enregistrement impossible", true); }
    };
  },

  form() {
    const s = monSite.cur, soc = socCfg(), d = (s && s.data) || {};
    const val = (k, def) => esc(d[k] != null && d[k] !== "" ? d[k] : (def || ""));
    const nomDef = soc.chauffeur || "", slug = s ? s.slug : siteSlug(nomDef);
    const modele = s ? s.modele : "nuit", etat = s ? SITE_ETATS[s.statut] : null, enLigne = s && s.statut === "en_ligne";
    const services = Array.isArray(d.services) && d.services.length ? d.services : SITE_SERVICES.slice(0, 6);
    const tarifs = (Array.isArray(d.tarifs) ? d.tarifs : []).concat([{}, {}, {}, {}]).slice(0, 4);
    const adr = s ? `https://${s.slug}.${SITE_DOMAINE}/` : "";
    openSheet(backBtn() + `<h3>Mon site vitrine</h3>
      ${etat ? `<div class="cur"><span class="pill ${etat[1]}" style="float:none;margin:0 6px 0 0">${etat[0]}</span>${etat[2]}${enLigne ? `<br><a href="${adr}" target="_blank" rel="noopener"><b>${esc(s.slug)}.${SITE_DOMAINE}</b></a>` : ""}</div>` : `<div class="cur">Choisis ton adresse, un modèle, remplis tes informations : ta page est prête en quelques minutes.</div>`}
      ${enLigne ? `<div class="stack"><button class="btn ghost" id="msCopy" type="button">Copier l'adresse de mon site</button></div>` : ""}

      <div class="pair-lbl">Adresse de mon site</div>
      <div class="addrow"><input id="msSlug" class="small" type="text" maxlength="30" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="ton-nom" value="${esc(slug)}" aria-label="Adresse du site" ${enLigne ? "disabled" : ""}><span class="note" style="margin:0;white-space:nowrap">.${SITE_DOMAINE}</span></div>
      <div class="cur" id="msSlugMsg" role="status">${enLigne ? "Ton site est en ligne : écris-nous pour changer son adresse." : "3 à 30 caractères : lettres, chiffres et tirets."}</div>

      <div class="pair-lbl">Modèle</div>
      <div class="seg three" role="radiogroup" aria-label="Modèle du site">${SITE_MODELES.map(([id, l, bg, ac]) => `<button type="button" role="radio" data-modele="${id}" aria-checked="${modele === id}"><span aria-hidden="true" style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${ac};border:2px solid ${bg};outline:1px solid var(--line);margin-right:6px;vertical-align:-1px"></span>${l}</button>`).join("")}</div>

      <div class="pair-lbl">Mes informations</div>
      <label class="fl" for="msNom">Nom affiché sur le site</label>
      <input id="msNom" class="small" type="text" maxlength="60" autocomplete="off" placeholder="ex. Karim VTC Lyon" value="${val("nom", nomDef)}">
      <div class="ms2"><div><small>Ville</small><input id="msVille" class="small" type="text" maxlength="60" autocomplete="off" placeholder="ex. Lyon" value="${val("ville")}"></div><div><small>Téléphone</small><input id="msTel" class="small" type="tel" maxlength="20" autocomplete="off" placeholder="06 12 34 56 78" value="${val("tel", soc.tel)}"></div></div>
      <label class="fl" for="msZones">Zones desservies</label>
      <input id="msZones" class="small" type="text" maxlength="200" autocomplete="off" placeholder="ex. Villeurbanne, Bron, aéroport Saint-Exupéry" value="${val("zones")}">
      ${tgl("msWa", d.whatsapp, "Bouton WhatsApp", "tes clients t'écrivent sur ce numéro")}

      <div class="pair-lbl">Mes textes</div>
      <label class="fl" for="msAccroche">Phrase d'accroche (facultatif)</label>
      <input id="msAccroche" class="small" type="text" maxlength="120" autocomplete="off" placeholder="ex. Votre chauffeur privé à Lyon, ponctuel et discret" value="${val("accroche")}">
      <label class="fl" for="msPres">Présentation (facultatif, 900 caractères)</label>
      <textarea id="msPres" rows="5" maxlength="900" placeholder="Qui tu es, ton expérience, ce qui te distingue. Laissé vide, un texte est écrit pour toi avec ton nom et ta ville.">${val("presentation")}</textarea>
      <div class="ms2"><div><small>Véhicule</small><input id="msVeh" class="small" type="text" maxlength="80" autocomplete="off" placeholder="ex. Toyota Camry hybride" value="${val("vehicule")}"></div><div><small>Passagers max.</small><input id="msPlaces" class="small" type="text" inputmode="numeric" maxlength="1" value="${esc(d.places || 4)}"></div></div>
      <label class="fl" for="msHor">Horaires (facultatif)</label>
      <input id="msHor" class="small" type="text" maxlength="80" autocomplete="off" placeholder="ex. 7 j/7, de 5 h à minuit" value="${val("horaires")}">

      <div class="pair-lbl">Version anglaise</div>
      <div class="cur">Ton site existe aussi en anglais : un visiteur dont le téléphone n'est pas en français le voit en anglais, et un bouton (globe) permet de changer de langue. Tes textes sont <b>traduits automatiquement</b>. Regarde l'aperçu en anglais ; écris ton propre texte ci-dessous seulement si tu veux corriger la traduction.</div>
      <label class="fl" for="msAccEn">Phrase d'accroche en anglais (facultatif)</label>
      <input id="msAccEn" class="small" type="text" maxlength="120" autocomplete="off" lang="en" placeholder="Laissé vide : traduction automatique" value="${val("accroche_en")}">
      <label class="fl" for="msPresEn">Présentation en anglais (facultatif, 900 caractères)</label>
      <textarea id="msPresEn" rows="4" maxlength="900" lang="en" placeholder="Laissé vide : traduction automatique de ta présentation">${val("presentation_en")}</textarea>

      <div class="pair-lbl">Mes services</div>
      <div class="plist">${SITE_SERVICES.map((t, i) => tgl("msSv" + i, services.includes(t), esc(t))).join("")}</div>

      <div class="pair-lbl">Mes tarifs (facultatif)</div>
      ${tarifs.map((t, i) => `<div class="ms2" style="margin-top:6px"><div><input id="msTl${i}" class="small" type="text" maxlength="60" autocomplete="off" placeholder="${["ex. Centre-ville → aéroport", "ex. Mise à disposition 1 h", "Trajet", "Trajet"][i]}" value="${esc(t.label || "")}" aria-label="Trajet ${i + 1}"></div><div><input id="msTp${i}" class="small" type="text" maxlength="24" autocomplete="off" placeholder="${i ? "Prix" : "ex. à partir de 55 €"}" value="${esc(t.prix || "")}" aria-label="Prix ${i + 1}"></div></div>`).join("")}

      <div class="pair-lbl">Mentions affichées en bas du site</div>
      <label class="fl" for="msExp">Exploitant (société ou nom)</label>
      <input id="msExp" class="small" type="text" maxlength="100" autocomplete="off" value="${val("exploitant", soc.nom)}">
      <div class="ms2"><div><small>SIREN</small><input id="msSiren" class="small" type="text" maxlength="20" autocomplete="off" value="${val("siren", soc.siren)}"></div><div><small>N° registre VTC</small><input id="msReg" class="small" type="text" maxlength="30" autocomplete="off" value="${val("registre", soc.registre)}"></div></div>

      <div class="stack" style="margin-top:14px">
        <button class="btn primary" id="msSave" type="button">Enregistrer</button>
        <button class="btn ghost" id="msPrev" type="button">Voir l'aperçu</button>
        <button class="btn ghost" id="msPrevEn" type="button">Voir l'aperçu en anglais</button>
        ${!s || s.statut === "brouillon" ? `<button class="btn ghost" id="msAsk" type="button">Demander la mise en ligne</button>` : ""}
        ${!enLigne ? `<button class="btn ghost" id="msOff" type="button">Désactiver l'option</button>` : ""}
      </div>
      <p class="note"><span id="msPrix">${monSite.prix()}</span> La mise en ligne est validée par l'équipe ; aucun classement Google n'est garanti.</p>`);
    bindBack();
    $("sheet").querySelectorAll(".toggle").forEach(b => flip(b.id));
    $("sheet").querySelectorAll("[data-modele]").forEach(b => (b.onclick = () => $("sheet").querySelectorAll("[data-modele]").forEach(x => x.setAttribute("aria-checked", String(x === b)))));
    if (!enLigne) {
      $("msSlug").oninput = () => { clearTimeout(monSite.timer); monSite.timer = setTimeout(monSite.check, 400); };
      $("msSlug").onblur = () => { const v = siteSlug($("msSlug").value); if (v !== $("msSlug").value) { $("msSlug").value = v; monSite.check(); } };
      $("msNom").onblur = () => { if (!$("msSlug").value.trim()) { $("msSlug").value = siteSlug($("msNom").value); monSite.check(); } };
      if (slug) monSite.check();
    }
    if ($("msCopy")) $("msCopy").onclick = async () => { try { await navigator.clipboard.writeText(adr); toast("Adresse copiée"); } catch (_) { toast(adr); } };
    $("msSave").onclick = () => monSite.save();
    $("msPrev").onclick = () => monSite.apercu();
    $("msPrevEn").onclick = () => monSite.apercu("en");
    if ($("msAsk")) $("msAsk").onclick = async () => {
      if (!(await monSite.save(true))) return;
      try { monSite.cur = await suivi.rpc("site_demander"); toast("Demande envoyée : on te contacte vite"); monSite.form(); }
      catch (e) { toast(e.message || "Demande impossible", true); }
    };
    if ($("msOff")) $("msOff").onclick = async () => {
      const b = $("msOff");
      if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.className = "btn danger"; b.textContent = "Confirmer : retirer « Mon site » du menu"; return; }
      try { await saveCfg({ ...cfg(), siteOn: false }); closeSheet(); toast("Option désactivée"); } catch (_) { toast("Enregistrement impossible", true); }
    };
  },

  // Vérifie l'adresse pendant la saisie : libre, déjà prise, réservée ou mal écrite
  async check() {
    const box = $("msSlugMsg"), inp = $("msSlug"); if (!box || !inp) return false;
    const v = inp.value.trim().toLowerCase(), n = ++monSite.seq;
    const say = (t, ok) => { box.innerHTML = `<b style="color:var(${ok ? "--net" : "--danger"})">${t}</b>`; return ok; };
    if (!/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(v) || /--/.test(v)) return say("3 à 30 caractères : lettres sans accent, chiffres et tirets.", false);
    box.textContent = "Vérification…";
    let r; try { r = await suivi.rpc("site_slug_check", { p_slug: v }); } catch (_) { if (n === monSite.seq) box.textContent = "Vérification impossible sans réseau."; return false; }
    if (n !== monSite.seq || !$("msSlugMsg")) return false;
    if (r === "libre") return say(`✓ ${esc(v)}.${SITE_DOMAINE} est disponible`, true);
    if (r === "reserve") return say("Cette adresse est réservée : choisis-en une autre.", false);
    if (r === "pris") {
      const ville = siteSlug($("msVille").value), idee = [ville && `${v}-${ville}`, `${v}-vtc`, `vtc-${v}`].filter(x => x && x.length <= 30)[0];
      return say(`Déjà prise${idee ? ` : essaie « ${esc(idee)} »` : ""}.`, false);
    }
    return say("Adresse invalide.", false);
  },

  read() {
    const g = id => $(id).value.trim();
    return { slug: g("msSlug").toLowerCase(), modele: ($("sheet").querySelector('[data-modele][aria-checked="true"]') || {}).dataset.modele || "nuit",
      data: { nom: g("msNom"), ville: g("msVille"), tel: g("msTel"), zones: g("msZones"), whatsapp: isOn("msWa"), accroche: g("msAccroche"), presentation: g("msPres"), accroche_en: g("msAccEn"), presentation_en: g("msPresEn"),
        vehicule: g("msVeh"), places: Number(g("msPlaces")) || 4, horaires: g("msHor"),
        services: SITE_SERVICES.filter((_, i) => isOn("msSv" + i)),
        tarifs: [0, 1, 2, 3].map(i => ({ label: g("msTl" + i), prix: g("msTp" + i) })).filter(t => t.label),
        exploitant: g("msExp"), siren: g("msSiren"), registre: g("msReg") } };
  },

  async save(quiet) {
    const x = monSite.read(), b = $("msSave");
    if (!x.data.nom) { toast("Indique le nom affiché sur le site", true); return false; }
    if (!x.data.ville) { toast("Indique ta ville", true); return false; }
    if (!/^\+?[\d\s.()-]{8,}$/.test(x.data.tel)) { toast("Vérifie ton numéro de téléphone", true); return false; }
    b.disabled = true;
    try {
      monSite.cur = await suivi.rpc("site_save", { p_slug: x.slug, p_modele: x.modele, p_data: x.data });
      if (!quiet) { toast("Site enregistré"); monSite.form(); }
      return true;
    } catch (e) { toast(e.message || "Enregistrement impossible", true); return false; }
    finally { if ($("msSave")) $("msSave").disabled = false; }
  },

  // Aperçu : le contenu de l'écran est envoyé à apercu.vtcrentable.fr, qui affiche la page sans rien enregistrer.
  // lang = "en" : aperçu de la version anglaise (textes traduits automatiquement, ou ceux écrits par le chauffeur)
  apercu(lang) {
    const x = monSite.read(), f = document.createElement("form"), i = document.createElement("input"), l = document.createElement("input");
    l.type = "hidden"; l.name = "lang"; l.value = lang === "en" ? "en" : "fr"; f.appendChild(l);
    f.method = "POST"; f.action = `https://apercu.${SITE_DOMAINE}/`; f.target = "_blank"; f.hidden = true;
    i.type = "hidden"; i.name = "site"; i.value = JSON.stringify({ slug: /^[a-z0-9-]{3,30}$/.test(x.slug) ? x.slug : "mon-site", modele: x.modele, data: x.data });
    f.appendChild(i); document.body.appendChild(f); f.submit(); f.remove();
  }
};
