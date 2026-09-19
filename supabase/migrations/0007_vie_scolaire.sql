-- Pole 05 (vie scolaire) : cantine, bibliotheque, infirmerie, transport
-- (sans geolocalisation live, qui necessite une cle API Mapbox - chantier
-- separe). health_incidents contient des donnees medicales : lecture staff
-- volontairement restreinte a admin/direction uniquement (pas professeur),
-- vu l'absence d'un role infirmier dedie dans le schema actuel.

create table public.canteen_subscriptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  formula text not null,
  start_date date not null,
  end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.library_books (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  title text not null,
  author text,
  isbn text,
  total_copies int not null default 1,
  created_at timestamptz not null default now()
);

create table public.library_loans (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  book_id uuid not null references public.library_books(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  borrowed_at date not null default current_date,
  due_at date,
  returned_at date,
  created_at timestamptz not null default now()
);

create table public.health_incidents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  description text not null,
  action_taken text,
  reported_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.bus_routes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.bus_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.bus_routes(id) on delete cascade,
  name text not null,
  order_index int not null default 0
);

create table public.transport_subscriptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  route_id uuid not null references public.bus_routes(id),
  stop_id uuid references public.bus_stops(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Reference partagee (pas de donnee personnelle) : visible par toute
-- personne rattachee a l'ecole, ecrite par le staff.
alter table public.library_books enable row level security;
create policy "library_books_select" on public.library_books
  for select using (school_id in (select app.accessible_school_ids(auth.uid())));
create policy "library_books_write_staff" on public.library_books
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = library_books.school_id and p.role in ('admin', 'direction')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = library_books.school_id and p.role in ('admin', 'direction')));

alter table public.bus_routes enable row level security;
create policy "bus_routes_select" on public.bus_routes
  for select using (school_id in (select app.accessible_school_ids(auth.uid())));
create policy "bus_routes_write_staff" on public.bus_routes
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = bus_routes.school_id and p.role in ('admin', 'direction')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = bus_routes.school_id and p.role in ('admin', 'direction')));

alter table public.bus_stops enable row level security;
create policy "bus_stops_select" on public.bus_stops
  for select using (
    exists (select 1 from public.bus_routes r where r.id = bus_stops.route_id and r.school_id in (select app.accessible_school_ids(auth.uid())))
  );
create policy "bus_stops_write_staff" on public.bus_stops
  for all
  using (
    exists (
      select 1 from public.bus_routes r
      join public.profiles p on p.school_id = r.school_id
      where r.id = bus_stops.route_id and p.id = auth.uid() and p.role in ('admin', 'direction')
    )
  )
  with check (
    exists (
      select 1 from public.bus_routes r
      join public.profiles p on p.school_id = r.school_id
      where r.id = bus_stops.route_id and p.id = auth.uid() and p.role in ('admin', 'direction')
    )
  );

-- Donnees per-eleve : staff + eleve lui-meme + ses tuteurs uniquement
-- (meme pattern que grades/absences, pas accessible_school_ids seul).
alter table public.canteen_subscriptions enable row level security;
create policy "canteen_subscriptions_select" on public.canteen_subscriptions
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = canteen_subscriptions.school_id and p.role in ('admin', 'direction'))
    or exists (select 1 from public.students s where s.id = canteen_subscriptions.student_id and s.profile_id = auth.uid())
    or exists (select 1 from public.student_guardians g where g.student_id = canteen_subscriptions.student_id and g.guardian_profile_id = auth.uid())
  );
create policy "canteen_subscriptions_write_staff" on public.canteen_subscriptions
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = canteen_subscriptions.school_id and p.role in ('admin', 'direction')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = canteen_subscriptions.school_id and p.role in ('admin', 'direction')));

alter table public.transport_subscriptions enable row level security;
create policy "transport_subscriptions_select" on public.transport_subscriptions
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = transport_subscriptions.school_id and p.role in ('admin', 'direction'))
    or exists (select 1 from public.students s where s.id = transport_subscriptions.student_id and s.profile_id = auth.uid())
    or exists (select 1 from public.student_guardians g where g.student_id = transport_subscriptions.student_id and g.guardian_profile_id = auth.uid())
  );
create policy "transport_subscriptions_write_staff" on public.transport_subscriptions
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = transport_subscriptions.school_id and p.role in ('admin', 'direction')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = transport_subscriptions.school_id and p.role in ('admin', 'direction')));

alter table public.library_loans enable row level security;
create policy "library_loans_select" on public.library_loans
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = library_loans.school_id and p.role in ('admin', 'direction'))
    or exists (select 1 from public.students s where s.id = library_loans.student_id and s.profile_id = auth.uid())
    or exists (select 1 from public.student_guardians g where g.student_id = library_loans.student_id and g.guardian_profile_id = auth.uid())
  );
create policy "library_loans_write_staff" on public.library_loans
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = library_loans.school_id and p.role in ('admin', 'direction')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = library_loans.school_id and p.role in ('admin', 'direction')));

-- Medical : lecture restreinte a admin/direction (pas professeur).
alter table public.health_incidents enable row level security;
create policy "health_incidents_select" on public.health_incidents
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = health_incidents.school_id and p.role in ('admin', 'direction'))
    or exists (select 1 from public.students s where s.id = health_incidents.student_id and s.profile_id = auth.uid())
    or exists (select 1 from public.student_guardians g where g.student_id = health_incidents.student_id and g.guardian_profile_id = auth.uid())
  );
create policy "health_incidents_write_staff" on public.health_incidents
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = health_incidents.school_id and p.role in ('admin', 'direction')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = health_incidents.school_id and p.role in ('admin', 'direction')));
