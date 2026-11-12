-- VTC Rentable : sites vitrines des chauffeurs (option « Mon site »)
-- Un site par compte. Adresse : vtcrentable.com/chauffeur/<adresse>/ (et plus tard <adresse>.vtcrentable.com :
-- le format des adresses est déjà celui d'un sous-domaine).
-- Aucune lecture ni écriture directe des tables : tout passe par les fonctions ci-dessous.
--   chauffeur : site_slug_check, site_get, site_save, site_demander
--   public    : site_public, sites_public_list, site_reserver
--   admin     : admin_sites, admin_site_statut

create table if not exists public.sites (
  user_id uuid primary key references auth.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$' and slug !~ '--'),
  modele text not null default 'nuit' check (modele in ('nuit', 'clair', 'prestige')),
  data jsonb not null default '{}'::jsonb,
  statut text not null default 'brouillon' check (statut in ('brouillon', 'demande', 'en_ligne', 'suspendu')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  demande_at timestamptz,
  published_at timestamptz
);
comment on table public.sites is 'Site vitrine de chaque chauffeur (option payante). Mise en ligne validée par un administrateur.';
alter table public.sites enable row level security;
revoke all on public.sites from anon, authenticated;

-- Journal des réservations reçues par les sites : sert uniquement à limiter les abus (pas de donnée du client)
create table if not exists public.site_resa_log (
  id bigint generated always as identity primary key,
  site_user uuid not null references auth.users(id) on delete cascade,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists site_resa_log_site on public.site_resa_log (site_user, created_at);
create index if not exists site_resa_log_ip on public.site_resa_log (ip, created_at);
alter table public.site_resa_log enable row level security;
revoke all on public.site_resa_log from anon, authenticated;

-- ---------- Adresse du site ----------
-- Adresses interdites : noms techniques (utiles le jour où les sites passent en sous-domaine) et noms trompeurs
create or replace function public.site_slug_reserved(p text) returns boolean
language sql immutable set search_path = '' as $$
  select p = any (array['www', 'app', 'api', 'admin', 'administrateur', 'mail', 'email', 'smtp', 'imap', 'pop', 'ftp', 'ns1', 'ns2',
    'blog', 'contact', 'support', 'aide', 'help', 'test', 'demo', 'apercu', 'exemple', 'site', 'sites', 'chauffeur', 'chauffeurs',
    'vtc', 'vtcrentable', 'vtc-rentable', 'rentable', 'calculateurs', 'calculateur', 'examen', 'examen-blanc', 'modeles', 'outils',
    'assets', 'static', 'cdn', 'login', 'connexion', 'compte', 'paiement', 'prix', 'tarifs', 'legal', 'mentions-legales',
    'confidentialite', 'securite', 'status', 'dev', 'staging', 'prod', 'null', 'undefined', 'sitemap', 'robots',
    'uber', 'bolt', 'heetch', 'freenow', 'lecab', 'allocab', 'marcel', 'g7', 'taxi-g7', 'google', 'apple', 'ionos', 'stripe', 'supabase']);
$$;

-- Vérifie une adresse : 'libre', 'invalide' (format), 'reserve' (nom interdit) ou 'pris' (déjà utilisée par un autre chauffeur)
create or replace function public.site_slug_check(p_slug text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare s text := lower(btrim(coalesce(p_slug, '')));
begin
  if auth.uid() is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if s !~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$' or s ~ '--' then return 'invalide'; end if;
  if public.site_slug_reserved(s) then return 'reserve'; end if;
  if exists (select 1 from public.sites where slug = s and user_id <> auth.uid()) then return 'pris'; end if;
  return 'libre';
end $$;

-- ---------- Contenu du site ----------
-- Ne garde que les champs connus, coupés à leur longueur maximale
create or replace function public.site_clean(p jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  t text; o jsonb := '{}'::jsonb;
  champs constant jsonb := '{"nom":60,"ville":60,"zones":200,"tel":20,"email":120,"accroche":120,"presentation":900,"vehicule":80,"horaires":80,"exploitant":100,"siren":20,"registre":30}';
  k text; n int;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return o; end if;
  for k, n in select key, value::int from jsonb_each_text(champs) loop
    t := left(btrim(regexp_replace(coalesce(p ->> k, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F]', '', 'g')), n);
    if k <> 'presentation' then t := regexp_replace(t, '\s+', ' ', 'g'); end if;
    o := o || jsonb_build_object(k, t);
  end loop;
  o := o || jsonb_build_object(
    'whatsapp', coalesce(p ->> 'whatsapp', '') = 'true',
    'places', least(8, greatest(1, coalesce(nullif(regexp_replace(coalesce(p ->> 'places', ''), '\D', '', 'g'), '')::int, 4))),
    'services', coalesce((select jsonb_agg(v order by i) from (
        select left(btrim(regexp_replace(x, '\s+', ' ', 'g')), 40) as v, i
        from jsonb_array_elements_text(case when jsonb_typeof(p -> 'services') = 'array' then p -> 'services' else '[]'::jsonb end) with ordinality as a(x, i)
        where btrim(x) <> '' order by i limit 10) s), '[]'::jsonb),
    'tarifs', coalesce((select jsonb_agg(jsonb_build_object('label', l, 'prix', pr) order by i) from (
        select left(btrim(regexp_replace(coalesce(x ->> 'label', ''), '\s+', ' ', 'g')), 60) as l,
               left(btrim(regexp_replace(coalesce(x ->> 'prix', ''), '\s+', ' ', 'g')), 24) as pr, i
        from jsonb_array_elements(case when jsonb_typeof(p -> 'tarifs') = 'array' then p -> 'tarifs' else '[]'::jsonb end) with ordinality as a(x, i)
        where jsonb_typeof(x) = 'object' and btrim(coalesce(x ->> 'label', '')) <> '' order by i limit 8) s), '[]'::jsonb));
  return o;
end $$;

create or replace function public.site_row(s public.sites) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('slug', s.slug, 'modele', s.modele, 'data', s.data, 'statut', s.statut,
    'updated_at', s.updated_at, 'demande_at', s.demande_at, 'published_at', s.published_at);
$$;

-- Le site du chauffeur connecté (null s'il n'en a pas)
create or replace function public.site_get() returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.site_row(s) from public.sites s where s.user_id = auth.uid();
$$;

-- Crée ou modifie le site du chauffeur connecté
create or replace function public.site_save(p_slug text, p_modele text, p_data jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare s text := lower(btrim(coalesce(p_slug, ''))); etat text; cur public.sites; res public.sites;
begin
  if auth.uid() is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if p_modele is null or p_modele not in ('nuit', 'clair', 'prestige') then raise exception 'Modèle inconnu'; end if;
  if pg_column_size(p_data) > 20000 then raise exception 'Contenu trop long'; end if;
  etat := public.site_slug_check(s);
  if etat = 'invalide' then raise exception 'Adresse invalide : 3 à 30 caractères, lettres, chiffres et tirets'; end if;
  if etat = 'reserve' then raise exception 'Cette adresse est réservée, choisis-en une autre'; end if;
  if etat = 'pris' then raise exception 'Cette adresse est déjà prise'; end if;
  select * into cur from public.sites where user_id = auth.uid();
  if found and cur.statut = 'en_ligne' and cur.slug <> s then
    raise exception 'Ton site est en ligne : écris à contact@vtcrentable.com pour changer son adresse';
  end if;
  begin
    insert into public.sites as t (user_id, slug, modele, data)
    values (auth.uid(), s, p_modele, public.site_clean(p_data))
    on conflict (user_id) do update set slug = excluded.slug, modele = excluded.modele, data = excluded.data, updated_at = now()
    returning t.* into res;
  exception when unique_violation then raise exception 'Cette adresse est déjà prise';
  end;
  return public.site_row(res);
end $$;

-- Demande de mise en ligne : un administrateur valide ensuite
create or replace function public.site_demander() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare res public.sites;
begin
  if auth.uid() is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  select * into res from public.sites where user_id = auth.uid();
  if not found then raise exception 'Enregistre d''abord ton site'; end if;
  if coalesce(res.data ->> 'nom', '') = '' or coalesce(res.data ->> 'ville', '') = '' or coalesce(res.data ->> 'tel', '') = '' then
    raise exception 'Renseigne au moins ton nom, ta ville et ton téléphone';
  end if;
  if res.statut = 'suspendu' then raise exception 'Ton site est suspendu : écris à contact@vtcrentable.com'; end if;
  if res.statut = 'brouillon' then
    update public.sites set statut = 'demande', demande_at = now() where user_id = auth.uid() returning * into res;
  end if;
  return public.site_row(res);
end $$;

-- ---------- Lecture publique (sites en ligne seulement) ----------
create or replace function public.site_public(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('slug', s.slug, 'modele', s.modele, 'data', s.data, 'updated_at', s.updated_at, 'published_at', s.published_at)
  from public.sites s where s.slug = lower(btrim(coalesce(p_slug, ''))) and s.statut = 'en_ligne';
$$;

create or replace function public.sites_public_list() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('slug', s.slug, 'modele', s.modele, 'data', s.data, 'updated_at', s.updated_at,
    'published_at', s.published_at) order by s.slug), '[]'::jsonb)
  from public.sites s where s.statut = 'en_ligne';
$$;

-- ---------- Réservation faite par un client sur le site d'un chauffeur ----------
-- La demande arrive « En attente » dans la page Réservations de l'appli du chauffeur (table entries, magasin resas).
create or replace function public.site_reserver(
  p_slug text, p_nom text, p_tel text, p_date date, p_heure text, p_depart text,
  p_arrivee text default '', p_pax int default 1, p_note text default '', p_piege text default ''
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  proprio uuid; rid text; v_ip text; auj date := (now() at time zone 'Europe/Paris')::date;
  nom text := left(btrim(regexp_replace(coalesce(p_nom, ''), '\s+', ' ', 'g')), 60);
  tel text := left(btrim(coalesce(p_tel, '')), 20);
  dep text := left(btrim(regexp_replace(coalesce(p_depart, ''), '\s+', ' ', 'g')), 160);
  arr text := left(btrim(regexp_replace(coalesce(p_arrivee, ''), '\s+', ' ', 'g')), 160);
  note text := left(btrim(regexp_replace(coalesce(p_note, ''), '\s+', ' ', 'g')), 200);
begin
  select user_id into proprio from public.sites where slug = lower(btrim(coalesce(p_slug, ''))) and statut = 'en_ligne';
  if proprio is null then raise exception 'Ce site n''est pas en ligne'; end if;
  if coalesce(p_piege, '') <> '' then return jsonb_build_object('ok', true); end if; -- champ caché rempli : robot
  if length(nom) < 2 then raise exception 'Indiquez votre nom'; end if;
  if tel !~ '^\+?[0-9 .()-]{8,20}$' then raise exception 'Vérifiez votre numéro de téléphone'; end if;
  if p_date is null or p_date < auj or p_date > auj + 365 then raise exception 'Vérifiez la date de prise en charge'; end if;
  if coalesce(p_heure, '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Vérifiez l''heure de prise en charge'; end if;
  if length(dep) < 3 then raise exception 'Indiquez l''adresse de prise en charge'; end if;

  begin
    v_ip := md5(split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1));
  exception when others then v_ip := null;
  end;
  if v_ip is not null and (select count(*) from public.site_resa_log l where l.ip = v_ip and l. created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Trop de demandes envoyées : réessayez plus tard ou appelez le chauffeur';
  end if;
  if (select count(*) from public.site_resa_log where site_user = proprio and created_at > now() - interval '1 day') >= 40 then
    raise exception 'Le chauffeur a reçu beaucoup de demandes aujourd''hui : appelez-le directement';
  end if;
  insert into public.site_resa_log (site_user, ip) values (proprio, v_ip);
  delete from public.site_resa_log where created_at < now() - interval '30 days';

  rid := 'r' || substr(md5(gen_random_uuid()::text), 1, 12);
  insert into public.entries (user_id, store, id, data) values (proprio, 'resas', rid, jsonb_build_object(
    'id', rid, 'createdAt', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'nom', nom, 'tel', tel, 'date', to_char(p_date, 'YYYY-MM-DD'), 'heure', p_heure, 'depart', dep, 'arrivee', arr,
    'pax', least(8, greatest(1, coalesce(p_pax, 1))), 'prix', 0, 'canal', 'Site / appli', 'note', note,
    'statut', 'attente', 'site', true));
  return jsonb_build_object('ok', true, 'numero', 'R-' || to_char(now() at time zone 'UTC', 'YYYYMMDD') || '-' || upper(right(rid, 4)));
end $$;

-- ---------- Administration ----------
create or replace function public.admin_sites()
returns table (user_id uuid, email text, slug text, modele text, statut text, nom text, ville text, tel text,
  data jsonb, updated_at timestamptz, demande_at timestamptz, published_at timestamptz, n_resas bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Accès réservé aux administrateurs' using errcode = '42501'; end if;
  return query
  select s.user_id, u.email::text, s.slug, s.modele, s.statut, s.data ->> 'nom', s.data ->> 'ville', s.data ->> 'tel',
         s.data, s.updated_at, s.demande_at, s.published_at,
         (select count(*) from public.site_resa_log l where l.site_user = s.user_id)
  from public.sites s join auth.users u on u.id = s.user_id
  order by (s.statut = 'demande') desc, s.updated_at desc;
end $$;

-- Met un site en ligne, le suspend ou le repasse en brouillon
create or replace function public.admin_site_statut(target uuid, p_statut text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Accès réservé aux administrateurs' using errcode = '42501'; end if;
  if p_statut not in ('en_ligne', 'suspendu', 'brouillon') then raise exception 'État inconnu'; end if;
  update public.sites set statut = p_statut,
    published_at = case when p_statut = 'en_ligne' then coalesce(published_at, now()) else published_at end,
    updated_at = now()
  where user_id = target;
  if not found then raise exception 'Site introuvable'; end if;
end $$;

revoke all on function public.site_slug_reserved(text), public.site_clean(jsonb), public.site_row(public.sites),
  public.site_slug_check(text), public.site_get(), public.site_save(text, text, jsonb), public.site_demander(),
  public.site_public(text), public.sites_public_list(),
  public.site_reserver(text, text, text, date, text, text, text, int, text, text),
  public.admin_sites(), public.admin_site_statut(uuid, text) from public, anon, authenticated;
grant execute on function public.site_slug_check(text), public.site_get(), public.site_save(text, text, jsonb), public.site_demander(),
  public.admin_sites(), public.admin_site_statut(uuid, text) to authenticated;
grant execute on function public.site_public(text), public.sites_public_list(),
  public.site_reserver(text, text, text, date, text, text, text, int, text, text) to anon, authenticated;
