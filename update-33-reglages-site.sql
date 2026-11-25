-- ORG-Central — mise à jour 33 : réglages du site (textes modifiés et apparence)
-- À coller dans Supabase > SQL Editor > New query, puis "Run". Rapide : crée une petite table vide.
-- Ne touche à aucune fiche, saison, ORG ni compte.

create table if not exists public.site (
  id text primary key,                 -- 'texts' (textes remplacés) ou 'theme' (couleurs, polices, CSS)
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

alter table public.site enable row level security;

-- Tout le monde peut lire (le site doit afficher les textes et l'apparence à chaque visiteur)
drop policy if exists "site lecture" on public.site;
create policy "site lecture" on public.site for select using (true);

-- Seuls les admins peuvent modifier
drop policy if exists "site admins insert" on public.site;
create policy "site admins insert" on public.site for insert with check (public.is_admin());
drop policy if exists "site admins update" on public.site;
create policy "site admins update" on public.site for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "site admins delete" on public.site;
create policy "site admins delete" on public.site for delete using (public.is_admin());
