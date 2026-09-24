-- Quantum horaire hebdomadaire (optionnel) pour chaque matiere d'un niveau,
-- dans le cadre de la reorganisation de la configuration autour du niveau
-- (matieres+coefficients+classes+frais d'un niveau regroupes sur une seule page).
alter table public.subject_coefficients
  add column weekly_hours numeric;

alter table public.subject_coefficients
  add constraint subject_coefficients_weekly_hours_check
  check (weekly_hours is null or weekly_hours > 0);
