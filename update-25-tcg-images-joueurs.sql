-- ORG-Central — mise à jour 25 : un joueur peut changer l'image de SES cartes de participation
-- À coller dans Supabase > SQL Editor > New query, puis "Run". À lancer APRÈS update-24.
-- Ne touche à aucune table existante : ajoute seulement trois règles d'accès à public.tcg_art.
--
-- Une carte de participation a l'identifiant P:<id saison>:<id joueur>.
-- Le joueur connecté peut changer (ou remettre) l'image d'une carte P dont la fiche joueur est liée à son compte.
-- Les admins gardent la main sur toutes les cartes (règles de update-24).

create policy "le joueur ajoute l'image de ses participations" on public.tcg_art for insert with check (
  card like 'P:%' and exists (select 1 from public.players p where p.id = split_part(card, ':', 3) and p.data->>'ownerUid' = auth.uid()::text)
);
create policy "le joueur modifie l'image de ses participations" on public.tcg_art for update using (
  card like 'P:%' and exists (select 1 from public.players p where p.id = split_part(card, ':', 3) and p.data->>'ownerUid' = auth.uid()::text)
) with check (
  card like 'P:%' and exists (select 1 from public.players p where p.id = split_part(card, ':', 3) and p.data->>'ownerUid' = auth.uid()::text)
);
create policy "le joueur remet l'image de ses participations" on public.tcg_art for delete using (
  card like 'P:%' and exists (select 1 from public.players p where p.id = split_part(card, ':', 3) and p.data->>'ownerUid' = auth.uid()::text)
);
