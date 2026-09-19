-- Pole 03 (fin) : emploi du temps manuel. La generation hybride
-- automatique+manuelle reste un chantier a part (complexite d'optimisation
-- combinatoire) ; ici, deux contraintes unique detectent au moins les
-- doubles reservations evidentes (meme classe ou meme prof, meme creneau).

create table public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  teacher_profile_id uuid references public.profiles(id),
  day_of_week smallint not null check (day_of_week between 1 and 7),
  start_time time not null,
  end_time time not null,
  room text,
  created_at timestamptz not null default now(),
  check (end_time > start_time),
  unique (class_id, day_of_week, start_time),
  unique (teacher_profile_id, day_of_week, start_time)
);

alter table public.timetable_entries enable row level security;

create policy "timetable_select" on public.timetable_entries
  for select using (school_id in (select app.accessible_school_ids(auth.uid())));

create policy "timetable_write_staff" on public.timetable_entries
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.school_id = timetable_entries.school_id
        and p.role in ('admin', 'direction')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.school_id = timetable_entries.school_id
        and p.role in ('admin', 'direction')
    )
  );
