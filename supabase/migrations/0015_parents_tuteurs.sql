-- Separe Parent (donnee d'identite, peut n'avoir aucun acces) de Tuteur/
-- guardian (celui qui recoit les notifications, deja modelise). Un tuteur
-- peut EtRE un parent (guardians.parent_source_id), un tuteur legal non-
-- parent, ou deja exister (fratrie). Ajoute aussi les champs d'inscription
-- reels demandes et separe le suivi medical du dossier scolaire principal.

alter table public.students
  add column nationality text,
  add column national_id_number text,
  add column niveau_vise text,
  add column previous_school text;

create table public.parents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  type text not null check (type in ('pere', 'mere')),
  first_name text,
  last_name text,
  phone text,
  address text,
  email text,
  profession text,
  status text not null default 'disponible' check (status in ('disponible', 'decede', 'absent')),
  created_at timestamptz not null default now(),
  unique (student_id, type)
);

alter table public.guardians add column parent_source_id uuid references public.parents(id);

alter table public.student_guardians
  add column role text not null default 'responsable_principal' check (role in ('responsable_principal', 'contact_secondaire'));

-- Info medicale standing : hors du dossier scolaire principal (students),
-- meme restriction d'acces que health_incidents (admin/direction + eleve
-- + tuteur, pas professeur).
create table public.student_medical_profiles (
  student_id uuid primary key references public.students(id) on delete cascade,
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.student_medical_profiles enable row level security;
create policy "student_medical_profiles_select" on public.student_medical_profiles
  for select using (
    exists (
      select 1 from public.students s
      join public.profiles p on p.school_id = s.school_id
      where s.id = student_medical_profiles.student_id and p.id = auth.uid() and p.role in ('admin', 'direction')
    )
    or exists (select 1 from public.students s where s.id = student_medical_profiles.student_id and s.profile_id = auth.uid())
    or exists (select 1 from public.student_guardians sg join public.guardians g on g.id = sg.guardian_id where sg.student_id = student_medical_profiles.student_id and g.profile_id = auth.uid())
  );
create policy "student_medical_profiles_write_staff" on public.student_medical_profiles
  for all
  using (
    exists (
      select 1 from public.students s
      join public.profiles p on p.school_id = s.school_id
      where s.id = student_medical_profiles.student_id and p.id = auth.uid() and p.role in ('admin', 'direction')
    )
  )
  with check (
    exists (
      select 1 from public.students s
      join public.profiles p on p.school_id = s.school_id
      where s.id = student_medical_profiles.student_id and p.id = auth.uid() and p.role in ('admin', 'direction')
    )
  );

alter table public.parents enable row level security;
create policy "parents_select" on public.parents
  for select using (
    exists (
      select 1 from public.students s
      join public.profiles p on p.school_id = s.school_id
      where s.id = parents.student_id and p.id = auth.uid() and p.role in ('admin', 'direction')
    )
    or exists (select 1 from public.students s where s.id = parents.student_id and s.profile_id = auth.uid())
    or exists (select 1 from public.student_guardians sg join public.guardians g on g.id = sg.guardian_id where sg.student_id = parents.student_id and g.profile_id = auth.uid())
  );
create policy "parents_write_staff" on public.parents
  for all
  using (
    exists (
      select 1 from public.students s
      join public.profiles p on p.school_id = s.school_id
      where s.id = parents.student_id and p.id = auth.uid() and p.role in ('admin', 'direction')
    )
  )
  with check (
    exists (
      select 1 from public.students s
      join public.profiles p on p.school_id = s.school_id
      where s.id = parents.student_id and p.id = auth.uid() and p.role in ('admin', 'direction')
    )
  );

-- Remplace l'ancienne create_student (creait class_id/enrollment immediatement
-- et geraiit un seul tuteur) : signature differente, on retire l'ancienne
-- explicitement avant de recreer, Postgres ne "replace" pas une fonction
-- dont la signature change.
drop function if exists public.create_student(uuid, text, text, date, text, text, text, uuid, text, uuid, text, text, text, text);

create function public.create_student(
  p_school_id uuid,
  p_first_name text,
  p_last_name text,
  p_birth_date date,
  p_birth_place text,
  p_gender text,
  p_nationality text,
  p_address text,
  p_national_id_number text,
  p_niveau_vise text,
  p_previous_school text,
  p_pere_first_name text,
  p_pere_last_name text,
  p_pere_phone text,
  p_pere_address text,
  p_pere_email text,
  p_pere_profession text,
  p_pere_status text,
  p_mere_first_name text,
  p_mere_last_name text,
  p_mere_phone text,
  p_mere_address text,
  p_mere_email text,
  p_mere_profession text,
  p_mere_status text
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_student_id uuid;
  v_pere_id uuid;
  v_mere_id uuid;
  v_matricule int;
begin
  v_matricule := public.next_sequence(p_school_id, 'matricule');

  insert into public.students (
    school_id, first_name, last_name, birth_date, birth_place, gender,
    nationality, address, national_id_number, niveau_vise, previous_school, matricule
  )
  values (
    p_school_id, p_first_name, p_last_name, p_birth_date, p_birth_place, p_gender,
    p_nationality, p_address, p_national_id_number, p_niveau_vise, p_previous_school,
    lpad(v_matricule::text, 4, '0')
  )
  returning id into v_student_id;

  if p_pere_first_name is not null or p_pere_last_name is not null then
    insert into public.parents (student_id, type, first_name, last_name, phone, address, email, profession, status)
    values (v_student_id, 'pere', p_pere_first_name, p_pere_last_name, p_pere_phone, p_pere_address, p_pere_email, p_pere_profession, coalesce(p_pere_status, 'disponible'))
    returning id into v_pere_id;
  end if;

  if p_mere_first_name is not null or p_mere_last_name is not null then
    insert into public.parents (student_id, type, first_name, last_name, phone, address, email, profession, status)
    values (v_student_id, 'mere', p_mere_first_name, p_mere_last_name, p_mere_phone, p_mere_address, p_mere_email, p_mere_profession, coalesce(p_mere_status, 'disponible'))
    returning id into v_mere_id;
  end if;

  return jsonb_build_object('student_id', v_student_id, 'pere_id', v_pere_id, 'mere_id', v_mere_id);
end;
$$;

-- Rattache un tuteur a un eleve, dans les 3 modes decrits ; reutilisable a
-- tout moment (creation initiale ou plus tard), pas seulement pendant
-- create_student.
create function public.attach_guardian(
  p_student_id uuid,
  p_school_id uuid,
  p_role text,
  p_relationship text,
  p_guardian_id uuid,
  p_parent_id uuid,
  p_new_first_name text,
  p_new_last_name text,
  p_new_phone text,
  p_new_email text
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_guardian_id uuid;
  v_parent public.parents%rowtype;
begin
  if p_guardian_id is not null then
    v_guardian_id := p_guardian_id;
  elsif p_parent_id is not null then
    select * into v_parent from public.parents where id = p_parent_id;
    insert into public.guardians (school_id, first_name, last_name, phone, email, parent_source_id)
    values (p_school_id, v_parent.first_name, v_parent.last_name, v_parent.phone, v_parent.email, p_parent_id)
    returning id into v_guardian_id;
  else
    insert into public.guardians (school_id, first_name, last_name, phone, email)
    values (p_school_id, p_new_first_name, p_new_last_name, p_new_phone, p_new_email)
    returning id into v_guardian_id;
  end if;

  insert into public.student_guardians (student_id, guardian_id, relationship, role)
  values (p_student_id, v_guardian_id, p_relationship, coalesce(p_role, 'responsable_principal'));

  return v_guardian_id;
end;
$$;
