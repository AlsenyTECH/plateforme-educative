-- Seed de DEV UNIQUEMENT : cree une ecole, un admin et un eleve de test pour
-- pouvoir se connecter dans apps/web sans construire d'abord tout le parcours
-- d'inscription (pole 01, pas encore implemente). Jamais a lancer en prod.
--
-- Identifiants de connexion crees : admin@ecole-test.dev / motdepasse-test-1234
--
-- Note : confirmation_token, recovery_token, email_change_token_new et
-- email_change doivent etre des chaines vides et non NULL, sinon le scanner
-- Go de GoTrue plante avec "converting NULL to string is unsupported" au
-- moment du login (verifie en pratique sur ce projet, GoTrue v2.197.0).

with new_school as (
  insert into public.schools (name, slug, plan, status)
  values ('Ecole Test', 'ecole-test', 'standard', 'trial')
  returning id
),
new_user as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user, is_anonymous
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'admin@ecole-test.dev',
    crypt('motdepasse-test-1234', gen_salt('bf')),
    now(),
    now(),
    now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    false,
    false,
    false
  )
  returning id, email
),
new_identity as (
  insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  select
    new_user.id::text,
    new_user.id,
    jsonb_build_object('sub', new_user.id::text, 'email', new_user.email),
    'email',
    now(), now(), now()
  from new_user
  returning user_id
),
new_profile as (
  insert into public.profiles (id, school_id, role, first_name, last_name)
  select new_user.id, new_school.id, 'admin', 'Admin', 'Test'
  from new_user, new_school
  returning id, school_id
),
new_student as (
  insert into public.students (school_id, first_name, last_name, birth_date)
  select school_id, 'Eleve', 'Test', '2010-05-14'
  from new_profile
  returning id, school_id
)
select
  (select id from new_school) as school_id,
  (select id from new_user) as admin_user_id,
  (select id from new_student) as student_id;
