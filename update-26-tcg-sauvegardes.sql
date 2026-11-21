-- ORG-Central — mise à jour 26 : la progression du TCG est enregistrée sur le compte du joueur
-- À coller dans Supabase > SQL Editor > New query, puis "Run".
-- Ne touche à aucune table existante : crée seulement public.tcg_saves.
--
-- Une ligne = la progression complète d'un compte (cartes, coquillages, boosters, succès…).
-- Effacer les données du navigateur ne remet plus à zéro : la partie est rechargée depuis le compte,
-- et elle suit le joueur sur tous ses appareils.
-- Chaque joueur ne peut lire et écrire QUE sa propre sauvegarde.

create table if not exists public.tcg_saves (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz default now(),
  constraint tcg_saves_taille check (octet_length(state::text) < 3000000)
);
alter table public.tcg_saves enable row level security;

create policy "le joueur lit sa sauvegarde" on public.tcg_saves for select using (user_id = auth.uid());
create policy "le joueur crée sa sauvegarde" on public.tcg_saves for insert with check (user_id = auth.uid());
create policy "le joueur met à jour sa sauvegarde" on public.tcg_saves for update using (user_id = auth.uid()) with check (user_id = auth.uid());
