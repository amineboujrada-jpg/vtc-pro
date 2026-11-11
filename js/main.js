// VTC Rentable — Démarrage de l'appli
"use strict";

// ---------- Démarrage ----------
(async () => {
  updateStatus();
  try {
    idb = await openDb(); await loadAll();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    theme.apply(); setInterval(() => { if (theme.get() === "night") theme.apply(); }, 60000);
    await cloud.start(); // connexion : affiche l'écran de connexion si besoin
    if (sync.ok() && S.meta.sheetFmt !== 3) { await setMeta("sheetFmt", 3); await setMeta("unsynced", true); } // nouveau format d'envoi : on renvoie une fois
    renderAll();
    if (S.meta.unsynced) scheduleSync(3000);
  } catch (e) {
    $("banner").hidden = false; $("banner").className = "banner warn";
    $("banner").innerHTML = "<b>Stockage indisponible</b>Ouvre l'appli depuis l'icône de l'écran d'accueil (pas en navigation privée).";
  }
  if ("serviceWorker" in navigator) {
    // Nouvelle version installée : on recharge une fois pour l'afficher tout de suite
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hadController && !reloaded && !$("sheet").classList.contains("open")) { reloaded = true; location.reload(); }
    });
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(r => r.update()).catch(() => {});
  }
})();
