-- "Services" : catalogue extensible pour tout ce qui est hors scolarite
-- (cantine, transport, et au-dela), avec un prix propre a chaque service,
-- decouple du niveau/classe puisque ces prestations s'appliquent a
-- l'ensemble des eleves inscrits, pas a une classe donnee. Remplace les
-- deux lignes fee_structures 'cantine'/'transport', qui n'etaient reliees
-- a aucun abonnement reel (le prix et l'inscription au service vivaient
-- dans deux systemes disjoints).

create table public.services (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  description text,
  category text check (category in ('cantine', 'transport')),
  amount numeric not null check (amount >= 0),
  billing_frequency text not null default 'mensuel' check (billing_frequency in ('unique', 'mensuel')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

comment on table public.services is
  'Catalogue des services hors scolarite (cantine, transport, et services generiques ajoutes librement par l''ecole). category identifie cantine/transport pour les relier a canteen_subscriptions/transport_subscriptions ; null = service generique gere via service_subscriptions.';

alter table public.services enable row level security;

create policy services_select
  on public.services for select
  using (school_id in (select app.accessible_school_ids(auth.uid())));

create policy services_write_staff
  on public.services for all
  using (app.has_permission(auth.uid(), 'finances', 'write'))
  with check (app.has_permission(auth.uid(), 'finances', 'write'));

-- Abonnement generique, pour un service qui n'a pas de table dediee.
-- Cantine et transport gardent canteen_subscriptions/transport_subscriptions
-- pour leurs champs specifiques (formule, ligne de bus) mais partagent
-- desormais le meme catalogue de prix via service_id.
create table public.service_subscriptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  start_date date not null default current_date,
  end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.service_subscriptions enable row level security;

create policy service_subscriptions_select
  on public.service_subscriptions for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.school_id = service_subscriptions.school_id and p.role = any (array['admin', 'direction'])
    )
    or exists (select 1 from public.students s where s.id = service_subscriptions.student_id and s.profile_id = auth.uid())
    or exists (
      select 1 from public.student_guardians sg
      join public.guardians g on g.id = sg.guardian_id
      where sg.student_id = service_subscriptions.student_id and g.profile_id = auth.uid()
    )
  );

create policy service_subscriptions_write_staff
  on public.service_subscriptions for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.school_id = service_subscriptions.school_id and p.role = any (array['admin', 'direction'])
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.school_id = service_subscriptions.school_id and p.role = any (array['admin', 'direction'])
    )
  );

alter table public.canteen_subscriptions add column service_id uuid references public.services(id);
alter table public.transport_subscriptions add column service_id uuid references public.services(id);

-- Migration des donnees existantes : les lignes fee_structures
-- cantine/transport deviennent des services, les abonnements en cours
-- pointent dessus, puis les anciennes lignes sont retirees de
-- fee_structures (qui ne porte plus que inscription/mensualite,
-- desormais geres depuis la page de chaque niveau).
insert into public.services (school_id, name, category, amount, billing_frequency)
select school_id, initcap(fee_type), fee_type, amount, 'mensuel'
from public.fee_structures
where fee_type in ('cantine', 'transport') and level_id is null;

update public.canteen_subscriptions cs
set service_id = (select s.id from public.services s where s.school_id = cs.school_id and s.category = 'cantine')
where exists (select 1 from public.services s where s.school_id = cs.school_id and s.category = 'cantine');

update public.transport_subscriptions ts
set service_id = (select s.id from public.services s where s.school_id = ts.school_id and s.category = 'transport')
where exists (select 1 from public.services s where s.school_id = ts.school_id and s.category = 'transport');

delete from public.fee_structures where fee_type in ('cantine', 'transport');

alter table public.fee_structures drop constraint fee_structures_fee_type_check;
alter table public.fee_structures add constraint fee_structures_fee_type_check check (fee_type = any (array['inscription', 'mensualite']));
