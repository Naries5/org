-- ORG-Central — mise à jour 24 : images des cartes du TCG choisies par les admins
-- À coller dans Supabase > SQL Editor > New query, puis "Run".
-- Ne touche à aucune table existante : crée seulement public.tcg_art.
--
-- Une ligne = une carte dont l'image a été changée par un admin (sinon le jeu prend la photo de la fiche).
-- card : identifiant de la carte (ex. J:<id joueur>, O:<id ORG>, R:<id saison>, P:<id saison>:<id joueur>, X:<carte spéciale>)
-- url  : lien https de l'image (en général dans le stockage "images" du site)

create table if not exists public.tcg_art (
  card text primary key check (char_length(card) between 3 and 200),
  url text not null check (url ~ '^https://' and char_length(url) <= 1000),
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_at timestamptz default now()
);
alter table public.tcg_art enable row level security;

create policy "tout le monde lit les images" on public.tcg_art for select using (true);
create policy "admins ajoutent une image" on public.tcg_art for insert with check (public.is_admin());
create policy "admins modifient une image" on public.tcg_art for update using (public.is_admin()) with check (public.is_admin());
create policy "admins suppriment une image" on public.tcg_art for delete using (public.is_admin());
