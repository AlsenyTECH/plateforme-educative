-- Suite de 0016 : create_student prenait niveau_vise en texte libre,
-- doit maintenant prendre l'id du referentiel levels.
drop function if exists public.create_student(uuid, text, text, date, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text);

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
  p_niveau_vise_id uuid,
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
    nationality, address, national_id_number, niveau_vise_id, previous_school, matricule
  )
  values (
    p_school_id, p_first_name, p_last_name, p_birth_date, p_birth_place, p_gender,
    p_nationality, p_address, p_national_id_number, p_niveau_vise_id, p_previous_school,
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
