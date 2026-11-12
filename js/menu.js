// VTC Rentable — Menu
"use strict";

// ---------- Menu ☰ ----------
const MENU = [["Mon activité", ["virements", "objectifs", "activite", "vehicule", "statut", "depenses", "site"]], ["Mes données", ["sauvegarde", "sheets"]]];
function openMenu(drag) {
  const al = vehAlerts(), lvl = al.some(a => a.level === "over") ? "over" : al.length ? "soon" : "";
  const badge = al.map(a => a.k === "ent" ? (a.level === "over" ? "dépassé" : kmTxt(entState().reste)) : (a.level === "over" ? "VT dépassée" : "VT " + jTxt(ctState().jours))).join(" · ");
  const nv = virAFaire(), vb = nv ? `${nv} semaine${nv > 1 ? "s" : ""} à remplir` : "";
  const row = pg => { const b = pg.id === "vehicule" ? badge : pg.id === "virements" ? vb : "", cl = pg.id === "vehicule" && lvl ? " " + lvl : pg.id === "virements" && nv ? " soon" : "";
    return `<button class="dlink${cl}" data-page="${pg.id}"><span class="sic ic-${pg.ic}">${icon(pg.ic)}</span><span class="dl">${pg.t}</span>${b ? `<span class="dbadge">${esc(b)}</span>` : `<span class="chev" aria-hidden="true">›</span>`}</button>`; };
  const byId = id => SET_PAGES.find(p => p.id === id);
  $("dpanel").innerHTML = `<div class="dhead"><b>VTC <span class="pro">Rentable</span></b><button class="sheet-x" id="dClose" type="button" aria-label="Fermer le menu">✕</button></div>
      ${MENU.map(([g, ids]) => `<div class="dgrp">${g}</div>${ids.filter(id => id !== "site" || monSite.on()).map(id => row(byId(id))).join("")}`).join("")}
      <div class="dgrp">Réglages</div>
      <button class="dlink" data-page=""><span class="sic ic-gear">${icon("gear")}</span><span class="dl">Réglages<small>Compte · Apparence · Rappel du soir</small></span><span class="chev" aria-hidden="true">›</span></button>
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
  const pages = {
    compte: `
      <h3>Compte</h3>
      <div class="cur">${cloud.session ? `Connecté : <b>${esc(cloud.session.user.email || "")}</b><br>${esc(cloud.statusText())}` : "Non connecté"}</div>
      <div class="stack">
        <button class="btn ghost" id="cloudNow">Synchroniser maintenant</button>
        ${cloud.session && passkey.supported() ? `<button class="btn ghost" id="pkAdd">${passkey.known() ? "Face ID activé ✓ · ajouter cet appareil" : "Activer la connexion Face ID"}</button>` : ""}
        <button class="btn ghost" id="logout">Se déconnecter</button>
      </div>`,
    apparence: `
      <h3>Apparence</h3>
      <div class="seg" role="radiogroup" aria-label="Apparence">${[["auto", "Auto"], ["light", "Clair"], ["dark", "Sombre"], ["night", "Le soir"]].map(([id, l]) => `<button role="radio" data-theme-pick="${id}" aria-checked="${theme.get() === id}" aria-selected="${theme.get() === id}">${l}</button>`).join("")}</div>
      <div class="cur" style="margin-top:6px">${{ auto: "Suit le réglage Clair / Sombre de ton téléphone.", light: "Toujours clair.", dark: "Toujours sombre.", night: "Sombre le soir, clair la journée, aux heures choisies ci-dessous." }[theme.get()]}</div>
      ${theme.get() === "night" ? `<div class="nightrow"><label>Sombre de<input id="nFrom" type="time" value="${theme.night().from}"></label><label>à<input id="nTo" type="time" value="${theme.night().to}"></label></div>` : ""}`,
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
    appli: `
      <h3>Application</h3>
      <div class="pair-lbl">Version de l'appli</div>
      <div class="cur">Version <b>${APP_LABEL}</b> · mise à jour du ${APP_BUILD.split("-").reverse().join("/")}</div>
      <button class="btn ghost" id="forceUpdate" style="width:100%">Forcer la mise à jour</button>
      <nav class="legal-links"><a href="mentions-legales.html">Mentions légales</a> · <a href="confidentialite.html">Confidentialité</a></nav>`
  };
  if (page === "donnees") page = "sauvegarde";
  openSheet(backBtn(["compte", "apparence", "appli"].includes(page) ? "reglages" : "menu") + pages[page]); bindBack();
  if (page === "compte") {
    $("cloudNow").onclick = () => { closeSheet(); cloud.syncNow(false); };
    if ($("pkAdd")) $("pkAdd").onclick = () => passkey.register();
    $("logout").onclick = async () => {
      const n = await cloud.pendingCount();
      const b = $("logout");
      if (b.dataset.confirm !== "1") {
        b.dataset.confirm = "1"; b.className = "btn danger";
        b.textContent = n ? `${n} modification(s) pas encore envoyée(s) · confirmer la déconnexion` : "Confirmer la déconnexion";
        return;
      }
      closeSheet(); await cloud.signOut();
    };
  }
  if (page === "apparence") {
    $("sheet").querySelectorAll("[data-theme-pick]").forEach(b => (b.onclick = () => { theme.set(b.dataset.themePick); openSettings("apparence"); }));
    if ($("nFrom")) { const upd = () => { if ($("nFrom").value && $("nTo").value) theme.setNight($("nFrom").value, $("nTo").value); }; $("nFrom").onchange = upd; $("nTo").onchange = upd; }
  }
  if (page === "sauvegarde") {
    $("doExport").onclick = exportData;
    $("doImport").onclick = () => $("fileIn").click();
  }
  if (page === "sheets") {
    $("saveUrl").onclick = async () => {
      const u = $("sheetUrl").value.trim();
      if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(u)) { toast("Lien invalide : il doit finir par /exec", true); return; }
      await setMeta("sheetUrl", u); await setMeta("unsynced", true); closeSheet(); renderBanner(); syncSheet();
    };
    if (on) $("syncNow").onclick = () => { closeSheet(); syncSheet(); };
  }
  if (page === "appli") $("forceUpdate").onclick = forceUpdate;
}
