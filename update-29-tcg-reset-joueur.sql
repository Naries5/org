-- ORG-Central — mise à jour 29 : le propriétaire du site peut remettre à zéro le TCG d'un joueur
-- À coller dans Supabase > SQL Editor > New query, puis "Run". De préférence quand le site est calme.
-- Ne touche à aucune table existante du site : crée public.tcg_resets et ajoute des règles
-- aux tables du TCG (tcg_saves, tcg_collections).
--
-- Une ligne = une remise à zéro demandée pour un compte. Au prochain chargement du TCG,
-- le jeu du joueur repart de zéro (cartes, coquillages, succès…).
-- Seul le propriétaire (is_owner) peut demander une remise à zéro ; le joueur peut seulement lire la sienne.

create table if not exists public.tcg_resets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reset_at timestamptz not null default now(),
  by_user uuid default auth.uid() references auth.users(id) on delete set null
);
alter table public.tcg_resets enable row level security;

create policy "le joueur voit sa remise à zéro" on public.tcg_resets for select using (user_id = auth.uid() or public.is_owner());
create policy "le propriétaire remet à zéro" on public.tcg_resets for insert with check (public.is_owner());
create policy "le propriétaire met à jour" on public.tcg_resets for update using (public.is_owner()) with check (public.is_owner());
create policy "le propriétaire annule" on public.tcg_resets for delete using (public.is_owner());

-- Le propriétaire peut aussi effacer la sauvegarde et la collection partagée du joueur
-- (pour qu'il disparaisse tout de suite du classement et du marché des échanges).
create policy "le propriétaire efface une sauvegarde" on public.tcg_saves for delete using (public.is_owner());
create policy "le propriétaire efface une collection" on public.tcg_collections for delete using (public.is_owner());
