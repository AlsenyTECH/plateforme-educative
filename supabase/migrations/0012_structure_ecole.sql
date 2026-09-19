-- Pole 03 (suite) : parametrage admin decrit par l'utilisateur - logo/infos
-- legales de l'ecole, coefficients par matiere et par niveau, parametres
-- financiers (config uniquement, aucun traitement de paiement donc aucune
-- dependance Mobile Money), inscriptions separees de l'entite eleve,
-- disponibilites et affectations des profs (prealable a l'emploi du temps,
-- qui reste manuel).

alter table public.schools
  add column logo_path text,
  add column legal_name text,
  add column legal_registration_number text;

create table public.subject_coefficients (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  level text not null,
  coefficient numeric not null default 1,
  unique (school_id, subject_id, level)
);

create table public.fee_structures (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  level text not null,
  fee_type text not null check (fee_type in ('inscription', 'mensualite', 'cantine', 'transport')),
  amount numeric not null,
  unique (school_id, level, fee_type)
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  academic_year text not null,
  enrolled_at date not null default current_date,
  status text not null default 'active' check (status in ('active', 'completed', 'withdrawn')),
  unique (student_id, academic_year)
);

-- Remplace par enrollments : aucune policy ne referencait class_id, retrait
-- direct sans risque de cascade.
alter table public.students drop column class_id;

create table public.teacher_availability (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);

create table public.teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  unique (teacher_id, class_id, subject_id)
);

alter table public.subject_coefficients enable row level security;
create policy "subject_coefficients_select" on public.subject_coefficients
  for select using (school_id in (select app.accessible_school_ids(auth.uid())));
create policy "subject_coefficients_write_staff" on public.subject_coefficients
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = subject_coefficients.school_id and p.role in ('admin', 'direction')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = subject_coefficients.school_id and p.role in ('admin', 'direction')));

alter table public.fee_structures enable row level security;
create policy "fee_structures_select" on public.fee_structures
  for select using (school_id in (select app.accessible_school_ids(auth.uid())));
create policy "fee_structures_write_staff" on public.fee_structures
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = fee_structures.school_id and p.role in ('admin', 'direction')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = fee_structures.school_id and p.role in ('admin', 'direction')));

alter table public.enrollments enable row level security;
create policy "enrollments_select" on public.enrollments
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = enrollments.school_id and p.role in ('admin', 'direction', 'professeur'))
    or exists (select 1 from public.students s where s.id = enrollments.student_id and s.profile_id = auth.uid())
    or exists (select 1 from public.student_guardians sg join public.guardians g on g.id = sg.guardian_id where sg.student_id = enrollments.student_id and g.profile_id = auth.uid())
  );
create policy "enrollments_write_staff" on public.enrollments
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = enrollments.school_id and p.role in ('admin', 'direction')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = enrollments.school_id and p.role in ('admin', 'direction')));

alter table public.teacher_availability enable row level security;
create policy "teacher_availability_select" on public.teacher_availability
  for select using (exists (select 1 from public.teachers t where t.id = teacher_availability.teacher_id and t.school_id in (select app.accessible_school_ids(auth.uid()))));
create policy "teacher_availability_write" on public.teacher_availability
  for all
  using (
    exists (select 1 from public.teachers t where t.id = teacher_availability.teacher_id and t.profile_id = auth.uid())
    or exists (select 1 from public.teachers t join public.profiles p on p.school_id = t.school_id where t.id = teacher_availability.teacher_id and p.id = auth.uid() and p.role in ('admin', 'direction'))
  )
  with check (
    exists (select 1 from public.teachers t where t.id = teacher_availability.teacher_id and t.profile_id = auth.uid())
    or exists (select 1 from public.teachers t join public.profiles p on p.school_id = t.school_id where t.id = teacher_availability.teacher_id and p.id = auth.uid() and p.role in ('admin', 'direction'))
  );

alter table public.teacher_assignments enable row level security;
create policy "teacher_assignments_select" on public.teacher_assignments
  for select using (exists (select 1 from public.teachers t where t.id = teacher_assignments.teacher_id and t.school_id in (select app.accessible_school_ids(auth.uid()))));
create policy "teacher_assignments_write_staff" on public.teacher_assignments
  for all
  using (exists (select 1 from public.teachers t join public.profiles p on p.school_id = t.school_id where t.id = teacher_assignments.teacher_id and p.id = auth.uid() and p.role in ('admin', 'direction')))
  with check (exists (select 1 from public.teachers t join public.profiles p on p.school_id = t.school_id where t.id = teacher_assignments.teacher_id and p.id = auth.uid() and p.role in ('admin', 'direction')));
