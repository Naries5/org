-- ORG-Central — mise à jour 21 : un joueur peut demander à ne pas apparaître dans le TCG
-- À coller dans Supabase > SQL Editor > New query, puis "Run". À lancer AVANT la sortie du TCG.
-- Ne touche à aucune table existante : crée seulement public.tcg_optout.
--
-- Une ligne = une fiche joueur retirée du TCG (sa carte joueur, sa carte secrète et ses participations).
-- Le joueur connecté peut retirer (ou remettre) sa propre fiche ; les admins peuvent le faire pour n'importe qui.

create table if not exists public.tcg_optout (
  player_id text primary key references public.players(id) on delete cascade,
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz default now()
);
alter table public.tcg_optout enable row level security;

create policy "tout le monde lit les retraits" on public.tcg_optout for select using (true);
create policy "le joueur ou un admin retire" on public.tcg_optout for insert with check (
  public.is_admin() or exists (select 1 from public.players p where p.id = player_id and p.data->>'ownerUid' = auth.uid()::text)
);
create policy "le joueur ou un admin remet" on public.tcg_optout for delete using (
  public.is_admin() or exists (select 1 from public.players p where p.id = player_id and p.data->>'ownerUid' = auth.uid()::text)
);
