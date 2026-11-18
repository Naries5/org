-- ORG-Central — mise à jour 20 : raretés du TCG choisies par les admins
-- À coller dans Supabase > SQL Editor > New query, puis "Run".
-- Ne touche à aucune table existante : crée seulement public.tcg_rarity.
--
-- Une ligne = une carte dont la rareté a été changée à la main (sinon le jeu calcule la rareté tout seul).
-- card : identifiant de la carte dans le jeu (ex. J:<id joueur>, O:<id ORG>, R:<id saison>, P:<id saison>:<id joueur>)

create table if not exists public.tcg_rarity (
  card text primary key check (char_length(card) between 3 and 200 and card !~ '^S:'),
  rarity text not null check (rarity in ('C','PC','R','E','L','M')),
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_at timestamptz default now()
);
alter table public.tcg_rarity enable row level security;

create policy "tout le monde lit les raretés" on public.tcg_rarity for select using (true);
create policy "admins ajoutent" on public.tcg_rarity for insert with check (public.is_admin());
create policy "admins modifient" on public.tcg_rarity for update using (public.is_admin()) with check (public.is_admin());
create policy "admins suppriment" on public.tcg_rarity for delete using (public.is_admin());
