-- ORG-Central : casting secret réservé aux vrais hosts de l'ORG
-- À coller dans Supabase > SQL Editor > New query, puis "Run".
--
-- Avant : "host de l'ORG" incluait automatiquement les admins du site, qui voyaient donc tous les castings secrets.
-- Maintenant : seuls les comptes ajoutés comme hosts de l'ORG (table org_hosts) et les comptes qu'ils ont acceptés
-- peuvent voir ou modifier un casting secret. Un admin qui n'est pas host de l'ORG ne voit que le compteur public.

create or replace function public.is_real_host_of(o text) returns boolean language sql stable security definer set search_path = public as
$$ select exists(select 1 from org_hosts where org_id = o and user_id = auth.uid()) $$;

create or replace function public.can_see_secret_cast(s text) returns boolean language sql stable security definer set search_path = public as
$$ select is_real_host_of(season_org(s)) or exists(select 1 from cast_viewers where season_id = s and user_id = auth.uid() and status = 'accepted') $$;

drop policy if exists "host crée casting secret" on public.secret_casts;
drop policy if exists "host modifie casting secret" on public.secret_casts;
drop policy if exists "host supprime casting secret" on public.secret_casts;
create policy "host crée casting secret"     on public.secret_casts for insert with check (is_real_host_of(season_org(season_id)));
create policy "host modifie casting secret"  on public.secret_casts for update using (is_real_host_of(season_org(season_id))) with check (is_real_host_of(season_org(season_id)));
create policy "host supprime casting secret" on public.secret_casts for delete using (is_real_host_of(season_org(season_id)));

drop policy if exists "voir accès casting"    on public.cast_viewers;
drop policy if exists "ajouter accès casting" on public.cast_viewers;
drop policy if exists "traiter accès casting" on public.cast_viewers;
drop policy if exists "retirer accès casting" on public.cast_viewers;
create policy "voir accès casting"    on public.cast_viewers for select using (user_id = auth.uid() or is_real_host_of(season_org(season_id)));
create policy "ajouter accès casting" on public.cast_viewers for insert with check (
  is_real_host_of(season_org(season_id))
  or (user_id = auth.uid() and status = 'pending' and secret_requests_open(season_id)));
create policy "traiter accès casting" on public.cast_viewers for update using (is_real_host_of(season_org(season_id))) with check (is_real_host_of(season_org(season_id)));
create policy "retirer accès casting" on public.cast_viewers for delete using (user_id = auth.uid() or is_real_host_of(season_org(season_id)));
