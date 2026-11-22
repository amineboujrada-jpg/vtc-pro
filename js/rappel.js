// VTC Rentable — Rappel du soir : une notification si la journée n'est pas saisie (Web Push)
"use strict";

const rappel = {
  // Réglage propre à l'appareil (un téléphone peut avoir le rappel, pas l'ordinateur) : { on, hour }
  get: () => ({ on: false, hour: 21, ...(S.meta.rappel || {}) }),
  supported: () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window,
  isIos: () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
  installed: () => !!(window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true,
  // Clé publique du serveur de notifications, demandée au serveur (rien n'est écrit dans le code)
  key(pub) { const s = pub.replace(/-/g, "+").replace(/_/g, "/"), raw = atob(s + "=".repeat((4 - s.length % 4) % 4)); return Uint8Array.from(raw, c => c.charCodeAt(0)); },
  b64: buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  async sub() { const reg = await navigator.serviceWorker.ready; return reg.pushManager.getSubscription(); },

  // Active le rappel : autorisation, abonnement de l'appareil, puis enregistrement sur le serveur
  async enable(hour) {
    if (!rappel.supported()) throw new Error(rappel.isIos() && !rappel.installed() ? "Sur iPhone, installe d'abord l'appli sur l'écran d'accueil" : "Ce navigateur ne permet pas les notifications");
    if (!suivi.ready()) throw new Error("Pas de connexion internet");
    const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (perm !== "granted") throw new Error("Notifications refusées : autorise-les dans les réglages du téléphone");
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const pub = await suivi.rpc("app_push_key").catch(() => null);
      if (!pub) throw new Error("Le rappel n'est pas encore disponible : réessaie plus tard");
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: rappel.key(pub) });
    }
    const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone) || "Europe/Paris";
    await suivi.rpc("app_push_save", { p_endpoint: sub.endpoint, p_p256dh: rappel.b64(sub.getKey("p256dh")), p_auth: rappel.b64(sub.getKey("auth")), p_hour: hour, p_tz: tz });
    await setMeta("rappel", { on: true, hour });
    return sub;
  },
  async disable() {
    try {
      const sub = rappel.supported() ? await rappel.sub() : null;
      if (sub) { if (suivi.ready()) await suivi.rpc("app_push_remove", { p_endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe(); }
    } catch (_) {}
    await setMeta("rappel", { on: false, hour: rappel.get().hour });
  },
  async test() {
    const sub = await rappel.sub(); if (!sub) throw new Error("Active d'abord le rappel");
    await cloud.api("/functions/v1/rappel", { method: "POST", body: JSON.stringify({ endpoint: sub.endpoint }) });
  },

  // Réglages › Rappel du soir
  open() {
    const r = rappel.get(), ok = rappel.supported();
    const why = ok ? "" : rappel.isIos() && !rappel.installed()
      ? "Sur iPhone, les notifications ne marchent que si l'appli est installée : dans Safari, touche Partager puis « Sur l'écran d'accueil », et ouvre l'appli depuis son icône."
      : "Ce navigateur ne permet pas les notifications.";
    openSheet(backBtn("reglages") + `
      <h3>Rappel du soir</h3>
      <div class="cur">Une notification si tu n'as rien saisi pour la journée. Si ta journée est déjà notée, tu ne reçois rien.</div>
      ${why ? `<p class="note">${why}</p>` : `
      ${tgl("rpOn", r.on, "Recevoir le rappel", "Sur cet appareil")}
      <label class="fl" for="rpHour">Heure du rappel</label>
      <select id="rpHour">${[17, 18, 19, 20, 21, 22, 23].map(h => `<option value="${h}"${h === r.hour ? " selected" : ""}>${h} h</option>`).join("")}</select>
      <div class="stack">
        <button class="btn primary" id="rpSave">Enregistrer</button>
        ${r.on ? `<button class="btn ghost" id="rpTest">Envoyer une notification de test</button>` : ""}
      </div>
      <p class="note">Le rappel est réglé appareil par appareil. Il part à l'heure choisie, à quelques minutes près.</p>`}`);
    bindBack();
    if (!ok) return;
    flip("rpOn");
    $("rpSave").onclick = async () => {
      const on = isOn("rpOn"), hour = Number($("rpHour").value), b = $("rpSave");
      b.disabled = true;
      try {
        if (on) await rappel.enable(hour); else await rappel.disable();
        toast(on ? `Rappel activé à ${hour} h` : "Rappel désactivé"); rappel.open();
      } catch (e) { b.disabled = false; toast(e.message || "Activation impossible", true); }
    };
    if ($("rpTest")) $("rpTest").onclick = async () => {
      const b = $("rpTest"); b.disabled = true;
      try { await rappel.test(); toast("Notification envoyée : elle arrive dans quelques secondes"); }
      catch (e) { toast(e.status === 404 ? "Rappel non activé sur cet appareil : enregistre à nouveau" : "Envoi impossible : " + (e.message || "réessaie plus tard"), true); }
      b.disabled = false;
    };
  },

  // À l'ouverture : si le rappel est activé mais que le navigateur a perdu l'abonnement, on le recrée sans rien demander
  async check() {
    const r = rappel.get();
    if (!r.on || !rappel.supported() || !suivi.ready() || Notification.permission !== "granted") return;
    try { await rappel.enable(r.hour); } catch (_) {}
  }
};
