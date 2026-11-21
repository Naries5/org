-- ORG-Central — mise à jour 23 : remise à zéro des raretés du TCG changées à la main
-- À coller dans Supabase > SQL Editor > New query, puis "Run".
-- Supprime les raretés fixées à la main avant le nouveau calcul (v4, 21 novembre 2026).
-- Le jeu les ignore déjà ; ceci nettoie seulement la table. Les réglages faits après restent.
delete from public.tcg_rarity where updated_at < '2026-11-21T09:15:00Z';
