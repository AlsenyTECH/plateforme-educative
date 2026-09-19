-- Creation d'un eleve en une seule transaction : matricule, tuteur
-- (existant ou nouveau) et inscription. security invoker (par defaut) :
-- s'execute avec les droits de l'appelant, donc chaque insert interne passe
-- par la RLS normale de l'admin connecte - la fonction groupe les etapes,
-- elle ne contourne aucun controle d'acces.
create or replace function public.create_student(
  p_school_id uuid,
  p_first_name text,
  p_last_name text,
  p_birth_date date,
  p_birth_place text,
  p_gender text,
  p_address text,
  p_class_id uuid,
  p_academic_year text,
  p_guardian_id uuid,
  p_new_guardian_first_name text,
  p_new_guardian_last_name text,
  p_new_guardian_phone text,
  p_relationship text
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_student_id uuid;
  v_guardian_id uuid;
  v_matricule int;
begin
  v_matricule := public.next_sequence(p_school_id, 'matricule');

  insert into public.students (school_id, first_name, last_name, birth_date, birth_place, gender, address, matricule)
  values (p_school_id, p_first_name, p_last_name, p_birth_date, p_birth_place, p_gender, p_address, lpad(v_matricule::text, 4, '0'))
  returning id into v_student_id;

  if p_guardian_id is not null then
    v_guardian_id := p_guardian_id;
  else
    insert into public.guardians (school_id, first_name, last_name, phone)
    values (p_school_id, p_new_guardian_first_name, p_new_guardian_last_name, p_new_guardian_phone)
    returning id into v_guardian_id;
  end if;

  insert into public.student_guardians (student_id, guardian_id, relationship)
  values (v_student_id, v_guardian_id, p_relationship);

  if p_class_id is not null then
    insert into public.enrollments (school_id, student_id, class_id, academic_year)
    values (p_school_id, v_student_id, p_class_id, p_academic_year);
  end if;

  return v_student_id;
end;
$$;
