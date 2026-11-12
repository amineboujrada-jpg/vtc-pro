// VTC Rentable — Suivi : journal des erreurs, version utilisée, annonce, signalements et idées
"use strict";

// Tout ce fichier est « silencieux » : un échec (pas de réseau, serveur indisponible) ne gêne jamais le chauffeur.
const suivi = {
  sent: new Set(), n: 0, timer: null, lastPing: 0, annonce: null, plan: "gratuit",
  rpc: (fn, args) => cloud.api("/rest/v1/rpc/" + fn, { method: "POST", body: JSON.stringify(args || {}) }),
  ready: () => !!(cloud.session && cloud.session.user && cloud.session.user.id) && navigator.onLine,
  // Où se trouvait le chauffeur : onglet, et fenêtre ouverte s'il y en a une
  screen() {
    let s = typeof tab === "string" ? tab : "";
    try { const h = $("sheet").classList.contains("open") && $("sheet").querySelector("h3"); if (h) s += " › " + h.textContent.trim(); } catch (_) {}
    return s.slice(0, 60);
  },

  // À chaque ouverture : note la version utilisée, récupère l'annonce en cours et l'offre du compte
  async ping() {
    if (!suivi.ready()) return;
    suivi.lastPing = Date.now();
    try {
      const standalone = !!(window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
      const r = await suivi.rpc("app_ping", { p_label: APP_LABEL, p_version: APP_VERSION, p_ua: navigator.userAgent, p_standalone: standalone });
      suivi.annonce = (r && r.annonce) || null; suivi.plan = (r && r.plan) || "gratuit";
      suivi.renderAnnonce();
    } catch (_) {}
    suivi.flush();
    rappel.check();
  },

  // Envoi des erreurs en attente : une seule fois par message, 5 par ouverture de l'appli au maximum
  flushSoon() { clearTimeout(suivi.timer); suivi.timer = setTimeout(suivi.flush, 1500); },
  async flush() {
    if (!suivi.ready()) return;
    const scr = suivi.screen();
    while (ERR_BUF.length) {
      const e = ERR_BUF.shift();
      if (suivi.sent.has(e.message) || suivi.n >= 5) continue;
      suivi.sent.add(e.message); suivi.n++;
      try { await suivi.rpc("app_report_error", { p_message: e.message, p_source: e.source, p_stack: e.stack, p_screen: scr, p_label: APP_LABEL, p_ua: navigator.userAgent }); }
      catch (_) { return; }
    }
  },

  // Annonce écrite depuis l'admin : affichée en haut de l'appli jusqu'à ce que le chauffeur la ferme
  renderAnnonce() {
    const b = $("annonce"), a = suivi.annonce;
    let closed = null; try { closed = localStorage.getItem("vtcpro.annonce"); } catch (_) {}
    if (!a || !a.message || closed === a.updated_at) { b.hidden = true; return; }
    b.className = "banner annonce" + (a.level === "warn" ? " warn" : "");
    b.innerHTML = `<button class="annonce-x" type="button" aria-label="Fermer l'annonce">✕</button><span></span>`;
    b.querySelector("span").textContent = a.message;
    b.querySelector("button").onclick = () => { try { localStorage.setItem("vtcpro.annonce", a.updated_at); } catch (_) {} b.hidden = true; };
    b.hidden = false;
  },

  // Menu › Signaler un problème ou proposer une idée
  openFeedback() {
    let kind = "bug";
    const scr = suivi.screen();
    openSheet(`
      <h3>Un problème, une idée ?</h3>
      <div class="cur">Ton message arrive directement à l'équipe de VTC Rentable. Réponse sous 24 h si besoin, à l'adresse de ton compte.</div>
      <div class="seg two" role="radiogroup" aria-label="Type de message" id="fbKind">
        <button type="button" role="radio" data-k="bug" aria-checked="true">Un problème</button>
        <button type="button" role="radio" data-k="idee" aria-checked="false">Une idée</button>
      </div>
      <textarea id="fbMsg" rows="6" maxlength="2000" aria-label="Ton message" placeholder="Qu'est-ce qui ne marche pas ? Sur quel écran ?"></textarea>
      <div class="stack">
        <button class="btn primary" id="fbSend">Envoyer</button>
      </div>`, "fbMsg");
    $("fbKind").querySelectorAll("button").forEach(b => (b.onclick = () => {
      kind = b.dataset.k;
      $("fbKind").querySelectorAll("button").forEach(x => x.setAttribute("aria-checked", String(x === b)));
      $("fbMsg").placeholder = kind === "bug" ? "Qu'est-ce qui ne marche pas ? Sur quel écran ?" : "Qu'est-ce qui te ferait gagner du temps ?";
    }));
    $("fbSend").onclick = async () => {
      const msg = $("fbMsg").value.trim();
      if (msg.length < 3) return toast("Écris ton message d'abord", true);
      if (!suivi.ready()) return toast("Pas de connexion internet : réessaie plus tard", true);
      $("fbSend").disabled = true;
      try {
        await suivi.rpc("app_send_feedback", { p_kind: kind, p_message: msg, p_screen: scr, p_label: APP_LABEL, p_ua: navigator.userAgent });
        closeSheet(); toast("Message envoyé, merci !");
      } catch (e) {
        const b = $("fbSend"); if (b) b.disabled = false;
        toast(/trop de messages/i.test(e.message) ? "Trop de messages envoyés aujourd'hui" : "Envoi impossible : réessaie plus tard", true);
      }
    };
  }
};

// Retour dans l'appli après plus d'une heure : on redemande l'annonce et on note l'activité
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && Date.now() - suivi.lastPing > 3600000) suivi.ping();
});
