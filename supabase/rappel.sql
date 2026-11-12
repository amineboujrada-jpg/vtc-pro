-- VTC Rentable : rappel du soir par notification (Web Push).
--
-- Fonctionnement : chaque appareil qui active le rappel enregistre son abonnement dans push_subs, avec l'heure choisie.
-- Toutes les heures, pg_cron appelle la fonction Edge « rappel », qui envoie une notification aux appareils dont
-- c'est l'heure et dont le chauffeur n'a encore rien saisi pour la journée.
--
-- Trois valeurs sont gardées dans Supabase Vault, jamais dans ce dépôt, et personne n'a besoin de les connaître :
--   rappel_cron_key      : clé que pg_cron présente à la fonction Edge (créée par ce script)
--   rappel_vapid_private : clé privée VAPID, qui signe les notifications (créée par la fonction Edge à son premier appel)
--   rappel_vapid_public  : clé publique VAPID, donnée à l'appli par app_push_key()

create table if not exists public.push_subs (
  endpoint text primary key,                -- adresse d'envoi donnée par le navigateur (une par appareil)
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  hour smallint not null default 21 check (hour between 0 and 23),   -- heure locale du rappel
  tz text not null default 'Europe/Paris',
  last_sent date,                           -- dernier jour (local) où un rappel est parti
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subs_user on public.push_subs (user_id);
alter table public.push_subs enable row level security;
revoke all on public.push_subs from anon, authenticated;

-- Appelée par l'appli : active ou met à jour le rappel de cet appareil
create or replace function public.app_push_save(p_endpoint text, p_p256dh text, p_auth text, p_hour int, p_tz text)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare uid uuid := auth.uid(); z text;
begin
  if uid is null then raise exception 'Non connecté' using errcode = '42501'; end if;
  if p_endpoint is null or p_endpoint !~ '^https://' or char_length(p_endpoint) > 1000 then raise exception 'Abonnement invalide'; end if;
  if coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' or char_length(p_p256dh) > 200 or char_length(p_auth) > 100 then raise exception 'Abonnement invalide'; end if;
  if p_hour is null or p_hour < 0 or p_hour > 23 then raise exception 'Heure invalide'; end if;
  select name into z from pg_catalog.pg_timezone_names where name = p_tz;
  if (select count(*) from public.push_subs where user_id = uid and endpoint <> p_endpoint) >= 10 then raise exception 'Trop d''appareils'; end if;
  insert into public.push_subs (endpoint, user_id, p256dh, auth, hour, tz)
  values (p_endpoint, uid, p_p256dh, p_auth, p_hour, coalesce(z, 'Europe/Paris'))
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
    hour = excluded.hour, tz = excluded.tz, updated_at = now();
end $$;

-- Appelée par l'appli : coupe le rappel de cet appareil
create or replace function public.app_push_remove(p_endpoint text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Non connecté' using errcode = '42501'; end if;
  delete from public.push_subs where endpoint = p_endpoint and user_id = auth.uid();
end $$;

-- ---------- Réservé à la fonction Edge (rôle service_role) ----------

create or replace function public.rappel_config() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'vapid_public', (select decrypted_secret from vault.decrypted_secrets where name = 'rappel_vapid_public'),
    'vapid_private', (select decrypted_secret from vault.decrypted_secrets where name = 'rappel_vapid_private'),
    'cron_key', (select decrypted_secret from vault.decrypted_secrets where name = 'rappel_cron_key'));
$$;

-- Premier appel de la fonction Edge : elle crée la paire de clés VAPID et la range ici. Sans effet si elle existe déjà.
create or replace function public.rappel_init_keys(p_public text, p_private text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if exists (select 1 from vault.decrypted_secrets where name = 'rappel_vapid_private') then return; end if;
  perform vault.create_secret(p_private, 'rappel_vapid_private');
  perform vault.create_secret(p_public, 'rappel_vapid_public');
end $$;

-- Appelée par l'appli avant d'abonner l'appareil : la clé publique VAPID (vide tant que le serveur n'est pas prêt)
create or replace function public.app_push_key() returns text
language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'rappel_vapid_public';
$$;

-- Appareils à prévenir maintenant : c'est leur heure, pas encore prévenus aujourd'hui, et aucune journée saisie
create or replace function public.rappel_due()
returns table (endpoint text, p256dh text, auth text, user_id uuid, local_date date)
language sql stable security definer set search_path = '' as $$
  select s.endpoint, s.p256dh, s.auth, s.user_id, (now() at time zone s.tz)::date
  from public.push_subs s
  where extract(hour from now() at time zone s.tz)::int = s.hour
    and (s.last_sent is null or s.last_sent < (now() at time zone s.tz)::date)
    and not exists (
      select 1 from public.entries e
      where e.user_id = s.user_id and e.store = 'days' and not e.deleted
        and e.id = to_char((now() at time zone s.tz)::date, 'YYYY-MM-DD'));
$$;

create or replace function public.rappel_mark(p_endpoints text[]) returns void
language sql volatile security definer set search_path = '' as $$
  update public.push_subs s set last_sent = (now() at time zone s.tz)::date where s.endpoint = any(p_endpoints);
$$;

-- Abonnements que le navigateur a résiliés (appli désinstallée, autorisation retirée)
create or replace function public.rappel_drop(p_endpoints text[]) returns void
language sql volatile security definer set search_path = '' as $$
  delete from public.push_subs where endpoint = any(p_endpoints);
$$;

create or replace function public.rappel_subs_of(p_user uuid, p_endpoint text)
returns table (endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = '' as $$
  select s.endpoint, s.p256dh, s.auth from public.push_subs s where s.user_id = p_user and (p_endpoint is null or s.endpoint = p_endpoint);
$$;

revoke all on function public.app_push_save(text, text, text, int, text), public.app_push_remove(text), public.app_push_key() from public, anon;
grant execute on function public.app_push_save(text, text, text, int, text), public.app_push_remove(text), public.app_push_key() to authenticated;
revoke all on function public.rappel_init_keys(text, text) from public, anon, authenticated;
grant execute on function public.rappel_init_keys(text, text) to service_role;
revoke all on function public.rappel_config(), public.rappel_due(), public.rappel_mark(text[]), public.rappel_drop(text[]), public.rappel_subs_of(uuid, text) from public, anon, authenticated;
grant execute on function public.rappel_config(), public.rappel_due(), public.rappel_mark(text[]), public.rappel_drop(text[]), public.rappel_subs_of(uuid, text) to service_role;

-- Clé du cron : créée ici, au hasard, si elle n'existe pas encore
do $$ begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'rappel_cron_key') then
    perform vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'rappel_cron_key');
  end if;
end $$;

-- ---------- Planification (une seule fois, après le déploiement de la fonction Edge « rappel ») ----------
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
-- select cron.schedule('rappel-soir', '0 * * * *', $job$
--   select net.http_post(
--     url := 'https://izjwblfezffiksoyapwa.supabase.co/functions/v1/rappel',
--     headers := jsonb_build_object('Content-Type', 'application/json',
--       'x-cron-key', (select decrypted_secret from vault.decrypted_secrets where name = 'rappel_cron_key')),
--     body := '{"cron":true}'::jsonb, timeout_milliseconds := 20000);
-- $job$);
