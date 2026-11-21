-- ORG-Central — mise à jour 30 : classement des albums complétés dans le TCG
-- À coller dans Supabase > SQL Editor > New query, puis "Run". Très rapide (ajoute une colonne).
-- Ne touche qu'à la table du TCG public.tcg_collections : ajoute le nombre d'albums complétés
-- (albums d'au moins 5 cartes) de chaque joueur, pour le classement « Albums ».

alter table public.tcg_collections add column if not exists albums int not null default 0;
