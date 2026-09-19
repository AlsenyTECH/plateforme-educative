-- Pole 04 (pedagogique / e-learning) : cours, ressources multi-format,
-- progression. `content` sur course_resources est une URL ou du texte brut
-- pour ce MVP (lien externe type YouTube/Drive) ; l'upload direct vers
-- Supabase Storage est un chantier separe (formulaire multi-part, bucket,
-- policies dediees).  Le moteur de quiz note (correction auto QCM) est
-- egalement laisse pour plus tard : `type = 'quiz'` existe comme emplacement
-- reserve, sans logique de notation pour l'instant.

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  subject_id uuid references public.subjects(id),
  title text not null,
  description text,
  is_published boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.course_resources (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  type text not null check (type in ('video', 'pdf', 'image', 'audio', 'text', 'link', 'quiz')),
  title text not null,
  content text,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create table public.resource_progress (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.course_resources(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (resource_id, student_id)
);

alter table public.courses enable row level security;

create policy "courses_select" on public.courses
  for select using (
    (is_published and school_id in (select app.accessible_school_ids(auth.uid())))
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.school_id = courses.school_id
        and p.role in ('admin', 'direction', 'professeur')
    )
  );

create policy "courses_write_staff" on public.courses
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.school_id = courses.school_id
        and p.role in ('admin', 'direction', 'professeur')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.school_id = courses.school_id
        and p.role in ('admin', 'direction', 'professeur')
    )
  );

alter table public.course_resources enable row level security;

create policy "course_resources_select" on public.course_resources
  for select using (
    exists (
      select 1 from public.courses c
      where c.id = course_resources.course_id
        and (
          (c.is_published and c.school_id in (select app.accessible_school_ids(auth.uid())))
          or exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.school_id = c.school_id
              and p.role in ('admin', 'direction', 'professeur')
          )
        )
    )
  );

create policy "course_resources_write_staff" on public.course_resources
  for all
  using (
    exists (
      select 1 from public.courses c
      join public.profiles p on p.school_id = c.school_id
      where c.id = course_resources.course_id and p.id = auth.uid()
        and p.role in ('admin', 'direction', 'professeur')
    )
  )
  with check (
    exists (
      select 1 from public.courses c
      join public.profiles p on p.school_id = c.school_id
      where c.id = course_resources.course_id and p.id = auth.uid()
        and p.role in ('admin', 'direction', 'professeur')
    )
  );

alter table public.resource_progress enable row level security;

create policy "resource_progress_select" on public.resource_progress
  for select using (
    exists (select 1 from public.students s where s.id = resource_progress.student_id and s.profile_id = auth.uid())
    or exists (
      select 1 from public.student_guardians g
      where g.student_id = resource_progress.student_id and g.guardian_profile_id = auth.uid()
    )
    or exists (
      select 1 from public.course_resources cr
      join public.courses c on c.id = cr.course_id
      join public.profiles p on p.school_id = c.school_id
      where cr.id = resource_progress.resource_id and p.id = auth.uid()
        and p.role in ('admin', 'direction', 'professeur')
    )
  );

create policy "resource_progress_write_self" on public.resource_progress
  for all
  using (exists (select 1 from public.students s where s.id = resource_progress.student_id and s.profile_id = auth.uid()))
  with check (exists (select 1 from public.students s where s.id = resource_progress.student_id and s.profile_id = auth.uid()));
