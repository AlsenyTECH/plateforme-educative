-- Pole 03 (academique) : matieres, notes, absences.
-- L'emploi du temps (generation hybride) et le portail eleve/parent dedie
-- sont volontairement laisses pour un chantier separe.

-- ---------------------------------------------------------------------------
-- Matieres
-- ---------------------------------------------------------------------------
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

alter table public.subjects enable row level security;

create policy "subjects_select" on public.subjects
  for select using (school_id in (select app.accessible_school_ids(auth.uid())));

create policy "subjects_write_staff" on public.subjects
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.school_id = subjects.school_id
        and p.role in ('admin', 'direction')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.school_id = subjects.school_id
        and p.role in ('admin', 'direction')
    )
  );

-- ---------------------------------------------------------------------------
-- Notes
-- ---------------------------------------------------------------------------
create table public.grades (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  teacher_profile_id uuid references public.profiles(id),
  label text not null,
  score numeric not null,
  max_score numeric not null default 20,
  graded_at date not null default current_date,
  created_at timestamptz not null default now()
);

comment on table public.grades is
  'Notes sensibles par eleve : la lecture est restreinte au staff de son '
  'ecole, a l eleve lui-meme et a ses tuteurs (student_guardians) - pas a '
  'accessible_school_ids seul, qui donnerait a un parent la visibilite sur '
  'toute l ecole au lieu de son seul enfant.';

alter table public.grades enable row level security;

create policy "grades_select" on public.grades
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.school_id = grades.school_id
        and p.role in ('admin', 'direction', 'professeur')
    )
    or exists (
      select 1 from public.students s
      where s.id = grades.student_id and s.profile_id = auth.uid()
    )
    or exists (
      select 1 from public.student_guardians g
      where g.student_id = grades.student_id and g.guardian_profile_id = auth.uid()
    )
  );

create policy "grades_write_staff" on public.grades
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.school_id = grades.school_id
        and p.role in ('admin', 'direction', 'professeur')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.school_id = grades.school_id
        and p.role in ('admin', 'direction', 'professeur')
    )
  );

-- ---------------------------------------------------------------------------
-- Absences (granularite jour ; le detail par creneau viendra avec l emploi
-- du temps)
-- ---------------------------------------------------------------------------
create table public.absences (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  date date not null,
  status text not null default 'absent' check (status in ('absent', 'retard', 'excusee')),
  reported_by uuid references public.profiles(id),
  note text,
  created_at timestamptz not null default now(),
  unique (student_id, date)
);

alter table public.absences enable row level security;

create policy "absences_select" on public.absences
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.school_id = absences.school_id
        and p.role in ('admin', 'direction', 'professeur')
    )
    or exists (
      select 1 from public.students s
      where s.id = absences.student_id and s.profile_id = auth.uid()
    )
    or exists (
      select 1 from public.student_guardians g
      where g.student_id = absences.student_id and g.guardian_profile_id = auth.uid()
    )
  );

create policy "absences_write_staff" on public.absences
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.school_id = absences.school_id
        and p.role in ('admin', 'direction', 'professeur')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.school_id = absences.school_id
        and p.role in ('admin', 'direction', 'professeur')
    )
  );
