-- VTC Rentable : pilotage de l'appli (journal des erreurs, signalements, versions utilisées,
-- annonce, offre par compte, sauvegarde complète).
--
-- Aucune de ces tables n'a de politique RLS : ni l'appli ni un visiteur ne peuvent les lire ou les écrire
-- directement. Tout passe par les fonctions SECURITY DEFINER ci-dessous :
--   app_*   : appelées par l'appli pour le compte connecté (auth.uid()) ;
--   admin_* : réservées aux comptes de public.admins (vérifié par public.is_admin()).

-- ---------- Tables ----------

-- 1. Journal des erreurs survenues dans l'appli d'un chauffeur
create table if not exists public.app_errors (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  source text,            -- fichier:ligne:colonne
  stack text,
  screen text,            -- onglet ou fenêtre ouverte au moment de l'erreur
  app_label text,         -- version affichée (ex. 1.64)
  ua text,                -- navigateur / téléphone
  created_at timestamptz not null default now()
);
create index if not exists app_errors_created on public.app_errors (created_at desc);
create index if not exists app_errors_user on public.app_errors (user_id, created_at desc);
alter table public.app_errors enable row level security;
revoke all on public.app_errors from anon, authenticated;

-- 2. Signalements et idées envoyés depuis le menu de l'appli
create table if not exists public.app_feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('bug', 'idee')),
  message text not null,
  screen text,
  app_label text,
  ua text,
  done boolean not null default false,   -- traité par l'admin
  created_at timestamptz not null default now()
);
create index if not exists app_feedback_created on public.app_feedback (created_at desc);
create index if not exists app_feedback_user on public.app_feedback (user_id, created_at desc);
alter table public.app_feedback enable row level security;
revoke all on public.app_feedback from anon, authenticated;

-- 4. Version de l'appli utilisée par chaque compte (une ligne par compte, mise à jour à chaque ouverture)
create table if not exists public.app_clients (
  user_id uuid primary key references auth.users(id) on delete cascade,
  app_label text,
  app_version text,       -- numéro technique (ex. vtcpro-v69)
  ua text,
  standalone boolean,     -- ouverte depuis l'icône de l'écran d'accueil
  last_seen timestamptz not null default now()
);
alter table public.app_clients enable row level security;
revoke all on public.app_clients from anon, authenticated;

-- 5. Annonce affichée en haut de l'appli (une seule ligne)
create table if not exists public.app_announcement (
  id int primary key default 1 check (id = 1),
  message text not null default '',
  level text not null default 'info' check (level in ('info', 'warn')),
  active boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.app_announcement (id) values (1) on conflict do nothing;
alter table public.app_announcement enable row level security;
revoke all on public.app_announcement from anon, authenticated;

-- 7. Offre de chaque compte (prépare l'abonnement ; sans ligne = gratuit)
create table if not exists public.app_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'gratuit' check (plan in ('gratuit', 'essai', 'pro')),
  until date,             -- fin de l'essai ou de l'abonnement (vide = sans limite)
  updated_at timestamptz not null default now()
);
alter table public.app_plans enable row level security;
revoke all on public.app_plans from anon, authenticated;

-- ---------- Fonctions appelées par l'appli ----------

-- Ouverture de l'appli : note la version utilisée, renvoie l'annonce en cours et l'offre du compte
create or replace function public.app_ping(p_label text, p_version text, p_ua text, p_standalone boolean)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare uid uuid := auth.uid(); a public.app_announcement; pl public.app_plans;
begin
  if uid is null then raise exception 'Non connecté' using errcode = '42501'; end if;
  insert into public.app_clients (user_id, app_label, app_version, ua, standalone, last_seen)
  values (uid, left(p_label, 20), left(p_version, 40), left(p_ua, 300), p_standalone, now())
  on conflict (user_id) do update set app_label = excluded.app_label, app_version = excluded.app_version,
    ua = excluded.ua, standalone = excluded.standalone, last_seen = now();
  select * into a from public.app_announcement where id = 1 and active and message <> '';
  select * into pl from public.app_plans where user_id = uid;
  return jsonb_build_object(
    'annonce', case when a.id is null then null else jsonb_build_object('message', a.message, 'level', a.level, 'updated_at', a.updated_at) end,
    'plan', case when pl.user_id is null or (pl.until is not null and pl.until < current_date) then 'gratuit' else pl.plan end,
    'plan_until', pl.until);
end $$;

-- Enregistre une erreur (50 par compte et par jour au maximum, textes tronqués)
create or replace function public.app_report_error(p_message text, p_source text, p_stack text, p_screen text, p_label text, p_ua text)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Non connecté' using errcode = '42501'; end if;
  if coalesce(trim(p_message), '') = '' then return; end if;
  if (select count(*) from public.app_errors where user_id = uid and created_at > now() - interval '1 day') >= 50 then return; end if;
  insert into public.app_errors (user_id, message, source, stack, screen, app_label, ua)
  values (uid, left(p_message, 500), left(p_source, 300), left(p_stack, 2000), left(p_screen, 60), left(p_label, 20), left(p_ua, 300));
end $$;

-- Enregistre un signalement ou une idée (20 par compte et par jour au maximum)
create or replace function public.app_send_feedback(p_kind text, p_message text, p_screen text, p_label text, p_ua text)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Non connecté' using errcode = '42501'; end if;
  if p_kind not in ('bug', 'idee') then raise exception 'Type inconnu'; end if;
  if char_length(coalesce(trim(p_message), '')) < 3 then raise exception 'Message trop court'; end if;
  if (select count(*) from public.app_feedback where user_id = uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Trop de messages envoyés aujourd''hui';
  end if;
  insert into public.app_feedback (user_id, kind, message, screen, app_label, ua)
  values (uid, p_kind, left(trim(p_message), 2000), left(p_screen, 60), left(p_label, 20), left(p_ua, 300));
end $$;

-- ---------- Fonctions réservées à l'admin ----------

create or replace function public.admin_errors(p_limit int default 300)
returns table (id bigint, created_at timestamptz, user_id uuid, email text, message text, source text, stack text, screen text, app_label text, ua text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Accès réservé aux administrateurs' using errcode = '42501'; end if;
  return query
  select e.id, e.created_at, e.user_id, u.email::text, e.message, e.source, e.stack, e.screen, e.app_label, e.ua
  from public.app_errors e join auth.users u on u.id = e.user_id
  order by e.created_at desc limit least(greatest(p_limit, 1), 1000);
end $$;

-- Vide le journal : tout, ou seulement les erreurs portant ce message
create or replace function public.admin_clear_errors(p_message text default null) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Accès réservé aux administrateurs' using errcode = '42501'; end if;
  delete from public.app_errors where p_message is null or message = p_message;
end $$;

create or replace function public.admin_feedback()
returns table (id bigint, created_at timestamptz, user_id uuid, email text, full_name text, kind text, message text, screen text, app_label text, ua text, done boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Accès réservé aux administrateurs' using errcode = '42501'; end if;
  return query
  select f.id, f.created_at, f.user_id, u.email::text, (u.raw_user_meta_data->>'full_name')::text, f.kind, f.message, f.screen, f.app_label, f.ua, f.done
  from public.app_feedback f join auth.users u on u.id = f.user_id
  order by f.done, f.created_at desc limit 500;
end $$;

create or replace function public.admin_feedback_done(p_id bigint, p_done boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Accès réservé aux administrateurs' using errcode = '42501'; end if;
  update public.app_feedback set done = p_done where id = p_id;
end $$;

-- Version utilisée et offre de chaque compte
create or replace function public.admin_clients()
returns table (user_id uuid, app_label text, app_version text, ua text, standalone boolean, last_seen timestamptz, plan text, plan_until date)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Accès réservé aux administrateurs' using errcode = '42501'; end if;
  return query
  select u.id, c.app_label, c.app_version, c.ua, c.standalone, c.last_seen, coalesce(p.plan, 'gratuit'), p.until
  from auth.users u
  left join public.app_clients c on c.user_id = u.id
  left join public.app_plans p on p.user_id = u.id
  where c.user_id is not null or p.user_id is not null;
end $$;

create or replace function public.admin_set_plan(target uuid, p_plan text, p_until date default null) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Accès réservé aux administrateurs' using errcode = '42501'; end if;
  if p_plan not in ('gratuit', 'essai', 'pro') then raise exception 'Offre inconnue'; end if;
  insert into public.app_plans (user_id, plan, until, updated_at) values (target, p_plan, p_until, now())
  on conflict (user_id) do update set plan = excluded.plan, until = excluded.until, updated_at = now();
end $$;

create or replace function public.admin_get_announcement() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Accès réservé aux administrateurs' using errcode = '42501'; end if;
  return (select jsonb_build_object('message', message, 'level', level, 'active', active, 'updated_at', updated_at) from public.app_announcement where id = 1);
end $$;

-- Publie, modifie ou retire l'annonce. Changer le texte la fait réapparaître chez ceux qui l'avaient fermée.
create or replace function public.admin_set_announcement(p_message text, p_level text, p_active boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Accès réservé aux administrateurs' using errcode = '42501'; end if;
  if p_level not in ('info', 'warn') then raise exception 'Niveau inconnu'; end if;
  update public.app_announcement set message = left(coalesce(trim(p_message), ''), 400), level = p_level, active = p_active, updated_at = now() where id = 1;
end $$;

-- 6. Sauvegarde complète : toutes les données de tous les comptes, en un seul document
create or replace function public.admin_export_all() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Accès réservé aux administrateurs' using errcode = '42501'; end if;
  return jsonb_build_object(
    'exported_at', now(),
    'users', (select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'email', u.email, 'full_name', u.raw_user_meta_data->>'full_name', 'created_at', u.created_at) order by u.created_at), '[]'::jsonb) from auth.users u),
    'entries', (select coalesce(jsonb_agg(jsonb_build_object('user_id', e.user_id, 'store', e.store, 'id', e.id, 'data', e.data, 'deleted', e.deleted, 'updated_at', e.updated_at)), '[]'::jsonb) from public.entries e),
    'plans', (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from public.app_plans p),
    'feedback', (select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb) from public.app_feedback f));
end $$;

-- ---------- Droits ----------
revoke all on function
  public.app_ping(text, text, text, boolean),
  public.app_report_error(text, text, text, text, text, text),
  public.app_send_feedback(text, text, text, text, text),
  public.admin_errors(int), public.admin_clear_errors(text),
  public.admin_feedback(), public.admin_feedback_done(bigint, boolean),
  public.admin_clients(), public.admin_set_plan(uuid, text, date),
  public.admin_get_announcement(), public.admin_set_announcement(text, text, boolean),
  public.admin_export_all()
from public, anon;
grant execute on function
  public.app_ping(text, text, text, boolean),
  public.app_report_error(text, text, text, text, text, text),
  public.app_send_feedback(text, text, text, text, text),
  public.admin_errors(int), public.admin_clear_errors(text),
  public.admin_feedback(), public.admin_feedback_done(bigint, boolean),
  public.admin_clients(), public.admin_set_plan(uuid, text, date),
  public.admin_get_announcement(), public.admin_set_announcement(text, text, boolean),
  public.admin_export_all()
to authenticated;
