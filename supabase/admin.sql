-- VTC Rentable : tableau de bord admin (gestion des utilisateurs)
-- Seuls les comptes listés dans public.admins peuvent appeler les fonctions admin_*.
-- La table admins n'a aucune politique RLS : personne ne la lit/écrit depuis l'appli,
-- seules les fonctions SECURITY DEFINER ci-dessous y accèdent.

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

-- Premier admin : le compte d'Amine
insert into public.admins (user_id)
select id from auth.users where lower(email) = 'amineboujrada@gmail.com'
on conflict do nothing;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Liste des utilisateurs avec leur activité
create or replace function public.admin_users()
returns table (
  id uuid, email text, full_name text, created_at timestamptz,
  confirmed_at timestamptz, last_sign_in_at timestamptz, banned_until timestamptz,
  is_admin boolean, n_days bigint, n_depenses bigint, n_resas bigint,
  last_sync timestamptz, statut text, vehicule text, plateformes text[]
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Accès réservé aux administrateurs' using errcode = '42501'; end if;
  return query
  select u.id, u.email::text, (u.raw_user_meta_data->>'full_name')::text, u.created_at,
         u.email_confirmed_at, u.last_sign_in_at, u.banned_until,
         exists (select 1 from public.admins a where a.user_id = u.id),
         count(e.id) filter (where e.store = 'days' and not e.deleted),
         count(e.id) filter (where e.store = 'depenses' and not e.deleted),
         count(e.id) filter (where e.store = 'resas' and not e.deleted),
         max(e.updated_at),
         (max(e.data::text) filter (where e.store = 'settings' and e.id = 'config'))::jsonb #>> '{statut,type}',
         (max(e.data::text) filter (where e.store = 'settings' and e.id = 'config'))::jsonb #>> '{vehicule,type}',
         coalesce((select array_agg(k order by k) from jsonb_each_text(
           coalesce((max(e.data::text) filter (where e.store = 'settings' and e.id = 'config'))::jsonb -> 'plats', '{}'::jsonb)
         ) as p(k, v) where v = 'true'), '{}')
  from auth.users u
  left join public.entries e on e.user_id = u.id
  group by u.id
  order by u.created_at desc;
end $$;

-- Suspendre / réactiver un compte (bloque la connexion et coupe les sessions)
create or replace function public.admin_set_suspended(target uuid, suspended boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Accès réservé aux administrateurs' using errcode = '42501'; end if;
  if target = auth.uid() then raise exception 'Tu ne peux pas suspendre ton propre compte'; end if;
  if exists (select 1 from public.admins where user_id = target) then raise exception 'Impossible de suspendre un administrateur'; end if;
  update auth.users set banned_until = case when suspended then 'infinity'::timestamptz else null end where id = target;
  if suspended then delete from auth.sessions where user_id = target; end if;
end $$;

-- Supprimer définitivement un compte et toutes ses données (cascade sur entries)
create or replace function public.admin_delete_user(target uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Accès réservé aux administrateurs' using errcode = '42501'; end if;
  if target = auth.uid() then raise exception 'Tu ne peux pas supprimer ton propre compte'; end if;
  if exists (select 1 from public.admins where user_id = target) then raise exception 'Impossible de supprimer un administrateur'; end if;
  delete from auth.users where id = target;
end $$;

revoke all on function public.is_admin(), public.admin_users(),
  public.admin_set_suspended(uuid, boolean), public.admin_delete_user(uuid) from public, anon;
grant execute on function public.is_admin(), public.admin_users(),
  public.admin_set_suspended(uuid, boolean), public.admin_delete_user(uuid) to authenticated;
