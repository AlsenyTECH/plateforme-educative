-- Decouple les entites "personne" des comptes de connexion, sur le modele
-- deja utilise pour students.profile_id : l'entite existe d'abord, le compte
-- (profiles) vient s'y greffer plus tard, optionnellement.
--
-- Ordre important : on ajoute d'abord les nouvelles tables/colonnes, on
-- reecrit ensuite toute fonction/policy qui referencait l'ancienne colonne,
-- et on ne supprime cette colonne qu'une fois plus rien ne la referencer -
-- jamais DROP COLUMN ... CASCADE, dont la portee reelle (policies sur
-- d'autres tables) est difficile a predire avec certitude.

create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  profile_id uuid references public.profiles(id),
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  photo_path text,
  created_at timestamptz not null default now()
);

create table public.teacher_subjects (
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  primary key (teacher_id, subject_id)
);

create table public.staff_members (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  profile_id uuid references public.profiles(id),
  first_name text not null,
  last_name text not null,
  position text not null,
  email text,
  phone text,
  photo_path text,
  created_at timestamptz not null default now()
);

create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  profile_id uuid references public.profiles(id),
  first_name text not null,
  last_name text not null,
  phone text not null,
  email text,
  profession text,
  created_at timestamptz not null default now()
);

alter table public.students
  add column status text not null default 'actif' check (status in ('actif', 'ancien_eleve', 'parti')),
  add column matricule text,
  add column gender text check (gender in ('M', 'F')),
  add column birth_place text,
  add column address text,
  add column photo_path text;

alter table public.students add constraint students_school_matricule_unique unique (school_id, matricule);

alter table public.admissions add column previous_school text;

create table public.school_counters (
  school_id uuid not null references public.schools(id) on delete cascade,
  counter_name text not null,
  current_value int not null default 0,
  primary key (school_id, counter_name)
);

alter table public.school_counters enable row level security;

create policy "school_counters_staff" on public.school_counters
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = school_counters.school_id and p.role in ('admin', 'direction')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = school_counters.school_id and p.role in ('admin', 'direction')));

create function public.next_sequence(p_school_id uuid, p_counter_name text)
returns int
language sql
set search_path = public
as $$
  insert into public.school_counters (school_id, counter_name, current_value)
  values (p_school_id, p_counter_name, 1)
  on conflict (school_id, counter_name)
  do update set current_value = school_counters.current_value + 1
  returning current_value;
$$;

-- Nouvelle colonne d'abord (table vide, on peut la rendre NOT NULL tout de
-- suite), l'ancienne colonne guardian_profile_id reste en place pour l'instant.
alter table public.student_guardians add column guardian_id uuid not null references public.guardians(id) on delete cascade;
alter table public.timetable_entries add column teacher_id uuid references public.teachers(id);

-- Reecrit tout ce qui referencait guardian_profile_id, AVANT de le supprimer.
create or replace function app.accessible_school_ids(uid uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select school_id from public.profiles where id = uid and school_id is not null
  union
  select s.school_id
  from public.students s
  join public.student_guardians sg on sg.student_id = s.id
  join public.guardians g on g.id = sg.guardian_id
  where g.profile_id = uid
$$;

alter policy "student_guardians_select_own" on public.student_guardians
  using (exists (select 1 from public.guardians g where g.id = student_guardians.guardian_id and g.profile_id = auth.uid()));

alter policy "grades_select" on public.grades
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = grades.school_id and p.role in ('admin', 'direction', 'professeur'))
    or exists (select 1 from public.students s where s.id = grades.student_id and s.profile_id = auth.uid())
    or exists (select 1 from public.student_guardians sg join public.guardians g on g.id = sg.guardian_id where sg.student_id = grades.student_id and g.profile_id = auth.uid())
  );

alter policy "absences_select" on public.absences
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = absences.school_id and p.role in ('admin', 'direction', 'professeur'))
    or exists (select 1 from public.students s where s.id = absences.student_id and s.profile_id = auth.uid())
    or exists (select 1 from public.student_guardians sg join public.guardians g on g.id = sg.guardian_id where sg.student_id = absences.student_id and g.profile_id = auth.uid())
  );

alter policy "resource_progress_select" on public.resource_progress
  using (
    exists (select 1 from public.students s where s.id = resource_progress.student_id and s.profile_id = auth.uid())
    or exists (select 1 from public.student_guardians sg join public.guardians g on g.id = sg.guardian_id where sg.student_id = resource_progress.student_id and g.profile_id = auth.uid())
    or exists (
      select 1 from public.course_resources cr
      join public.courses c on c.id = cr.course_id
      join public.profiles p on p.school_id = c.school_id
      where cr.id = resource_progress.resource_id and p.id = auth.uid() and p.role in ('admin', 'direction', 'professeur')
    )
  );

alter policy "canteen_subscriptions_select" on public.canteen_subscriptions
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = canteen_subscriptions.school_id and p.role in ('admin', 'direction'))
    or exists (select 1 from public.students s where s.id = canteen_subscriptions.student_id and s.profile_id = auth.uid())
    or exists (select 1 from public.student_guardians sg join public.guardians g on g.id = sg.guardian_id where sg.student_id = canteen_subscriptions.student_id and g.profile_id = auth.uid())
  );

alter policy "transport_subscriptions_select" on public.transport_subscriptions
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = transport_subscriptions.school_id and p.role in ('admin', 'direction'))
    or exists (select 1 from public.students s where s.id = transport_subscriptions.student_id and s.profile_id = auth.uid())
    or exists (select 1 from public.student_guardians sg join public.guardians g on g.id = sg.guardian_id where sg.student_id = transport_subscriptions.student_id and g.profile_id = auth.uid())
  );

alter policy "library_loans_select" on public.library_loans
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = library_loans.school_id and p.role in ('admin', 'direction'))
    or exists (select 1 from public.students s where s.id = library_loans.student_id and s.profile_id = auth.uid())
    or exists (select 1 from public.student_guardians sg join public.guardians g on g.id = sg.guardian_id where sg.student_id = library_loans.student_id and g.profile_id = auth.uid())
  );

alter policy "health_incidents_select" on public.health_incidents
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = health_incidents.school_id and p.role in ('admin', 'direction'))
    or exists (select 1 from public.students s where s.id = health_incidents.student_id and s.profile_id = auth.uid())
    or exists (select 1 from public.student_guardians sg join public.guardians g on g.id = sg.guardian_id where sg.student_id = health_incidents.student_id and g.profile_id = auth.uid())
  );

alter policy "tutoring_bookings_select" on public.tutoring_bookings
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = tutoring_bookings.school_id and p.role in ('admin', 'direction'))
    or exists (select 1 from public.tutoring_offers o where o.id = tutoring_bookings.offer_id and o.tutor_profile_id = auth.uid())
    or exists (select 1 from public.students s where s.id = tutoring_bookings.student_id and s.profile_id = auth.uid())
    or exists (select 1 from public.student_guardians sg join public.guardians g on g.id = sg.guardian_id where sg.student_id = tutoring_bookings.student_id and g.profile_id = auth.uid())
  );

alter policy "tutoring_bookings_write" on public.tutoring_bookings
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = tutoring_bookings.school_id and p.role in ('admin', 'direction'))
    or exists (select 1 from public.tutoring_offers o where o.id = tutoring_bookings.offer_id and o.tutor_profile_id = auth.uid())
    or exists (select 1 from public.student_guardians sg join public.guardians g on g.id = sg.guardian_id where sg.student_id = tutoring_bookings.student_id and g.profile_id = auth.uid())
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = tutoring_bookings.school_id and p.role in ('admin', 'direction'))
    or exists (select 1 from public.tutoring_offers o where o.id = tutoring_bookings.offer_id and o.tutor_profile_id = auth.uid())
    or exists (select 1 from public.student_guardians sg join public.guardians g on g.id = sg.guardian_id where sg.student_id = tutoring_bookings.student_id and g.profile_id = auth.uid())
  );

-- Plus rien ne reference guardian_profile_id / teacher_profile_id : suppression sure.
alter table public.student_guardians drop column guardian_profile_id;
alter table public.timetable_entries drop column teacher_profile_id;

alter table public.student_guardians add unique (student_id, guardian_id);
alter table public.timetable_entries add unique (teacher_id, day_of_week, start_time);

-- RLS des nouvelles tables
alter table public.teachers enable row level security;
create policy "teachers_select" on public.teachers
  for select using (school_id in (select app.accessible_school_ids(auth.uid())));
create policy "teachers_write_staff" on public.teachers
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = teachers.school_id and p.role in ('admin', 'direction')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = teachers.school_id and p.role in ('admin', 'direction')));

alter table public.teacher_subjects enable row level security;
create policy "teacher_subjects_select" on public.teacher_subjects
  for select using (exists (select 1 from public.teachers t where t.id = teacher_subjects.teacher_id and t.school_id in (select app.accessible_school_ids(auth.uid()))));
create policy "teacher_subjects_write_staff" on public.teacher_subjects
  for all
  using (exists (select 1 from public.teachers t join public.profiles p on p.school_id = t.school_id where t.id = teacher_subjects.teacher_id and p.id = auth.uid() and p.role in ('admin', 'direction')))
  with check (exists (select 1 from public.teachers t join public.profiles p on p.school_id = t.school_id where t.id = teacher_subjects.teacher_id and p.id = auth.uid() and p.role in ('admin', 'direction')));

alter table public.staff_members enable row level security;
create policy "staff_members_select" on public.staff_members
  for select using (school_id in (select app.accessible_school_ids(auth.uid())));
create policy "staff_members_write_staff" on public.staff_members
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = staff_members.school_id and p.role in ('admin', 'direction')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = staff_members.school_id and p.role in ('admin', 'direction')));

alter table public.guardians enable row level security;
create policy "guardians_select" on public.guardians
  for select using (
    profile_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = guardians.school_id and p.role in ('admin', 'direction'))
  );
create policy "guardians_write_staff" on public.guardians
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = guardians.school_id and p.role in ('admin', 'direction')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = guardians.school_id and p.role in ('admin', 'direction')));
