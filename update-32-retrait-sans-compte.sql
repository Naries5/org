-- ORG-Central — mise à jour 32 : demandes de retrait d'une fiche sans compte
-- À coller dans Supabase > SQL Editor > New query, puis "Run".
-- Ajoute UNE règle à la table des tickets : un visiteur non connecté peut envoyer une demande de retrait
-- (et rien d'autre : type « autre », marquée removal, statut ouvert, message de 1 500 caractères max).
-- Il ne peut ni lire, ni modifier, ni supprimer de tickets.

create policy "visiteur : demande de retrait d'une fiche" on public.tickets for insert to anon
with check (
  kind = 'autre' and status = 'open'
  and (data->>'removal') = 'true'
  and char_length(coalesce(data->>'message','')) <= 1500
);
