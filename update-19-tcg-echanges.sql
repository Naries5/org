-- ORG-Central — mise à jour 19 : échanges de cartes du TCG entre amis
-- À coller dans Supabase > SQL Editor > New query, puis "Run".
-- Ne touche à aucune table existante : crée seulement public.tcg_trades.
--
-- Une proposition d'échange : l'expéditeur donne des cartes (give) et en demande (want).
-- Le destinataire accepte ou refuse, l'expéditeur peut annuler tant que rien n'est décidé.
-- Chaque joueur applique ensuite sa part dans sa collection ; sender_done indique que l'expéditeur l'a fait.

create table if not exists public.tcg_trades (
  id bigserial primary key,
  sender uuid not null references auth.users(id) on delete cascade,
  recipient uuid not null references auth.users(id) on delete cascade,
  give text[] not null default '{}',
  want text[] not null default '{}',
  note text check (note is null or char_length(note) <= 200),
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  sender_done boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (sender <> recipient),
  check (cardinality(give) <= 5 and cardinality(want) <= 5 and cardinality(give) + cardinality(want) >= 1)
);
create index if not exists tcg_trades_sender on public.tcg_trades (sender, created_at desc);
create index if not exists tcg_trades_recipient on public.tcg_trades (recipient, created_at desc);
alter table public.tcg_trades enable row level security;

create policy "voir mes échanges" on public.tcg_trades for select using (auth.uid() in (sender, recipient));
create policy "proposer à un ami" on public.tcg_trades for insert
  with check (sender = auth.uid() and status = 'pending' and sender_done = false and public.are_friends(sender, recipient));
create policy "répondre ou annuler" on public.tcg_trades for update using (auth.uid() in (sender, recipient));

-- Garde-fou : on ne change que ce qu'on a le droit de changer.
create or replace function public.tcg_trades_guard() returns trigger language plpgsql as $$
begin
  if new.sender <> old.sender or new.recipient <> old.recipient or new.give <> old.give or new.want <> old.want
     or coalesce(new.note,'') <> coalesce(old.note,'') or new.created_at <> old.created_at then
    raise exception 'Échange non modifiable';
  end if;
  if new.status <> old.status then
    if old.status <> 'pending' then raise exception 'Échange déjà décidé'; end if;
    if new.status in ('accepted','declined') and auth.uid() <> old.recipient then raise exception 'Seul le destinataire répond'; end if;
    if new.status = 'cancelled' and auth.uid() <> old.sender then raise exception 'Seul l''expéditeur annule'; end if;
  end if;
  if new.sender_done <> old.sender_done and (auth.uid() <> old.sender or new.sender_done = false) then
    raise exception 'Réservé à l''expéditeur';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists tcg_trades_guard on public.tcg_trades;
create trigger tcg_trades_guard before update on public.tcg_trades for each row execute function public.tcg_trades_guard();
