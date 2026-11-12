// VTC Rentable — fonction Edge « rappel » : envoie les notifications du soir (Web Push).
//
// Deux façons de l'appeler :
//   - pg_cron, toutes les heures, avec l'en-tête x-cron-key : envoie le rappel aux appareils dont c'est l'heure ;
//   - l'appli, avec le jeton du chauffeur connecté et { endpoint } : envoie une notification de test à son appareil.
// Les clés VAPID et la clé du cron sont dans Supabase Vault (voir supabase/rappel.sql). Au premier appel, la fonction
// crée la paire de clés VAPID : aucune clé n'est écrite dans le code ni saisie à la main.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Sub = { endpoint: string; p256dh: string; auth: string };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let { data: conf, error: confErr } = await admin.rpc("rappel_config");
  if (confErr || !conf?.cron_key) return json({ error: "Configuration incomplète" }, 500);
  if (!conf.vapid_private || !conf.vapid_public) {
    const k = webpush.generateVAPIDKeys();
    await admin.rpc("rappel_init_keys", { p_public: k.publicKey, p_private: k.privateKey });
    ({ data: conf, error: confErr } = await admin.rpc("rappel_config"));
    if (confErr || !conf?.vapid_private || !conf?.vapid_public) return json({ error: "Clés de notification indisponibles" }, 500);
  }
  webpush.setVapidDetails("mailto:contact@vtcrentable.com", conf.vapid_public, conf.vapid_private);

  // Envoi à un appareil : "ok", "gone" (abonnement résilié) ou "err:<code>"
  const send = async (s: Sub, payload: Record<string, string>): Promise<string> => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload), { TTL: 3 * 3600, urgency: "normal" });
      return "ok";
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      return code === 404 || code === 410 ? "gone" : "err:" + (code ?? (e as Error).message);
    }
  };
  const sendAll = async (subs: Sub[], payload: Record<string, string>) => {
    const res = await Promise.all(subs.map((s) => send(s, payload)));
    const ok = subs.filter((_, i) => res[i] === "ok").map((s) => s.endpoint);
    const gone = subs.filter((_, i) => res[i] === "gone").map((s) => s.endpoint);
    if (gone.length) await admin.rpc("rappel_drop", { p_endpoints: gone });
    return { ok, gone, errors: res.filter((r) => r.startsWith("err:")) };
  };

  // 1. Appel planifié
  const cronKey = req.headers.get("x-cron-key");
  if (cronKey !== null) {
    if (cronKey !== conf.cron_key) return json({ error: "Accès refusé" }, 403);
    const { data: due, error } = await admin.rpc("rappel_due");
    if (error) return json({ error: error.message }, 500);
    const subs = (due ?? []) as Sub[];
    const r = await sendAll(subs, {
      title: "Ta journée n'est pas saisie",
      body: "Tu as roulé aujourd'hui ? Note tes recettes en moins d'une minute.",
      tag: "rappel-soir", url: "./",
    });
    if (r.ok.length) await admin.rpc("rappel_mark", { p_endpoints: r.ok });
    return json({ due: subs.length, sent: r.ok.length, gone: r.gone.length, errors: r.errors });
  }

  // 2. Notification de test demandée par le chauffeur connecté
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u } = await admin.auth.getUser(token);
  if (!u?.user) return json({ error: "Non connecté" }, 401);
  let body: { endpoint?: string } = {};
  try { body = await req.json(); } catch (_) { /* corps vide */ }
  if (!body.endpoint) return json({ error: "Appareil manquant" }, 400);
  const { data: mine } = await admin.rpc("rappel_subs_of", { p_user: u.user.id, p_endpoint: body.endpoint });
  const subs = (mine ?? []) as Sub[];
  if (!subs.length) return json({ error: "Rappel non activé sur cet appareil" }, 404);
  const r = await sendAll(subs, {
    title: "VTC Rentable", body: "Les notifications marchent sur cet appareil.", tag: "rappel-test", url: "./",
  });
  return json({ sent: r.ok.length, gone: r.gone.length, errors: r.errors }, r.ok.length ? 200 : 502);
});
