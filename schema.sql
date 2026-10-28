-- ORG-Central : base de données Supabase
-- À coller dans Supabase > SQL Editor > New query, puis "Run".

-- 1. Comptes (créés automatiquement à la connexion Discord)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  discord_name text,
  avatar_url text,
  role text not null default 'player' check (role in ('admin','host','player')),
  created_at timestamptz default now()
);

-- 2. Contenu du wiki (mêmes documents que la version actuelle)
create table if not exists public.orgs    (id text primary key, data jsonb not null default '{}', updated_at timestamptz default now());
create table if not exists public.seasons (id text primary key, data jsonb not null default '{}', updated_at timestamptz default now());
create table if not exists public.players (id text primary key, data jsonb not null default '{}', updated_at timestamptz default now());
create table if not exists public.news    (id text primary key, data jsonb not null default '{}', updated_at timestamptz default now());

-- 3. Hosts : quel compte peut modifier quelle ORG
create table if not exists public.org_hosts (
  org_id text references public.orgs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  primary key (org_id, user_id)
);

-- 4. Demandes « C'est moi »
create table if not exists public.claims (
  player_id text references public.players(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','refused')),
  created_at timestamptz default now(),
  primary key (player_id, user_id)
);

-- 5. Inscriptions aux saisons
create table if not exists public.signups (
  season_id text references public.seasons(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  message text,
  status text not null default 'pending' check (status in ('pending','accepted','refused')),
  created_at timestamptz default now(),
  primary key (season_id, user_id)
);

-- Fonctions de rôle
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select exists(select 1 from profiles where id = auth.uid() and role = 'admin') $$;
create or replace function public.is_host() returns boolean language sql stable security definer set search_path = public as
$$ select is_admin() or exists(select 1 from profiles where id = auth.uid() and role = 'host') $$;
create or replace function public.is_host_of(o text) returns boolean language sql stable security definer set search_path = public as
$$ select is_admin() or exists(select 1 from org_hosts where org_id = o and user_id = auth.uid()) $$;
create or replace function public.season_org(s text) returns text language sql stable security definer set search_path = public as
$$ select data->>'orgId' from seasons where id = s $$;

-- Sécurité
alter table public.profiles  enable row level security;
alter table public.orgs      enable row level security;
alter table public.seasons   enable row level security;
alter table public.players   enable row level security;
alter table public.news      enable row level security;
alter table public.org_hosts enable row level security;
alter table public.claims    enable row level security;
alter table public.signups   enable row level security;

-- Lecture publique du wiki
create policy "lecture" on public.orgs      for select using (true);
create policy "lecture" on public.seasons   for select using (true);
create policy "lecture" on public.players   for select using (true);
create policy "lecture" on public.news      for select using (true);
create policy "lecture" on public.org_hosts for select using (true);
create policy "lecture" on public.profiles  for select using (true);

-- ORGs : l'admin crée/supprime, le host modifie la sienne
create policy "admin crée orgs"   on public.orgs for insert with check (is_admin());
create policy "host modifie org"  on public.orgs for update using (is_host_of(id)) with check (is_host_of(id));
create policy "admin supprime org" on public.orgs for delete using (is_admin());

-- Saisons : le host de l'ORG gère tout
create policy "host saisons ins" on public.seasons for insert with check (is_host_of(data->>'orgId'));
create policy "host saisons upd" on public.seasons for update using (is_host_of(data->>'orgId')) with check (is_host_of(data->>'orgId'));
create policy "host saisons del" on public.seasons for delete using (is_host_of(data->>'orgId'));

-- Annonces : host de l'ORG, ou admin pour les annonces générales
create policy "host annonces ins" on public.news for insert with check (case when coalesce(data->>'orgId','') = '' then is_admin() else is_host_of(data->>'orgId') end);
create policy "host annonces upd" on public.news for update using (case when coalesce(data->>'orgId','') = '' then is_admin() else is_host_of(data->>'orgId') end);
create policy "host annonces del" on public.news for delete using (case when coalesce(data->>'orgId','') = '' then is_admin() else is_host_of(data->>'orgId') end);

-- Joueurs : les hosts créent/modifient, le joueur relié modifie sa fiche, l'admin supprime
create policy "host joueurs ins" on public.players for insert with check (is_host());
create policy "host joueurs upd" on public.players for update using (is_host());
create policy "joueur modifie sa fiche" on public.players for update
  using (data->>'ownerUid' = auth.uid()::text) with check (data->>'ownerUid' = auth.uid()::text);
create policy "admin joueurs del" on public.players for delete using (is_admin());

-- Comptes : l'admin change les rôles
create policy "admin rôles" on public.profiles for update using (is_admin());
create policy "admin hosts" on public.org_hosts for all using (is_admin()) with check (is_admin());

-- « C'est moi »
create policy "demande perso" on public.claims for insert with check (user_id = auth.uid());
create policy "voir demandes" on public.claims for select using (user_id = auth.uid() or is_host());
create policy "traiter demandes" on public.claims for update using (is_admin());
create policy "annuler demande" on public.claims for delete using (user_id = auth.uid() or is_admin());

-- Inscriptions
create policy "s'inscrire" on public.signups for insert with check (user_id = auth.uid());
create policy "voir inscriptions" on public.signups for select using (user_id = auth.uid() or is_host_of(season_org(season_id)));
create policy "traiter inscriptions" on public.signups for update using (is_host_of(season_org(season_id)));
create policy "se désinscrire" on public.signups for delete using (user_id = auth.uid() or is_host_of(season_org(season_id)));

-- Profil créé à la première connexion
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, discord_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Temps réel (les pages se mettent à jour toutes seules)
alter publication supabase_realtime add table public.orgs, public.seasons, public.players, public.news;

-- Images : dossier public "images"
insert into storage.buckets (id, name, public) values ('images','images', true) on conflict (id) do nothing;
create policy "images lecture" on storage.objects for select using (bucket_id = 'images');
create policy "images envoi" on storage.objects for insert with check (bucket_id = 'images' and auth.uid() is not null);

-- APRÈS ta première connexion sur le site, lance cette ligne pour devenir admin :
-- update public.profiles set role = 'admin' where discord_name = 'TON_PSEUDO_DISCORD';
