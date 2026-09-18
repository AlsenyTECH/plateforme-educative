-- Coeur multi-tenant : ecoles, comptes/roles (pole 02), eleves, liens parents, classes.
-- Toutes les tables metier portent school_id ; l'isolation est appliquee par RLS,
-- pas seulement par le code applicatif (cf. pole 11 du cahier des charges).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Ecoles (tenants)
-- ---------------------------------------------------------------------------
create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan text not null default 'standard' check (plan in ('standard', 'professionnel', 'enterprise')),
  status text not null default 'trial' check (status in ('trial', 'active', 'suspended')),
  created_at timestamptz not null default now()
);

comment on table public.schools is 'Un tenant = un etablissement client (pole 12 pour plan/status).';

-- ---------------------------------------------------------------------------
-- Profils (etend auth.users) : role + ecole de rattachement pour le staff
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid references public.schools(id),
  role text not null check (role in ('admin', 'direction', 'professeur', 'eleve', 'parent')),
  first_name text not null,
  last_name text not null,
  phone text,
  created_at timestamptz not null default now(),
  constraint school_required_unless_parent check (role = 'parent' or school_id is not null)
);

comment on table public.profiles is
  'school_id obligatoire pour admin/direction/professeur/eleve (une seule ecole). '
  'Laisse a NULL pour un parent : son acces reel se derive de student_guardians, '
  'car ses enfants peuvent etre inscrits dans des ecoles differentes.';

-- ---------------------------------------------------------------------------
-- Classes
-- ---------------------------------------------------------------------------
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  level text not null,
  academic_year text not null,
  created_at timestamptz not null default now(),
  unique (school_id, name, academic_year)
);

-- ---------------------------------------------------------------------------
-- Eleves : entite canonique, independante d'un compte de connexion
-- (un jeune eleve n'a pas forcement de profil/login des le depart)
-- ---------------------------------------------------------------------------
create table public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  profile_id uuid references public.profiles(id),
  class_id uuid references public.classes(id),
  first_name text not null,
  last_name text not null,
  birth_date date,
  created_at timestamptz not null default now()
);

comment on table public.students is
  'profile_id reste NULL tant que l eleve n a pas son propre compte (cf. pole 02).';

-- ---------------------------------------------------------------------------
-- Liens parent <-> eleve (un parent peut avoir des enfants dans des ecoles differentes)
-- ---------------------------------------------------------------------------
create table public.student_guardians (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  guardian_profile_id uuid not null references public.profiles(id) on delete cascade,
  relationship text,
  created_at timestamptz not null default now(),
  unique (student_id, guardian_profile_id)
);

-- ---------------------------------------------------------------------------
-- Fonction RLS centrale : quelles ecoles cet utilisateur peut-il voir ?
-- Reutilisee par toutes les policies pour eviter de dupliquer la logique
-- d acces (un seul endroit a auditer).
-- ---------------------------------------------------------------------------
create schema if not exists app;

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
  join public.student_guardians g on g.student_id = s.id
  where g.guardian_profile_id = uid
$$;

comment on function app.accessible_school_ids is
  'Union des ecoles ou uid est staff/eleve directement rattache, et des ecoles '
  'des enfants dont uid est le tuteur. Point unique de verite pour les policies RLS.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.student_guardians enable row level security;

create policy "schools_select" on public.schools
  for select using (id in (select app.accessible_school_ids(auth.uid())));

create policy "profiles_select_self" on public.profiles
  for select using (id = auth.uid());

create policy "profiles_select_same_school" on public.profiles
  for select using (school_id in (select app.accessible_school_ids(auth.uid())));

create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

create policy "classes_select" on public.classes
  for select using (school_id in (select app.accessible_school_ids(auth.uid())));

create policy "classes_write_staff" on public.classes
  for all
  using (
    school_id in (
      select p.school_id from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'direction')
    )
  )
  with check (
    school_id in (
      select p.school_id from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'direction')
    )
  );

create policy "students_select" on public.students
  for select using (school_id in (select app.accessible_school_ids(auth.uid())));

create policy "students_write_staff" on public.students
  for all
  using (
    school_id in (
      select p.school_id from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'direction')
    )
  )
  with check (
    school_id in (
      select p.school_id from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'direction')
    )
  );

create policy "student_guardians_select_own" on public.student_guardians
  for select using (guardian_profile_id = auth.uid());

create policy "student_guardians_select_staff" on public.student_guardians
  for select using (
    student_id in (
      select st.id from public.students st
      where st.school_id in (
        select p.school_id from public.profiles p
        where p.id = auth.uid() and p.role in ('admin', 'direction', 'professeur')
      )
    )
  );

create policy "student_guardians_write_staff" on public.student_guardians
  for all
  using (
    student_id in (
      select st.id from public.students st
      where st.school_id in (
        select p.school_id from public.profiles p
        where p.id = auth.uid() and p.role in ('admin', 'direction')
      )
    )
  )
  with check (
    student_id in (
      select st.id from public.students st
      where st.school_id in (
        select p.school_id from public.profiles p
        where p.id = auth.uid() and p.role in ('admin', 'direction')
      )
    )
  );
