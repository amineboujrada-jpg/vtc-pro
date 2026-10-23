-- VTC Pro : schéma de la base Supabase (déjà appliqué sur le projet vtc-pro)
-- Une table générique : chaque ligne = un élément de l'appli (jour, dépense, semaine) d'un utilisateur.

create table if not exists public.entries (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  store text not null check (store in ('days','depenses','weeks','settings')),
  id text not null,
  data jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,          -- suppression gardée pour prévenir les autres appareils
  updated_at timestamptz not null default now(),   -- heure serveur, sert à la synchro
  primary key (user_id, store, id)
);
create index if not exists entries_user_updated on public.entries (user_id, updated_at);

-- Sécurité : chacun ne voit et ne modifie que ses propres données
alter table public.entries enable row level security;
create policy "lire ses donnees" on public.entries for select to authenticated using (user_id = auth.uid());
create policy "ajouter ses donnees" on public.entries for insert to authenticated with check (user_id = auth.uid());
create policy "modifier ses donnees" on public.entries for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "supprimer ses donnees" on public.entries for delete to authenticated using (user_id = auth.uid());
revoke all on public.entries from anon;
grant select, insert, update, delete on public.entries to authenticated;

-- Heure de modification unique et fixée par le serveur
create or replace function public.entries_touch() returns trigger language plpgsql
set search_path = '' as $$
begin new.updated_at := clock_timestamp(); return new; end $$;
create trigger entries_touch before insert or update on public.entries
for each row execute function public.entries_touch();
