-- Pole 09 (tutorat premium). Scope volontairement limite aux professeurs
-- d'une ecole proposant du tutorat a ses propres eleves (pas un marketplace
-- inter-ecoles pour ce MVP, meme si le cahier des charges evoque un revenu
-- B2C plus large - extension possible plus tard).

create table public.tutoring_offers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  tutor_profile_id uuid not null references public.profiles(id),
  subject_id uuid references public.subjects(id),
  bio text,
  hourly_rate numeric,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.tutoring_bookings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  offer_id uuid not null references public.tutoring_offers(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  requested_by uuid references public.profiles(id),
  scheduled_at timestamptz,
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

alter table public.tutoring_offers enable row level security;

create policy "tutoring_offers_select" on public.tutoring_offers
  for select using (school_id in (select app.accessible_school_ids(auth.uid())));

create policy "tutoring_offers_write_self_or_staff" on public.tutoring_offers
  for all
  using (
    tutor_profile_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = tutoring_offers.school_id and p.role in ('admin', 'direction'))
  )
  with check (
    tutor_profile_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = tutoring_offers.school_id and p.role in ('admin', 'direction'))
  );

alter table public.tutoring_bookings enable row level security;

create policy "tutoring_bookings_select" on public.tutoring_bookings
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = tutoring_bookings.school_id and p.role in ('admin', 'direction'))
    or exists (select 1 from public.tutoring_offers o where o.id = tutoring_bookings.offer_id and o.tutor_profile_id = auth.uid())
    or exists (select 1 from public.students s where s.id = tutoring_bookings.student_id and s.profile_id = auth.uid())
    or exists (select 1 from public.student_guardians g where g.student_id = tutoring_bookings.student_id and g.guardian_profile_id = auth.uid())
  );

create policy "tutoring_bookings_write" on public.tutoring_bookings
  for all
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = tutoring_bookings.school_id and p.role in ('admin', 'direction'))
    or exists (select 1 from public.tutoring_offers o where o.id = tutoring_bookings.offer_id and o.tutor_profile_id = auth.uid())
    or exists (select 1 from public.student_guardians g where g.student_id = tutoring_bookings.student_id and g.guardian_profile_id = auth.uid())
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = tutoring_bookings.school_id and p.role in ('admin', 'direction'))
    or exists (select 1 from public.tutoring_offers o where o.id = tutoring_bookings.offer_id and o.tutor_profile_id = auth.uid())
    or exists (select 1 from public.student_guardians g where g.student_id = tutoring_bookings.student_id and g.guardian_profile_id = auth.uid())
  );
