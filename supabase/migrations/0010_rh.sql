-- Pole 10 (RH & administration interne) : contrats du personnel.
-- Statistiques d'etablissement (effectifs, taux de recouvrement...) non
-- incluses ici : elles se calculent a partir des donnees existantes
-- (students, et plus tard les paiements du pole 07), pas besoin de table
-- dediee pour l'instant.

create table public.staff_contracts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  contract_type text not null,
  start_date date not null,
  end_date date,
  salary numeric,
  created_at timestamptz not null default now()
);

alter table public.staff_contracts enable row level security;

create policy "staff_contracts_select" on public.staff_contracts
  for select using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.school_id = staff_contracts.school_id
        and p.role in ('admin', 'direction')
    )
  );

create policy "staff_contracts_write" on public.staff_contracts
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.school_id = staff_contracts.school_id
        and p.role in ('admin', 'direction')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.school_id = staff_contracts.school_id
        and p.role in ('admin', 'direction')
    )
  );
