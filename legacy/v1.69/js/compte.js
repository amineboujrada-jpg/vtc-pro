// VTC Rentable — Compte, connexion et synchronisation en ligne (Supabase)
"use strict";

// ================= COMPTE ET SYNCHRO EN LIGNE (Supabase) =================
// Les données restent dans l'appareil (l'appli marche hors ligne) et sont copiées sur le serveur.
// Chaque modification passe par une file d'envoi (outbox) ; les modifications faites sur un autre
// appareil sont récupérées à l'ouverture, au retour du réseau et toutes les 30 s.
const SB_URL = "https://izjwblfezffiksoyapwa.supabase.co";
const SB_KEY = "sb_publishable_oHSTBBoFqNQEBLQWgrOTgA_d5sACoZU"; // clé publique : la sécurité RLS limite chacun à ses données
const SITE = location.origin + location.pathname.replace(/[^/]*$/, "");
const LS_KEY = "vtcpro.session";
const ls = {
  get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch (_) { return null; } },
  set: (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
};
class AuthError extends Error {}
const jwtPayload = t => { try { return JSON.parse(decodeURIComponent(escape(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))))); } catch (_) { return {}; } };
const ERR_FR = [
  [/invalid login credentials/i, "Email ou mot de passe incorrect."],
  [/email not confirmed/i, "Ton email n'est pas encore confirmé : clique sur le lien reçu par email, puis reconnecte-toi."],
  [/already registered|already exists/i, "Un compte existe déjà avec cet email : connecte-toi."],
  [/password should be at least|weak password/i, "Mot de passe trop court : 8 caractères minimum."],
  [/rate limit|too many/i, "Trop de tentatives : réessaie dans quelques minutes."],
  [/unable to validate email|invalid email/i, "Adresse email invalide."],
  [/failed to fetch|network|load failed/i, "Pas de connexion internet."]
];
const frErr = m => { for (const [re, fr] of ERR_FR) if (re.test(m || "")) return fr; return m || "Erreur inconnue"; };

// ---------- Apparence ----------
const theme = {
  get() { try { return localStorage.getItem("vtcpro.theme") || "auto"; } catch (_) { return "auto"; } },
  // Mode « Le soir » : sombre entre deux heures choisies (par défaut 19 h → 7 h)
  night() { try { const n = JSON.parse(localStorage.getItem("vtcpro.night") || "{}"); return { from: n.from || "19:00", to: n.to || "07:00" }; } catch (_) { return { from: "19:00", to: "07:00" }; } },
  setNight(from, to) { try { localStorage.setItem("vtcpro.night", JSON.stringify({ from, to })); } catch (_) {} theme.apply(); },
  isNight() {
    const n = theme.night(), d = new Date(), m = d.getHours() * 60 + d.getMinutes();
    const mm = x => +x.slice(0, 2) * 60 + +x.slice(3, 5), f = mm(n.from), u = mm(n.to);
    return f <= u ? (m >= f && m < u) : (m >= f || m < u);
  },
  apply() {
    const t = theme.get(), el = document.documentElement;
    if (t === "auto") delete el.dataset.theme;
    else el.dataset.theme = t === "night" ? (theme.isNight() ? "dark" : "light") : t;
    theme.meta();
  },
  set(t) {
    try { if (t === "auto") localStorage.removeItem("vtcpro.theme"); else localStorage.setItem("vtcpro.theme", t); } catch (_) {}
    theme.apply();
  },
  meta() { const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#0f1116"; }
};

// ---------- Connexion Face ID / Touch ID (passkeys Supabase) ----------
const b64uToBuf = s => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; };
const bufToB64u = buf => { const u = new Uint8Array(buf); let b = ""; for (let i = 0; i < u.length; i++) b += String.fromCharCode(u[i]); return btoa(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const passkey = {
  // Face ID lié au domaine app.vtcrentable.com : pas proposé sur l'adresse de secours github.io
  supported: () => !!(window.PublicKeyCredential && navigator.credentials && window.isSecureContext) && !/\.github\.io$/.test(location.hostname),
  known() { try { return localStorage.getItem("vtcpro.passkey") === "1"; } catch (_) { return false; } },
  remember() { try { localStorage.setItem("vtcpro.passkey", "1"); } catch (_) {} },
  creationOpts(o) {
    if (PublicKeyCredential.parseCreationOptionsFromJSON) return PublicKeyCredential.parseCreationOptionsFromJSON(o);
    return Object.assign({}, o, { challenge: b64uToBuf(o.challenge), user: Object.assign({}, o.user, { id: b64uToBuf(o.user.id) }),
      excludeCredentials: (o.excludeCredentials || []).map(c => Object.assign({}, c, { id: b64uToBuf(c.id) })) });
  },
  requestOpts(o) {
    if (PublicKeyCredential.parseRequestOptionsFromJSON) return PublicKeyCredential.parseRequestOptionsFromJSON(o);
    const r = Object.assign({}, o, { challenge: b64uToBuf(o.challenge) });
    if (o.allowCredentials && o.allowCredentials.length) r.allowCredentials = o.allowCredentials.map(c => Object.assign({}, c, { id: b64uToBuf(c.id) }));
    else delete r.allowCredentials;
    return r;
  },
  toJSON(c) {
    if (typeof c.toJSON === "function") return c.toJSON();
    const r = c.response, out = { id: c.id, rawId: c.id, type: "public-key", clientExtensionResults: c.getClientExtensionResults(),
      authenticatorAttachment: c.authenticatorAttachment || undefined, response: { clientDataJSON: bufToB64u(r.clientDataJSON) } };
    if (r.attestationObject) out.response.attestationObject = bufToB64u(r.attestationObject);
    if (r.authenticatorData) { out.response.authenticatorData = bufToB64u(r.authenticatorData); out.response.signature = bufToB64u(r.signature); if (r.userHandle) out.response.userHandle = bufToB64u(r.userHandle); }
    return out;
  },
  err(e) {
    const n = e && e.name;
    if (n === "NotAllowedError" || n === "AbortError") return "Face ID annulé.";
    if (n === "InvalidStateError") return "Face ID est déjà activé sur cet appareil.";
    const m = (e && e.message) || "";
    if (/passkey.*(disabled|not enabled)|not.*enabled/i.test(m)) return "La connexion Face ID n'est pas encore activée sur le serveur.";
    return frErr(m);
  },
  // Activer : il faut être connecté (une fois par appareil / compte iCloud)
  async register() {
    if (!navigator.onLine) { toast("Connecte-toi à internet pour activer Face ID", true); return; }
    try {
      const o = await cloud.api("/auth/v1/passkeys/registration/options", { method: "POST", body: "{}" });
      const cred = await navigator.credentials.create({ publicKey: passkey.creationOpts(o.options) });
      await cloud.api("/auth/v1/passkeys/registration/verify", { method: "POST", body: JSON.stringify({ challenge_id: o.challenge_id, credential: passkey.toJSON(cred) }) });
      passkey.remember(); closeSheet(); toast("Face ID activé : la prochaine fois, connecte-toi sans mot de passe");
    } catch (e) { toast(passkey.err(e), true); }
  },
  async login() {
    const b = $("aPasskey"); b.disabled = true;
    try {
      const o = await cloud.api("/auth/v1/passkeys/authentication/options", { method: "POST", body: "{}" }, false);
      const cred = await navigator.credentials.get({ publicKey: passkey.requestOpts(o.options) });
      const j = await cloud.api("/auth/v1/passkeys/authentication/verify", { method: "POST", body: JSON.stringify({ challenge_id: o.challenge_id, credential: passkey.toJSON(cred) }) }, false);
      const sess = j && j.access_token ? j : j && j.session;
      if (!sess || !sess.access_token) throw new Error("Réponse inattendue du serveur");
      cloud.saveSession(sess); passkey.remember();
      await cloud.enter(); renderAll(); toast("Connecté avec Face ID");
    } catch (e) { cloud.showAuth("login", passkey.err(e), true); }
    finally { b.disabled = false; }
  }
};

const cloud = {
  session: null, busy: false, again: false, err: null, last: null, timer: null, poll: null, pending: 0, mode: "login", recovery: false,

  async api(path, opts = {}, auth = true) {
    const headers = Object.assign({ apikey: SB_KEY, "Content-Type": "application/json" }, opts.headers || {});
    if (auth) headers.Authorization = "Bearer " + await cloud.token();
    const r = await fetch(SB_URL + path, Object.assign({}, opts, { headers, cache: "no-store" }));
    const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (_) {}
    if (!r.ok) {
      const e = new Error((j && (j.msg || j.message || j.error_description || j.error)) || ("Erreur " + r.status));
      e.status = r.status;
      if (auth && r.status === 401) throw new AuthError(e.message);
      throw e;
    }
    return j;
  },
  saveSession(j) {
    const p = jwtPayload(j.access_token);
    const u = j.user || { id: p.sub, email: p.email };
    cloud.session = {
      access_token: j.access_token, refresh_token: j.refresh_token,
      expires_at: Number(j.expires_at) || Math.floor(Date.now() / 1000) + (Number(j.expires_in) || 3600),
      user: { id: u.id, email: u.email }
    };
    ls.set(LS_KEY, cloud.session);
    // Copie aussi dans la base de l'appareil : sur iPhone, localStorage peut perdre la dernière écriture
    // quand l'appli est fermée vite, et un jeton de renouvellement perdu oblige à se reconnecter.
    if (idb) setMeta("session", cloud.session).catch(() => {});
  },
  // Session la plus récente entre les deux copies
  storedSession() {
    const a = ls.get(LS_KEY), b = S.meta.session;
    const ok = x => x && x.user && x.user.id && x.refresh_token;
    if (ok(a) && ok(b)) return (b.expires_at || 0) > (a.expires_at || 0) ? b : a;
    return ok(a) ? a : ok(b) ? b : null;
  },
  // Jeton d'accès valable ~1 h, renouvelé tout seul : on reste connecté sans retaper le mot de passe
  async token() {
    const s = cloud.session; if (!s) throw new AuthError("non connecté");
    if (s.expires_at - 60 > Date.now() / 1000) return s.access_token;
    if (!cloud._refreshing) cloud._refreshing = (async () => {
      try {
        const r = await fetch(SB_URL + "/auth/v1/token?grant_type=refresh_token", { method: "POST", cache: "no-store",
          headers: { apikey: SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: s.refresh_token }) });
        const j = await r.json().catch(() => null);
        if (r.ok && j && j.access_token) { cloud.saveSession(j); return; }
        if (r.status >= 400 && r.status < 500) {
          // un autre onglet a peut-être déjà renouvelé la session : on reprend la plus récente
          const st = cloud.storedSession();
          if (st && st.refresh_token !== s.refresh_token && st.expires_at - 60 > Date.now() / 1000) { cloud.session = st; return; }
          throw new AuthError("session expirée");
        }
        throw new Error("Serveur indisponible");
      } finally { cloud._refreshing = null; }
    })();
    await cloud._refreshing;
    return cloud.session.access_token;
  },

  // ---------- Synchro ----------
  async pendingCount() { try { return (await getAll("outbox")).length; } catch (_) { return 0; } },
  async refreshCount() { cloud.pending = await cloud.pendingCount(); updateStatus(); },
  schedule(ms) {
    if (!cloud.session) return;
    clearTimeout(cloud.timer); cloud.timer = setTimeout(() => cloud.syncNow(true), ms);
    cloud.refreshCount();
  },
  rows: items => items.map(o => ({ user_id: cloud.session.user.id, store: o.store, id: o.id, data: o.data, deleted: o.deleted })),
  async push() {
    const items = await getAll("outbox");
    for (let i = 0; i < items.length; i += 500) {
      const part = items.slice(i, i + 500);
      await cloud.api("/rest/v1/entries?on_conflict=user_id,store,id", { method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(cloud.rows(part)) });
      // on retire de la file ce qui est parti, sauf si ça a été re-modifié pendant l'envoi
      const cur = new Map((await getAll("outbox")).map(o => [o.key, JSON.stringify(o)]));
      await tx("outbox", "readwrite", s => { part.forEach(o => { if (cur.get(o.key) === JSON.stringify(o)) s.delete(o.key); }); });
    }
    return items.length;
  },
  async pull() {
    let since = S.meta.lastPull || "1970-01-01T00:00:00Z", changed = 0;
    for (;;) {
      const rows = await cloud.api(`/rest/v1/entries?select=store,id,data,deleted,updated_at&updated_at=gt.${encodeURIComponent(since)}&order=updated_at.asc&limit=1000`);
      if (!rows || !rows.length) break;
      const pend = new Set((await getAll("outbox")).map(o => o.key));
      await new Promise((res, rej) => {
        const t = idb.transaction(DATA_STORES, "readwrite");
        rows.forEach(r => {
          if (!DATA_STORES.includes(r.store) || pend.has(r.store + "/" + r.id)) return; // une modif locale plus récente attend d'être envoyée
          const st = t.objectStore(r.store);
          if (r.deleted) { st.delete(r.id); if (/^\d+$/.test(r.id)) st.delete(Number(r.id)); }
          else st.put(r.data);
          changed++;
        });
        t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
      });
      since = rows[rows.length - 1].updated_at;
      await setMeta("lastPull", since);
      if (rows.length < 1000) break;
    }
    return changed;
  },
  async syncNow(silent) {
    if (!cloud.session) return;
    if (!navigator.onLine) { await cloud.refreshCount(); if (!silent) toast("Pas de réseau : la synchro partira au retour d'internet", true); return; }
    if (cloud.busy) { cloud.again = true; return; }
    cloud.busy = true; cloud.again = false; clearTimeout(cloud.timer); updateStatus();
    try {
      await cloud.push();
      const n = await cloud.pull();
      if (n) { await loadAll(); if (!$("sheet").classList.contains("open")) renderAll(); markDirty(); }
      cloud.err = null; cloud.last = Date.now(); cloud.pulled = cloud.session && cloud.session.user.id;
      runAuto(); // premier réglage d'un nouveau compte (après la première synchro)
      if (!silent) toast("Synchronisé" + (n ? ` · ${n} mise(s) à jour reçue(s)` : ""));
    } catch (e) {
      if (e instanceof AuthError) { cloud.busy = false; cloud.expired(); return; }
      cloud.err = frErr(e && e.message);
      if (!silent) toast("Synchro impossible : " + cloud.err, true);
    } finally {
      cloud.busy = false; await cloud.refreshCount();
      if (cloud.again) cloud.schedule(800);
    }
  },
  // En quittant l'appli : envoi immédiat de ce qui reste (renvoyé de toute façon à la prochaine synchro)
  flush() {
    const s = cloud.session;
    if (!s || !navigator.onLine || cloud.busy || s.expires_at - 30 < Date.now() / 1000) return;
    getAll("outbox").then(items => {
      if (!items.length) return;
      const body = JSON.stringify(cloud.rows(items)); if (body.length > 60000) return;
      fetch(SB_URL + "/rest/v1/entries?on_conflict=user_id,store,id", { method: "POST", keepalive: true, body,
        headers: { apikey: SB_KEY, Authorization: "Bearer " + s.access_token, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" } }).catch(() => {});
    }).catch(() => {});
  },
  // Restauration d'un fichier : tout son contenu part sur le serveur (et ce qui n'y est plus est supprimé)
  async queueAll(before) {
    const now = new Map();
    S.days.forEach((v, k) => now.set("days/" + k, ["days", k, v]));
    S.deps.forEach(v => now.set("depenses/" + v.id, ["depenses", v.id, v]));
    S.weeks.forEach((v, k) => now.set("weeks/" + k, ["weeks", k, v]));
    if (S.cfg) now.set("settings/config", ["settings", "config", S.cfg]);
    S.resas.forEach(v => now.set("resas/" + v.id, ["resas", v.id, v]));
    await tx("outbox", "readwrite", s => {
      now.forEach(([st, id, v], key) => s.put({ key, store: st, id: String(id), data: v, deleted: false }));
      (before || new Set()).forEach(key => {
        if (now.has(key)) return;
        const i = key.indexOf("/");
        s.put({ key, store: key.slice(0, i), id: key.slice(i + 1), data: {}, deleted: true });
      });
    });
    cloud.schedule(300);
  },
  statusText() {
    if (!navigator.onLine) return cloud.pending ? `Hors ligne · ${cloud.pending} modif. en attente` : "Hors ligne · données sur cet appareil";
    if (cloud.busy) return "Synchronisation…";
    if (cloud.err) return "Synchro en échec · nouvel essai automatique";
    if (cloud.pending) return `${cloud.pending} modif. à envoyer…`;
    return cloud.last ? "Synchronisé · " + hhmm(cloud.last) : "Connecté";
  },

  // ---------- Connexion ----------
  async start() {
    cloud.bindForm();
    if (!cloud.readLink()) cloud.session = cloud.storedSession();
    if (cloud.session && cloud.session.user && cloud.session.user.id) {
      await cloud.enter();
      if (cloud.recovery) cloud.showAuth("newpass");
    } else cloud.showAuth("login");
  },
  // Retour depuis un email (confirmation d'inscription ou mot de passe oublié)
  readLink() {
    const h = new URLSearchParams(location.hash.replace(/^#/, ""));
    if (h.get("error_description")) {
      history.replaceState(null, "", location.pathname + location.search);
      cloud.linkMsg = "Lien invalide ou expiré : " + h.get("error_description");
      return false;
    }
    if (!h.get("access_token")) return false;
    cloud.saveSession({ access_token: h.get("access_token"), refresh_token: h.get("refresh_token"), expires_at: h.get("expires_at"), expires_in: h.get("expires_in") });
    cloud.recovery = h.get("type") === "recovery";
    if (h.get("type") === "signup") cloud.linkMsg = "Email confirmé, bienvenue !";
    history.replaceState(null, "", location.pathname + location.search);
    return true;
  },
  async enter() {
    const u = cloud.session.user;
    if (cloud.pulled !== u.id) cloud.pulled = null; // nouvelle connexion : on attend la première synchro de ce compte
    if (S.meta.userId && S.meta.userId !== u.id) await cloud.wipeLocal(); // un autre compte utilisait cet appareil
    if (S.meta.userId !== u.id) {
      // premier passage du compte sur cet appareil : des réglages vides créés avant la connexion ne doivent pas partir sur le serveur
      if (S.cfg && S.cfg.onboarded === false) {
        await tx("outbox", "readwrite", st => st.delete("settings/config")); await tx("settings", "readwrite", st => st.delete("config")); S.cfg = null;
      }
      await setMeta("userId", u.id); await setMeta("lastPull", undefined);
    }
    $("auth").hidden = true;
    if (cloud.linkMsg) { toast(cloud.linkMsg); cloud.linkMsg = null; }
    clearInterval(cloud.poll);
    cloud.poll = setInterval(() => { if (document.visibilityState === "visible") cloud.syncNow(true); }, 30000);
    await cloud.refreshCount();
    cloud.syncNow(true);
    suivi.ping(); // version utilisée, annonce en cours, erreurs en attente
  },
  async wipeLocal() {
    await new Promise((res, rej) => {
      const t = idb.transaction([...DATA_STORES, "outbox"], "readwrite");
      [...DATA_STORES, "outbox"].forEach(n => t.objectStore(n).clear());
      t.oncomplete = res; t.onerror = () => rej(t.error);
    });
    await setMeta("lastPull", undefined); await setMeta("userId", undefined);
    await loadAll();
  },
  expired() {
    // On garde les données et la file d'envoi : elles partiront après la reconnexion
    cloud.session = null; ls.set(LS_KEY, null); setMeta("session", undefined).catch(() => {}); clearInterval(cloud.poll);
    cloud.showAuth("login", "Ta session a expiré : reconnecte-toi. Tes saisies sont gardées.");
  },
  async signOut() {
    const s = cloud.session;
    if (s && navigator.onLine) cloud.api("/auth/v1/logout", { method: "POST" }).catch(() => {});
    clearInterval(cloud.poll); clearTimeout(cloud.timer);
    cloud.session = null; cloud.last = null; cloud.pulled = null; ls.set(LS_KEY, null); await setMeta("session", undefined);
    await cloud.wipeLocal(); // rien ne reste sur l'appareil (ordinateur partagé…)
    renderAll(); cloud.showAuth("login", "Tu es déconnecté.");
  },
  showAuth(mode, msg, isErr) {
    cloud.mode = mode;
    const T = {
      login: ["Connexion", "Connecte-toi pour retrouver tes données sur ton téléphone et sur ordinateur.", "Se connecter"],
      signup: ["Créer un compte", "Ton nom, ton email et un mot de passe (8 caractères minimum).", "Créer mon compte"],
      forgot: ["Mot de passe oublié", "Entre ton email : tu recevras un lien pour choisir un nouveau mot de passe.", "Envoyer le lien"],
      newpass: ["Nouveau mot de passe", "Choisis ton nouveau mot de passe (8 caractères minimum).", "Enregistrer"]
    }[mode];
    $("aTitle").textContent = T[0]; $("aSub").textContent = T[1]; $("aSubmit").textContent = T[2];
    $("aEmailRow").hidden = mode === "newpass"; $("aNameRow").hidden = mode !== "signup"; $("aPassRow").hidden = mode === "forgot";
    $("aPass").autocomplete = mode === "login" ? "current-password" : "new-password";
    $("aSwitch").textContent = mode === "login" ? "Créer un compte" : "J'ai déjà un compte";
    $("aSwitch").hidden = mode === "newpass"; $("aForgot").hidden = mode !== "login";
    const m = $("aMsg"); m.hidden = !msg; m.textContent = msg || ""; m.className = "msg" + (isErr ? " err" : "");
    if (cloud.linkMsg && !msg) { m.hidden = false; m.textContent = cloud.linkMsg; m.className = "msg err"; cloud.linkMsg = null; }
    const pk = mode === "login" && passkey.supported();
    $("aPasskey").hidden = !pk; $("aOr").hidden = !pk;
    $("aPasskey").classList.toggle("ghost", !passkey.known()); $("aPasskey").classList.toggle("primary", passkey.known());
    $("aSubmit").classList.toggle("ghost", pk && passkey.known()); $("aSubmit").classList.toggle("primary", !(pk && passkey.known()));
    $("auth").hidden = false; $("aPass").value = "";
  },
  bindForm() {
    $("aSwitch").onclick = () => cloud.showAuth(cloud.mode === "login" ? "signup" : "login");
    $("aForgot").onclick = () => cloud.showAuth("forgot");
    $("aPasskey").onclick = () => passkey.login();
    $("aForm").onsubmit = async ev => {
      ev.preventDefault();
      const email = $("aEmail").value.trim().toLowerCase(), pass = $("aPass").value, mode = cloud.mode;
      if (mode !== "newpass" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { cloud.showAuth(mode, "Adresse email invalide.", true); return; }
      const name = $("aName").value.trim().replace(/\s+/g, " ");
      if (mode === "signup" && name.length < 2) { cloud.showAuth(mode, "Tape ton prénom et ton nom.", true); $("aEmail").value = email; return; }
      if (mode !== "forgot" && pass.length < 8) { cloud.showAuth(mode, "Mot de passe : 8 caractères minimum.", true); $("aEmail").value = email; return; }
      const b = $("aSubmit"); b.disabled = true; const old = b.textContent; b.textContent = "Patiente…";
      try {
        if (mode === "login") {
          cloud.saveSession(await cloud.api("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password: pass }) }, false));
          await cloud.enter(); renderAll(); toast("Connecté");
        } else if (mode === "signup") {
          const j = await cloud.api("/auth/v1/signup?redirect_to=" + encodeURIComponent(SITE), { method: "POST", body: JSON.stringify({ email, password: pass, data: { full_name: name } }) }, false);
          if (j && j.access_token) { cloud.saveSession(j); await cloud.enter(); renderAll(); toast("Compte créé"); }
          else { cloud.showAuth("login", `Compte créé. Un email de confirmation a été envoyé à ${email} : clique sur le lien, puis connecte-toi ici.`); $("aEmail").value = email; }
        } else if (mode === "forgot") {
          await cloud.api("/auth/v1/recover?redirect_to=" + encodeURIComponent(SITE), { method: "POST", body: JSON.stringify({ email }) }, false);
          cloud.showAuth("login", `Si un compte existe pour ${email}, un lien vient d'être envoyé.`); $("aEmail").value = email;
        } else if (mode === "newpass") {
          await cloud.api("/auth/v1/user", { method: "PUT", body: JSON.stringify({ password: pass }) });
          cloud.recovery = false; $("auth").hidden = true; toast("Mot de passe modifié");
        }
      } catch (e) {
        cloud.showAuth(mode, frErr(e && e.message), true); $("aEmail").value = email;
      } finally { b.disabled = false; b.textContent = cloud.mode === mode ? old : b.textContent; }
    };
  }
};
