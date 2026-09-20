-- Remplace le controle par role fige (admin/direction ont un acces identique)
-- par des permissions individuelles par compte, pour les fonctionnalites
-- sensibles. Seul le compte 'admin' garde un acces total cable en dur.
-- Cf. spec-permissions-individuelles.md. Priorite MVP : notes (grades) et
-- finances (fee_structures) uniquement ; les autres tables gardent leurs
-- policies actuelles pour l'instant, a etendre plus tard sans les reecrire.

create table public.functionalities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  pole text not null
);

comment on table public.functionalities is
  'Referentiel fixe defini par la plateforme (pas par l''admin). Catalogue des fonctionnalites pouvant etre accordees individuellement a un compte.';

insert into public.functionalities (name, pole) values
  ('grades', 'academic'),
  ('finances', 'finance'),
  ('wallet', 'finance'),
  ('timetable', 'academic'),
  ('student_records', 'administrative'),
  ('attendance', 'school_life'),
  ('enrollments', 'administrative'),
  ('school_configuration', 'configuration');

alter table public.functionalities enable row level security;

create policy functionalities_select_authenticated
  on public.functionalities for select
  to authenticated
  using (true);

-- Pas de policy insert/update/delete : catalogue modifiable uniquement via
-- migration / service_role, meme verrouillage que school_signing_keys.

create table public.user_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  functionality_id uuid not null references public.functionalities(id) on delete cascade,
  can_read boolean not null default false,
  can_write boolean not null default false,
  unique (user_id, functionality_id)
);

comment on table public.user_permissions is
  'Permissions propres a un compte precis (pas a un role generique). Le champ profiles.role reste une etiquette d''affichage / modele de pre-remplissage, sans pouvoir decisionnel ici.';

create index user_permissions_functionality_id_idx on public.user_permissions (functionality_id);

alter table public.user_permissions enable row level security;

create policy user_permissions_select
  on public.user_permissions for select
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.profiles admin_p
      join public.profiles target_p on target_p.id = user_permissions.user_id
      where admin_p.id = auth.uid()
        and admin_p.role = 'admin'
        and admin_p.school_id = target_p.school_id
    )
  );

-- Ecriture volontairement reservee au role 'admin' en dur (pas via
-- has_permission) : la spec ne mentionne que "l'admin" comme acteur capable
-- de definir des permissions, jamais un compte disposant d'une permission
-- donnee. Gater cette table par has_permission() ouvrirait un chemin
-- d'escalade (un compte avec une permission de gestion pourrait s'en
-- accorder d'autres) que le MVP evite en ne le construisant simplement pas.
create policy user_permissions_write_admin
  on public.user_permissions for all
  using (
    exists (
      select 1
      from public.profiles admin_p
      join public.profiles target_p on target_p.id = user_permissions.user_id
      where admin_p.id = auth.uid()
        and admin_p.role = 'admin'
        and admin_p.school_id = target_p.school_id
    )
  )
  with check (
    exists (
      select 1
      from public.profiles admin_p
      join public.profiles target_p on target_p.id = user_permissions.user_id
      where admin_p.id = auth.uid()
        and admin_p.role = 'admin'
        and admin_p.school_id = target_p.school_id
    )
  );

create function app.has_permission(p_user_id uuid, p_functionality text, p_action text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (select 1 from public.profiles p where p.id = p_user_id and p.role = 'admin')
    or exists (
      select 1
      from public.user_permissions up
      join public.functionalities f on f.id = up.functionality_id
      where up.user_id = p_user_id
        and f.name = p_functionality
        and (
          (p_action = 'read' and up.can_read)
          or (p_action = 'write' and up.can_write)
        )
    );
$$;

comment on function app.has_permission is
  'Verifie si p_user_id a la permission p_action (''read''|''write'') sur la fonctionnalite p_functionality. Le compte admin contourne toujours cette verification (acces total cable en dur, non represente dans user_permissions).';

-- Backfill : les comptes professeur/direction deja existants ne doivent pas
-- perdre l''acces qu''ils avaient sous l''ancien modele base sur le role.
insert into public.user_permissions (user_id, functionality_id, can_read, can_write)
select p.id, f.id, true, true
from public.profiles p
cross join public.functionalities f
where p.role = 'professeur' and f.name = 'grades'
on conflict (user_id, functionality_id) do nothing;

-- Direction n'a plus d'acces total automatique, mais son modele par defaut
-- reste large (tout sauf school_configuration, reservee a l'admin) pour
-- qu'un compte Direction fraichement cree ne se retrouve pas sans aucun
-- droit avant que l'admin n'ait ajuste les cases (spec section 4).
insert into public.user_permissions (user_id, functionality_id, can_read, can_write)
select p.id, f.id, true, true
from public.profiles p
cross join public.functionalities f
where p.role = 'direction' and f.name <> 'school_configuration'
on conflict (user_id, functionality_id) do nothing;

-- Reecriture des policies grades / fee_structures pour utiliser
-- has_permission() a la place du role code en dur (les branches
-- eleve/tuteur de grades_select, orthogonales au systeme de permissions
-- du personnel, restent inchangees).
alter policy grades_select on public.grades
  using (
    app.has_permission(auth.uid(), 'grades', 'read')
    or exists (
      select 1 from public.students s
      where s.id = grades.student_id and s.profile_id = auth.uid()
    )
    or exists (
      select 1
      from public.student_guardians sg
      join public.guardians g on g.id = sg.guardian_id
      where sg.student_id = grades.student_id and g.profile_id = auth.uid()
    )
  );

alter policy grades_write_staff on public.grades
  using (app.has_permission(auth.uid(), 'grades', 'write'))
  with check (app.has_permission(auth.uid(), 'grades', 'write'));

alter policy fee_structures_write_staff on public.fee_structures
  using (app.has_permission(auth.uid(), 'finances', 'write'))
  with check (app.has_permission(auth.uid(), 'finances', 'write'));
