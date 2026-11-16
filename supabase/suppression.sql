-- Suppression de compte demandée par le chauffeur (exigence Google Play).
-- À exécuter une fois dans Supabase (SQL Editor), après schema.sql et les autres scripts.
--
-- Le chauffeur appelle POST /rest/v1/rpc/supprimer_mon_compte avec sa session.
-- La fonction supprime SA ligne de auth.users : toutes les tables liées (entries, sites, site_resa_log,
-- app_errors, app_feedback, app_clients, app_plans, exam_*…) sont effacées en cascade (on delete cascade).
-- Les abonnements aux notifications (push_subs) sont supprimés explicitement au cas où la table n'aurait pas de cascade.

create or replace function public.supprimer_mon_compte()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Non connecté';
  end if;
  -- Un administrateur ne peut pas supprimer son compte depuis l'appli (évite de perdre l'accès admin par erreur)
  if exists (select 1 from public.admins where user_id = uid) then
    raise exception 'Compte administrateur : suppression impossible depuis l''appli';
  end if;
  if to_regclass('public.push_subs') is not null then
    execute 'delete from public.push_subs where user_id = $1' using uid;
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.supprimer_mon_compte() from public, anon;
grant execute on function public.supprimer_mon_compte() to authenticated;
