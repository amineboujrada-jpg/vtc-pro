// ---------- Profil : avatar aux initiales, icône d'en-tête, ligne du menu ----------
const PROF_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/></svg>';
// Initiales : première lettre du prénom et du nom, comme dans les contacts ; couleur stable d'après le nom
function profAvatar(u, size) {
  const name = ((u && u.name) || "").trim(), parts = name.split(/\s+/).filter(Boolean);
  const fallback = (u && u.email) || "?";
  const ini = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] || fallback)[0];
  let h = 0; for (const ch of (name || fallback)) h = (h * 31 + ch.codePointAt(0)) % 997;
  const style = `--h:${RESA_HUES[h % RESA_HUES.length]}` + (size ? `;width:${size}px;height:${size}px;font-size:${Math.round(size * 0.36)}px` : "");
  return `<span class="ravatar" style="${style}" aria-hidden="true">${esc(ini.toUpperCase())}</span>`;
}
function updateProfBtn() {
  const b = $("profBtn"); if (!b) return;
  const u = cloud.session && cloud.session.user;
  if (!u) { b.innerHTML = PROF_ICON; b.setAttribute("aria-label", "Mon compte, non connecté"); return; }
  b.innerHTML = profAvatar(u);
  b.setAttribute("aria-label", "Mon compte");
  if (u.name === undefined && !u.loading) profLoad(u);
}
// Charge nom, téléphone et ville depuis les données du compte
function profLoad(u) {
  u.loading = true;
  return cloud.api("/auth/v1/user").then(x => {
    const m = x.user_metadata || {};
    u.name = m.full_name || ""; u.tel = m.telephone || ""; u.ville = m.ville || "";
    u.loading = false; updateProfBtn(); return u;
  }).catch(() => { u.loading = false; return u; });
}
// Première ligne du menu : le compte
function profRow() {
  const u = cloud.session && cloud.session.user;
  const title = u ? (u.name || "Mon compte") : "Se connecter";
  const sub = u ? (u.email || "") : "Compte et synchronisation";
  return `<button class="dlink dprof" data-page="compte">${profAvatar(u, 40)}<span class="dl">${esc(title)}<small>${esc(sub)}</small></span><span class="chev" aria-hidden="true">›</span></button>`;
}

// VTC Rentable — Menu
"use strict";

// ---------- Menu ☰ ----------
const MENU = [["Mon activité", ["virements", "objectifs", "activite", "vehicule", "statut", "depenses"]], ["Mon site vitrine", ["site"]], ["Mes données", ["sauvegarde", "sheets"]]];
function openMenu(drag) {
  const al = vehAlerts(), lvl = al.some(a => a.level === "over") ? "over" : al.length ? "soon" : "";
  const badge = al.map(a => a.k === "ent" ? (a.level === "over" ? "dépassé" : kmTxt(entState().reste)) : (a.level === "over" ? "VT dépassée" : "VT " + jTxt(ctState().jours))).join(" · ");
  const nv = virAFaire(), vb = nv ? `${nv} semaine${nv > 1 ? "s" : ""} à remplir` : "";
  const row = pg => { const b = pg.id === "vehicule" ? badge : pg.id === "virements" ? vb : "", cl = pg.id === "vehicule" && lvl ? " " + lvl : pg.id === "virements" && nv ? " soon" : "";
    return `<button class="dlink${cl}" data-page="${pg.id}"><span class="sic ic-${pg.ic}">${icon(pg.ic)}</span><span class="dl">${pg.t}</span>${b ? `<span class="dbadge">${esc(b)}</span>` : `<span class="chev" aria-hidden="true">›</span>`}</button>`; };
  const byId = id => SET_PAGES.find(p => p.id === id);
  $("dpanel").innerHTML = `<div class="dhead"><b>VTC <span class="pro">Rentable</span></b><button class="sheet-x" id="dClose" type="button" aria-label="Fermer le menu">✕</button></div>
      ${profRow()}
      ${MENU.map(([g, ids]) => `<div class="dgrp">${g}</div>${ids.map(id => row(byId(id))).join("")}`).join("")}
      <div class="dgrp">Réglages</div>
      <button class="dlink" data-page=""><span class="sic ic-gear">${icon("gear")}</span><span class="dl">Réglages<small>Apparence · Rappel du soir · Application</small></span><span class="chev" aria-hidden="true">›</span></button>
      <div class="dgrp">Aide</div>
      <button class="dlink" id="dFeedback" type="button"><span class="sic ic-info">${icon("info")}</span><span class="dl">Un problème, une idée ?<small>Écrire à l'équipe</small></span><span class="chev" aria-hidden="true">›</span></button>
      <div class="dfoot">${cloud.session ? esc(cloud.session.user.email || "") + "<br>" : ""}Version ${APP_LABEL} · <a href="mentions-legales.html">Mentions légales</a><br>Aide : <a href="mailto:contact@vtcrentable.com">contact@vtcrentable.com</a></div>`;
  $("dpanel").querySelectorAll("[data-page]").forEach(b => (b.onclick = () => { closeMenu(); openSettings(b.dataset.page || undefined); }));
  $("dClose").onclick = closeMenu;
  $("dFeedback").onclick = () => { closeMenu(); suivi.openFeedback(); };
  const d = $("drawer"); d.hidden = false; $("menuBtn").setAttribute("aria-expanded", "true");
  if (drag) return; // ouverture au doigt : le geste fait glisser le panneau
  requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add("open")));
  setTimeout(() => $("dClose").focus(), 240);
}
// Glisser sur tout l'écran (téléphone), comme dans l'appli Claude : vers la droite le menu sort de la gauche en suivant
// le doigt, vers la gauche il se referme. Ignoré dans les champs, les zones qui défilent sur le côté, une fenêtre ouverte ou la connexion.
(() => {
  let sx = 0, sy = 0, pts = [], state = "off", mode = "open", p = 0, w = 300;
  const hScroll = el => { for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (n.scrollWidth > n.clientWidth + 2 && /auto|scroll/.test(getComputedStyle(n).overflowX)) return true; } return false; };
  const panel = () => $("dpanel"), shade = () => $("dshade");
  document.addEventListener("touchstart", e => {
    const el = e.target, open = $("drawer").classList.contains("open");
    state = "off";
    if (e.touches.length !== 1 || $("sheet").classList.contains("open") || ($("auth") && !$("auth").hidden)) return;
    if (!open && el.closest && (el.closest("input, textarea, select, [contenteditable], .seg") || hScroll(el))) return;
    state = "idle"; mode = open ? "close" : "open";
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; pts = [[sx, performance.now()]];
  }, { passive: true });
  document.addEventListener("touchmove", e => {
    if (state === "off") return;
    const t = e.touches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (state === "idle") {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { state = "off"; return; } // défilement vertical : on laisse faire
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if ((mode === "open" && dx < 0) || (mode === "close" && dx > 0)) { state = "off"; return; }
      state = "drag";
      if (mode === "open") openMenu(true);
      w = panel().offsetWidth || 300;
      panel().style.transition = "none"; shade().style.transition = "none";
    }
    if (state !== "drag") return;
    e.preventDefault();
    const now = performance.now(); pts.push([t.clientX, now]); while (pts.length > 2 && now - pts[0][1] > 120) pts.shift();
    p = Math.min(1, Math.max(0, mode === "open" ? dx / w : 1 + dx / w));
    panel().style.transform = `translateX(${(p - 1) * 100}%)`; shade().style.opacity = p;
  }, { passive: false });
  const end = () => {
    if (state !== "drag") { state = "off"; return; }
    state = "off";
    // vitesse sur les ~100 dernières ms (px/ms) : un geste vif suffit, sinon il faut dépasser 40 % d'ouverture
    const a = pts[0], z = pts[pts.length - 1], vx = (z[0] - a[0]) / Math.max(60, z[1] - a[1]);
    const keep = vx > 0.3 ? true : vx < -0.3 ? false : p > 0.4;
    const pa = panel(), sh = shade();
    pa.style.transition = ""; sh.style.transition = ""; void pa.offsetWidth;
    pa.style.transform = ""; sh.style.opacity = "";
    if (keep) { $("drawer").classList.add("open"); $("menuBtn").setAttribute("aria-expanded", "true"); } else closeMenu();
  };
  document.addEventListener("touchend", end, { passive: true });
  document.addEventListener("touchcancel", end, { passive: true });
})();
function closeMenu() {
  const d = $("drawer"); if (d.hidden) return;
  d.classList.remove("open"); $("menuBtn").setAttribute("aria-expanded", "false");
  setTimeout(() => { if (!d.classList.contains("open")) d.hidden = true; }, 230);
}
function openSettingsPage(page) {
  const on = sync.ok();
  const u = cloud.session && cloud.session.user;
  const BACK = { apparence: "reglages", appli: "reglages", "compte-info": "compte", "compte-mdp": "compte", "compte-sync": "compte" };
  const pages = {
    compte: u ? `
      <h3>Mon compte</h3>
      <div class="profcard">${profAvatar(u, 60)}<div><b>${esc(u.name || "Sans nom")}</b><small>${esc(u.email || "")}</small></div></div>
      <div class="setmenu">
        <button class="setlink" data-page="compte-info"><span class="sic ic-user">${icon("user")}</span><span class="stx"><b>Informations personnelles</b><small>Prénom et nom, téléphone, ville</small></span><span class="chev" aria-hidden="true">›</span></button>
        <button class="setlink" data-page="compte-mdp"><span class="sic ic-gear">${icon("gear")}</span><span class="stx"><b>Mot de passe</b><small>Modifier le mot de passe</small></span><span class="chev" aria-hidden="true">›</span></button>
        <button class="setlink" data-page="compte-sync"><span class="sic ic-grid">${icon("grid")}</span><span class="stx"><b>Cet appareil</b><small>Synchronisation et Face ID</small></span><span class="chev" aria-hidden="true">›</span></button>
      </div>
      <div class="stack" style="margin-top:16px">
        <button class="btn ghost" id="logout">Se déconnecter</button>
        <button class="btn ghost" id="delAccount">Supprimer mon compte</button>
      </div>` : `
      <h3>Mon compte</h3>
      <div class="cur">Tu n'es pas connecté. Connecte-toi pour retrouver tes données sur tous tes appareils.</div>
      <div class="stack"><button class="btn primary" id="goLogin">Se connecter ou créer un compte</button></div>`,
    "compte-info": `
      <h3>Informations personnelles</h3>
      <label class="fl" for="accName">Prénom et nom</label>
      <input id="accName" class="small" type="text" autocomplete="name" maxlength="80" value="${esc((u && u.name) || "")}">
      <label class="fl" for="accTel">Téléphone</label>
      <input id="accTel" class="small" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="06 00 00 00 00" value="${esc((u && u.tel) || "")}">
      <label class="fl" for="accVille">Ville</label>
      <input id="accVille" class="small" type="text" autocomplete="address-level2" maxlength="60" value="${esc((u && u.ville) || "")}">
      <div class="cur">L'email ne peut pas être modifié.</div>
      <div class="stack"><button class="btn primary" id="saveInfo">Enregistrer</button></div>`,
    "compte-mdp": `
      <h3>Mot de passe</h3>
      <label class="fl" for="newPass">Nouveau mot de passe</label>
      <input id="newPass" class="small" type="password" autocomplete="new-password" placeholder="8 caractères minimum">
      <label class="fl" for="newPass2">Retaper le nouveau mot de passe</label>
      <input id="newPass2" class="small" type="password" autocomplete="new-password">
      <div class="stack"><button class="btn primary" id="savePass">Changer le mot de passe</button></div>`,
    "compte-sync": u ? `
      <h3>Cet appareil</h3>
      <div class="cur">${esc(cloud.statusText())}</div>
      <div class="stack">
        <button class="btn ghost" id="cloudNow">Synchroniser maintenant</button>
        ${passkey.supported() ? `<button class="btn ghost" id="pkAdd">${passkey.known() ? "Face ID activé ✓ · ajouter cet appareil" : "Activer la connexion Face ID"}</button>` : ""}
      </div>` : `<h3>Cet appareil</h3><div class="cur">Connecte-toi d'abord.</div>`,
    sauvegarde: `
      <h3>Sauvegarde</h3>
      <div class="pair-lbl">Fichier de sauvegarde</div>
      <div class="cur">${lastBackupText()}</div>
      <div class="stack">
        <button class="btn ghost" id="doExport">Sauvegarder dans un fichier</button>
        <button class="btn ghost" id="doImport">Restaurer un fichier</button>
      </div>
      <p class="note">${S.days.size} jours, ${S.deps.length} dépenses et ${S.weeks.size} semaines sur cet appareil.</p>`,
    sheets: `
      <h3>Google Sheets</h3>
      <div class="cur">Facultatif : une copie de tes données dans ton propre fichier Google Sheets.</div>
      <div class="cur">${on ? `<b style="color:var(--net)">Relié</b> · ${S.meta.lastSync ? "dernière synchro " + hhmm(S.meta.lastSync) : "jamais synchronisé"}` :
      "Colle ici le lien du script Google (il commence par https://script.google.com/macros/s/…)."}</div>
      <input id="sheetUrl" class="small" type="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(S.meta.sheetUrl || "")}" aria-label="Lien du script Google">
      <div class="stack">
        <button class="btn primary" id="saveUrl">${on ? "Enregistrer le lien" : "Relier Google Sheets"}</button>
        ${on ? `<button class="btn ghost" id="syncNow">Synchroniser maintenant</button>` : ""}
      </div>`,
    apparence: `
      <h3>Apparence</h3>
      <div class="seg" role="radiogroup" aria-label="Apparence">${[["auto", "Auto"], ["light", "Clair"], ["dark", "Sombre"], ["night", "Le soir"]].map(([id, l]) => `<button role="radio" data-theme-pick="${id}" aria-checked="${theme.get() === id}" aria-selected="${theme.get() === id}">${l}</button>`).join("")}</div>
      <div class="cur" style="margin-top:6px">${{ auto: "Suit le réglage Clair / Sombre de ton téléphone.", light: "Toujours clair.", dark: "Toujours sombre.", night: "Sombre le soir, clair la journée, aux heures choisies ci-dessous." }[theme.get()]}</div>
      ${theme.get() === "night" ? `<div class="nightrow"><label>Sombre de<input id="nFrom" type="time" value="${theme.night().from}"></label><label>à<input id="nTo" type="time" value="${theme.night().to}"></label></div>` : ""}`,
    appli: `
      <h3>Application</h3>
      <div class="pair-lbl">Version de l'appli</div>
      <div class="cur">Version <b>${APP_LABEL}</b> · mise à jour du ${APP_BUILD.split("-").reverse().join("/")}</div>
      <button class="btn ghost" id="forceUpdate" style="width:100%">Forcer la mise à jour</button>
      <div class="pair-lbl" style="margin-top:14px">Installer l'appli</div>
      <div class="cur"><b>iPhone</b> : dans Safari, touche Partager puis « Sur l'écran d'accueil », et ouvre l'appli depuis son icône. Les notifications du soir ne marchent sur iPhone qu'avec l'appli installée ainsi.</div>
      <div class="cur"><b>Android</b> : bientôt sur Google Play. En attendant, dans Chrome, menu ⋮ puis « Ajouter à l'écran d'accueil ».</div>
      <nav class="legal-links"><a href="mentions-legales.html">Mentions légales</a> · <a href="cgu.html">Conditions d'utilisation</a> · <a href="confidentialite.html">Confidentialité</a> · <a href="suppression-compte.html">Supprimer son compte</a></nav>`
  };
  if (page === "donnees") page = "sauvegarde";
  openPage(backBtn(BACK[page]) + pages[page]); bindBack();
  if (page === "compte" && !u) $("goLogin").onclick = () => cloud.showAuth("login");
  if (page === "compte" && u) {
    $("logout").onclick = async () => {
      const n = await cloud.pendingCount();
      const b = $("logout");
      if (b.dataset.confirm !== "1") {
        b.dataset.confirm = "1"; b.className = "btn danger";
        b.textContent = n ? `${n} modification(s) pas encore envoyée(s) · confirmer la déconnexion` : "Confirmer la déconnexion";
        return;
      }
      await cloud.signOut(); showTab("jour");
    };
    $("delAccount").onclick = async () => {
      // Suppression définitive : deux confirmations, puis appel serveur (supabase/suppression.sql)
      const b = $("delAccount"), step = Number(b.dataset.step || 0);
      if (step === 0) { b.dataset.step = "1"; b.className = "btn danger"; b.textContent = "Tout sera effacé : journées, dépenses, réservations, site. Continuer ?"; return; }
      if (step === 1) { b.dataset.step = "2"; b.textContent = "Dernière confirmation : supprimer définitivement mon compte"; return; }
      if (!navigator.onLine) { toast("Connexion internet nécessaire pour supprimer le compte", true); return; }
      b.disabled = true; b.textContent = "Suppression…";
      try {
        await cloud.deleteAccount();
        showTab("jour"); toast("Compte supprimé");
      } catch (e) {
        b.disabled = false; b.dataset.step = "0"; b.className = "btn ghost"; b.textContent = "Supprimer mon compte";
        toast("Suppression impossible : " + frErr(e && e.message) + ". Écris à contact@vtcrentable.com", true);
      }
    };
  }
  if (page === "compte-info") {
    const fill = () => { $("accName").value = u.name || ""; $("accTel").value = u.tel || ""; $("accVille").value = u.ville || ""; };
    if (u.name === undefined) profLoad(u).then(() => { if ($("accName")) fill(); });
    $("saveInfo").onclick = async () => {
      const n = $("accName").value.trim().replace(/\s+/g, " "), tel = $("accTel").value.trim(), ville = $("accVille").value.trim().replace(/\s+/g, " ");
      if (n.length < 2) { toast("Tape ton prénom et ton nom.", true); return; }
      if (tel && !/^[+\d][\d\s.-]{6,19}$/.test(tel)) { toast("Numéro de téléphone invalide.", true); return; }
      try {
        await cloud.api("/auth/v1/user", { method: "PUT", body: JSON.stringify({ data: { full_name: n, telephone: tel, ville } }) });
        Object.assign(u, { name: n, tel, ville }); updateProfBtn(); toast("Informations enregistrées");
      } catch (e) { toast("Impossible d'enregistrer : " + frErr(e && e.message), true); }
    };
  }
  if (page === "compte-mdp") {
    $("savePass").onclick = async () => {
      const p = $("newPass").value, p2 = $("newPass2").value;
      if (p.length < 8) { toast("Mot de passe : 8 caractères minimum.", true); return; }
      if (p !== p2) { toast("Les deux mots de passe ne sont pas identiques.", true); return; }
      try {
        await cloud.api("/auth/v1/user", { method: "PUT", body: JSON.stringify({ password: p }) });
        $("newPass").value = ""; $("newPass2").value = ""; toast("Mot de passe modifié");
      } catch (e) { toast("Impossible de changer le mot de passe : " + frErr(e && e.message), true); }
    };
  }
  if (page === "compte-sync" && u) {
    $("cloudNow").onclick = () => cloud.syncNow(false);
    if ($("pkAdd")) $("pkAdd").onclick = () => passkey.register();
  }
  if (page === "sauvegarde") {
    $("doExport").onclick = exportData;
    $("doImport").onclick = () => $("fileIn").click();
  }
  if (page === "sheets") {
    $("saveUrl").onclick = async () => {
      const v = $("sheetUrl").value.trim();
      if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(v)) { toast("Lien invalide : il doit finir par /exec", true); return; }
      await setMeta("sheetUrl", v); await setMeta("unsynced", true); renderBanner(); syncSheet();
    };
    if (on) $("syncNow").onclick = () => syncSheet();
  }
  if (page === "apparence") {
    pscope().querySelectorAll("[data-theme-pick]").forEach(b => (b.onclick = () => { theme.set(b.dataset.themePick); openSettings("apparence"); }));
    if ($("nFrom")) { const upd = () => { if ($("nFrom").value && $("nTo").value) theme.setNight($("nFrom").value, $("nTo").value); }; $("nFrom").onchange = upd; $("nTo").onchange = upd; }
  }
  if (page === "appli") $("forceUpdate").onclick = forceUpdate;
}
