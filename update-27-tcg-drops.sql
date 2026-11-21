-- ORG-Central — mise à jour 27 : fil des derniers gros tirages du TCG (mythiques et légendaires)
-- À coller dans Supabase > SQL Editor > New query, puis "Run".
-- Ne touche à aucune table existante : crée seulement public.tcg_drops.
--
-- Une ligne = une carte mythique ou légendaire tirée par un joueur dans un booster.
-- Tout le monde peut lire le fil ; chaque joueur ne peut ajouter que SES tirages.

create table if not exists public.tcg_drops (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card text not null check (char_length(card) between 3 and 200),
  rarity text not null check (rarity in ('M','L')),
  created_at timestamptz not null default now()
);
create index if not exists tcg_drops_recent on public.tcg_drops (created_at desc);
alter table public.tcg_drops enable row level security;

create policy "tout le monde lit les tirages" on public.tcg_drops for select using (true);
create policy "le joueur ajoute ses tirages" on public.tcg_drops for insert with check (user_id = auth.uid());
