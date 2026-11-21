-- ORG-Central — mise à jour 28 : marché du TCG (ventes, enchères, enchères du jour) et tchat global
-- À coller dans Supabase > SQL Editor > New query, puis "Run".
-- Ne touche à aucune table existante : crée public.tcg_market, public.tcg_chat et quelques fonctions.
--
-- tcg_market : une ligne = une carte en vente (prix fixe) ou aux enchères.
--   Les annonces "daily-…" sont les 3 mythiques mises aux enchères chaque jour par le site (départ 500).
--   Tout le monde lit le marché. Un joueur crée ses propres annonces ; acheter, enchérir, retirer
--   et encaisser passent par les fonctions ci-dessous, qui vérifient tout d'un seul coup
--   (deux joueurs ne peuvent pas acheter la même carte).
-- tcg_chat : le tchat global du marché (300 caractères max par message).

create table if not exists public.tcg_market (
  id text primary key check (char_length(id) between 5 and 80),
  card text not null check (char_length(card) between 3 and 200),
  seller uuid references auth.users(id) on delete cascade,
  seller_name text check (char_length(seller_name) <= 80),
  mode text not null check (mode in ('direct','auction')),
  price int check (price between 1 and 1000000),
  start_price int check (start_price between 1 and 1000000),
  end_at timestamptz,
  status text not null default 'open' check (status in ('open','sold')),
  buyer uuid references auth.users(id) on delete set null,
  buyer_name text,
  bid_user uuid references auth.users(id) on delete set null,
  bid_name text,
  bid_amount int,
  nb int not null default 0,
  seller_paid boolean not null default false,
  buyer_got boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists tcg_market_recent on public.tcg_market (created_at desc);
alter table public.tcg_market enable row level security;

create policy "tout le monde lit le marché" on public.tcg_market for select using (true);
create policy "le joueur met ses cartes en vente" on public.tcg_market for insert with check (
  seller = auth.uid() and status = 'open' and buyer is null and bid_user is null and nb = 0
  and not seller_paid and not buyer_got and id not like 'daily-%'
  and ((mode = 'direct' and price is not null) or (mode = 'auction' and start_price is not null and end_at > now() and end_at < now() + interval '4 days'))
);
create policy "les admins retirent une annonce" on public.tcg_market for delete using (public.is_admin());

-- Acheter une carte à prix fixe
create or replace function public.tcg_mk_buy(p_id text, p_name text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  update tcg_market set buyer = auth.uid(), buyer_name = left(p_name, 80), status = 'sold'
   where id = p_id and mode = 'direct' and status = 'open' and buyer is null and seller is distinct from auth.uid();
  return found;
end $$;

-- Enchérir (offre minimum : départ, puis +5 % ; une offre dans la dernière minute prolonge d'une minute)
create or replace function public.tcg_mk_bid(p_id text, p_amount int, p_name text) returns boolean
language plpgsql security definer set search_path = public as $$
declare r tcg_market;
begin
  if auth.uid() is null then return false; end if;
  select * into r from tcg_market where id = p_id for update;
  if not found or r.mode <> 'auction' or r.status <> 'open' or now() >= r.end_at
     or r.seller is not distinct from auth.uid() or p_amount > 1000000 then return false; end if;
  if r.bid_amount is null then
    if p_amount < r.start_price then return false; end if;
  elsif p_amount < r.bid_amount + greatest(1, ceil(r.bid_amount * 0.05)) then return false;
  end if;
  update tcg_market set bid_user = auth.uid(), bid_name = left(p_name, 80), bid_amount = p_amount, nb = nb + 1,
    end_at = case when r.end_at - now() < interval '1 minute' then now() + interval '1 minute' else r.end_at end
   where id = p_id;
  return true;
end $$;

-- Retirer sa carte (tant que personne ne l'a achetée et qu'il n'y a pas d'offre)
create or replace function public.tcg_mk_cancel(p_id text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  delete from tcg_market where id = p_id and seller = auth.uid() and buyer is null and bid_user is null;
  return found;
end $$;

-- Encaisser (vendeur) ou récupérer la carte (acheteur) ; l'annonce disparaît quand les deux sont faits
create or replace function public.tcg_mk_done(p_id text) returns boolean
language plpgsql security definer set search_path = public as $$
declare r tcg_market;
begin
  select * into r from tcg_market where id = p_id for update;
  if not found then return false; end if;
  if r.seller = auth.uid() and not r.seller_paid and (r.buyer is not null or (r.mode = 'auction' and now() >= r.end_at and r.bid_user is not null)) then
    update tcg_market set seller_paid = true where id = p_id;
  elsif not r.buyer_got and auth.uid() = coalesce(r.buyer, case when r.mode = 'auction' and now() >= r.end_at then r.bid_user end) then
    update tcg_market set buyer_got = true where id = p_id;
  else return false; end if;
  delete from tcg_market where id = p_id and seller_paid and buyer_got;
  return true;
end $$;

-- Les 3 mythiques du jour (créées une seule fois par jour, fin à minuit heure de Paris)
create or replace function public.tcg_mk_daily(p_cards text[]) returns void
language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Europe/Paris')::date; i int;
begin
  if auth.uid() is null or coalesce(array_length(p_cards, 1), 0) <> 3 then return; end if;
  for i in 1..3 loop
    if char_length(p_cards[i]) between 3 and 200 then
      insert into tcg_market (id, card, seller, seller_name, mode, start_price, end_at, seller_paid)
      values ('daily-' || d || '-' || i, p_cards[i], null, 'ORG-Central', 'auction', 500,
              ((d + 1)::timestamp at time zone 'Europe/Paris'), true)
      on conflict (id) do nothing;
    end if;
  end loop;
  delete from tcg_market where id like 'daily-%' and bid_user is null and end_at < now() - interval '1 day';
end $$;

revoke all on function public.tcg_mk_buy(text, text), public.tcg_mk_bid(text, int, text), public.tcg_mk_cancel(text), public.tcg_mk_done(text), public.tcg_mk_daily(text[]) from public, anon;
grant execute on function public.tcg_mk_buy(text, text), public.tcg_mk_bid(text, int, text), public.tcg_mk_cancel(text), public.tcg_mk_done(text), public.tcg_mk_daily(text[]) to authenticated;

-- Tchat global
create table if not exists public.tcg_chat (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists tcg_chat_recent on public.tcg_chat (created_at desc);
alter table public.tcg_chat enable row level security;

create policy "tout le monde lit le tchat" on public.tcg_chat for select using (true);
create policy "le joueur écrit en son nom" on public.tcg_chat for insert with check (user_id = auth.uid());
create policy "le joueur ou un admin supprime" on public.tcg_chat for delete using (user_id = auth.uid() or public.is_admin());
