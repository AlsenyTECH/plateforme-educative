-- Le personnel administratif (surveillant, comptable, secretariat...) n'avait
-- pas de valeur profiles.role a lui : seuls admin/direction/professeur/eleve/
-- parent existaient. Necessaire pour le flux d'invitation de compte
-- (invite-account) qui va leur creer un vrai login.
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role = any (array['admin', 'direction', 'professeur', 'personnel', 'eleve', 'parent']));
