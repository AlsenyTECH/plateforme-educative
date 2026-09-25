-- Deux corrections demandees sur les services :
-- 1) certains services ont, en plus de leur tarif recurrent, des frais
--    d'inscription (paiement unique a la premiere souscription).
-- 2) la categorie ne doit pas se limiter a cantine/transport : elle sert
--    a organiser l'affichage, cantine/transport restent juste les deux
--    valeurs reconnues pour le lien avec canteen_subscriptions/
--    transport_subscriptions, tout le reste est du texte libre.
alter table public.services
  drop constraint services_category_check;

alter table public.services
  add column registration_fee numeric check (registration_fee is null or registration_fee >= 0);
