-- ORG-Central — mise à jour 31 : effacement automatique des traces de visite (confidentialité)
-- À coller dans Supabase > SQL Editor > New query, puis "Run". De préférence quand le site est calme.
-- Ne touche à aucune fiche, saison, compte ni message : efface seulement les traces de présence
-- (« qui est en ligne ») et les clics vers les liens extérieurs de plus de 30 jours.

-- 1) Nettoyage immédiat
delete from public.link_clicks where at < now() - interval '30 days';
delete from public.visitors  where at < now() - interval '30 days';
delete from public.last_seen where at < now() - interval '30 days';

-- 2) Nettoyage automatique chaque nuit à 4 h (heure UTC), grâce à l'extension pg_cron de Supabase
create extension if not exists pg_cron with schema extensions;
select cron.unschedule('oc-nettoyage-traces') where exists (select 1 from cron.job where jobname = 'oc-nettoyage-traces');
select cron.schedule('oc-nettoyage-traces', '0 4 * * *', $$
  delete from public.link_clicks where at < now() - interval '30 days';
  delete from public.visitors  where at < now() - interval '30 days';
  delete from public.last_seen where at < now() - interval '30 days';
$$);
