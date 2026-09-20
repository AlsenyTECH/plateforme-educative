-- Pole 03 (parametrage etabli) : Niveau et AnneeScolaire deviennent des
-- referentiels reels, plus jamais du texte libre ressaisi dans 3 ecrans
-- differents (bug concret deja identifie : "Sixieme" vs "6e" ne se
-- rattachent jamais entre eux). Migration des valeurs texte existantes vers
-- les nouvelles tables avant de retirer les colonnes texte.

create table public.levels (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  order_index int not null default 0,
  unique (school_id, name)
);

create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  label text not null,
  active boolean not null default false,
  unique (school_id, label)
);

-- Une seule annee active par ecole.
create unique index academic_years_one_active_per_school
  on public.academic_years (school_id) where active;

alter table public.levels enable row level security;
create policy "levels_select" on public.levels
  for select using (school_id in (select app.accessible_school_ids(auth.uid())));
create policy "levels_write_staff" on public.levels
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = levels.school_id and p.role in ('admin', 'direction')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = levels.school_id and p.role in ('admin', 'direction')));

alter table public.academic_years enable row level security;
create policy "academic_years_select" on public.academic_years
  for select using (school_id in (select app.accessible_school_ids(auth.uid())));
create policy "academic_years_write_staff" on public.academic_years
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = academic_years.school_id and p.role in ('admin', 'direction')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = academic_years.school_id and p.role in ('admin', 'direction')));

-- Seed des referentiels a partir des valeurs texte deja saisies (peu de
-- lignes actuellement, migration sure).
insert into public.levels (school_id, name)
select distinct school_id, level from public.classes
union
select distinct school_id, level from public.subject_coefficients
union
select distinct school_id, niveau_vise from public.students where niveau_vise is not null
union
select distinct school_id, level from public.fee_structures
on conflict (school_id, name) do nothing;

insert into public.academic_years (school_id, label, active)
select distinct school_id, academic_year, true from public.classes
on conflict (school_id, label) do nothing;

insert into public.academic_years (school_id, label, active)
select distinct e.school_id, e.academic_year, true
from public.enrollments e
where not exists (select 1 from public.academic_years ay where ay.school_id = e.school_id and ay.label = e.academic_year)
on conflict (school_id, label) do nothing;

-- Nouvelles colonnes FK, peuplees depuis le texte existant.
alter table public.classes add column level_id uuid references public.levels(id);
alter table public.classes add column academic_year_id uuid references public.academic_years(id);
update public.classes c set level_id = l.id from public.levels l where l.school_id = c.school_id and l.name = c.level;
update public.classes c set academic_year_id = ay.id from public.academic_years ay where ay.school_id = c.school_id and ay.label = c.academic_year;
alter table public.classes alter column level_id set not null;
alter table public.classes alter column academic_year_id set not null;
alter table public.classes drop column level;
alter table public.classes drop column academic_year;

alter table public.subject_coefficients add column level_id uuid references public.levels(id);
update public.subject_coefficients sc set level_id = l.id from public.levels l where l.school_id = sc.school_id and l.name = sc.level;
alter table public.subject_coefficients alter column level_id set not null;
alter table public.subject_coefficients drop column level;
alter table public.subject_coefficients add constraint subject_coefficients_school_subject_level_unique unique (school_id, subject_id, level_id);
alter table public.subject_coefficients add constraint subject_coefficients_range check (coefficient >= 1 and coefficient <= 10);

-- fee_structures : niveau optionnel desormais (cantine/transport n'en ont
-- generalement pas besoin), avec deux index d'unicite partiels (avec et
-- sans niveau) plutot qu'une contrainte unique classique qui ne marcherait
-- pas correctement avec des NULL.
alter table public.fee_structures add column level_id uuid references public.levels(id);
update public.fee_structures fs set level_id = l.id from public.levels l where l.school_id = fs.school_id and l.name = fs.level;
alter table public.fee_structures drop column level;
create unique index fee_structures_with_level_unique on public.fee_structures (school_id, fee_type, level_id) where level_id is not null;
create unique index fee_structures_without_level_unique on public.fee_structures (school_id, fee_type) where level_id is null;

alter table public.students add column niveau_vise_id uuid references public.levels(id);
update public.students s set niveau_vise_id = l.id from public.levels l where l.school_id = s.school_id and l.name = s.niveau_vise;
alter table public.students drop column niveau_vise;

alter table public.enrollments add column academic_year_id uuid references public.academic_years(id);
update public.enrollments e set academic_year_id = ay.id from public.academic_years ay where ay.school_id = e.school_id and ay.label = e.academic_year;
alter table public.enrollments alter column academic_year_id set not null;
alter table public.enrollments drop column academic_year;
alter table public.enrollments add unique (student_id, academic_year_id);
