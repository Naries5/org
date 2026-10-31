-- ORG-Central : casting secret
-- À coller dans Supabase > SQL Editor > New query, puis "Run".
--
-- Le casting secret est rangé dans une table à part, que seuls les hosts de l'ORG,
-- les admins et les comptes autorisés peuvent lire (la table "seasons" est publique).
-- La saison ne garde qu'un compteur public : { "secretCast": { "n": 12, "requests": true } }.

-- 1. Casting secret d'une saison
create table if not exists public.secret_casts (
  season_id text primary key references public.seasons(id) on delete cascade,
  entries jsonb not null default '[]',          -- [{ id, playerId?, name?, note? }]
  allow_requests boolean not null default false, -- les joueurs inscrits peuvent demander à le voir
  updated_at timestamptz default now(),
  updated_by uuid default auth.uid()
);

-- 2. Qui peut voir le casting secret (en plus des hosts de l'ORG et des admins)
create table if not exists public.cast_viewers (
  season_id text references public.seasons(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  added_by uuid,
  created_at timestamptz default now(),
  primary key (season_id, user_id)
);

-- Fonctions
create or replace function public.can_see_secret_cast(s text) returns boolean language sql stable security definer set search_path = public as
$$ select is_host_of(season_org(s)) or exists(select 1 from cast_viewers where season_id = s and user_id = auth.uid() and status = 'accepted') $$;
create or replace function public.secret_requests_open(s text) returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select allow_requests from secret_casts where season_id = s), false) $$;

-- Sécurité
alter table public.secret_casts enable row level security;
alter table public.cast_viewers enable row level security;

drop policy if exists "voir casting secret"     on public.secret_casts;
drop policy if exists "host crée casting secret" on public.secret_casts;
drop policy if exists "host modifie casting secret" on public.secret_casts;
drop policy if exists "host supprime casting secret" on public.secret_casts;
create policy "voir casting secret"          on public.secret_casts for select using (can_see_secret_cast(season_id));
create policy "host crée casting secret"     on public.secret_casts for insert with check (is_host_of(season_org(season_id)));
create policy "host modifie casting secret"  on public.secret_casts for update using (is_host_of(season_org(season_id))) with check (is_host_of(season_org(season_id)));
create policy "host supprime casting secret" on public.secret_casts for delete using (is_host_of(season_org(season_id)));

drop policy if exists "voir accès casting"      on public.cast_viewers;
drop policy if exists "ajouter accès casting"   on public.cast_viewers;
drop policy if exists "traiter accès casting"   on public.cast_viewers;
drop policy if exists "retirer accès casting"   on public.cast_viewers;
-- Le joueur voit sa propre demande, les hosts voient toute la liste
create policy "voir accès casting"    on public.cast_viewers for select using (user_id = auth.uid() or is_host_of(season_org(season_id)));
-- Le host ajoute qui il veut ; un joueur ne peut que demander (en attente), et seulement si les demandes sont ouvertes
create policy "ajouter accès casting" on public.cast_viewers for insert with check (
  is_host_of(season_org(season_id))
  or (user_id = auth.uid() and status = 'pending' and secret_requests_open(season_id)));
create policy "traiter accès casting" on public.cast_viewers for update using (is_host_of(season_org(season_id))) with check (is_host_of(season_org(season_id)));
create policy "retirer accès casting" on public.cast_viewers for delete using (user_id = auth.uid() or is_host_of(season_org(season_id)));
