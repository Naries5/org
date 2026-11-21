-- ORG-Central — mise à jour 22 : collections partagées du TCG
-- À coller dans Supabase > SQL Editor > New query, puis "Run". Lance d'abord update-19 (échanges) si ce n'est pas fait.
-- Ne touche à aucune table du site : crée public.tcg_collections et assouplit une règle de public.tcg_trades.
--
-- tcg_collections : la collection de chaque joueur (pour voir ce que l'autre possède pendant un échange),
-- ses cartes proposées à l'échange (onglet du marché) et ses chiffres pour le classement.

create table if not exists public.tcg_collections (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  owned jsonb not null default '{}'::jsonb,
  fortrade text[] not null default '{}',
  uniq integer not null default 0,
  myth integer not null default 0,
  opened integer not null default 0,
  ach integer not null default 0,
  updated_at timestamptz default now(),
  check (pg_column_size(owned) < 400000 and cardinality(fortrade) <= 60)
);
create index if not exists tcg_collections_uniq on public.tcg_collections (uniq desc);
alter table public.tcg_collections enable row level security;

create policy "les connectés voient les collections" on public.tcg_collections for select using (auth.role() = 'authenticated');
create policy "chacun crée la sienne" on public.tcg_collections for insert with check (user_id = auth.uid());
create policy "chacun modifie la sienne" on public.tcg_collections for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Échanges : on peut aussi proposer un échange à un joueur qui n'est pas ton ami (depuis l'onglet « À l'échange » du marché).
do $$ begin
  if to_regclass('public.tcg_trades') is not null then
    drop policy if exists "proposer à un ami" on public.tcg_trades;
    drop policy if exists "proposer un échange" on public.tcg_trades;
    create policy "proposer un échange" on public.tcg_trades for insert
      with check (sender = auth.uid() and status = 'pending' and sender_done = false);
  end if;
end $$;
