-- Pole 01 : vitrine publique par ecole + demandes d'admission (volet gratuit
-- uniquement ; le dossier complet payant viendra avec le pole 07 finances).

-- ---------------------------------------------------------------------------
-- Champs publics de la vitrine, absents du schema coeur (migration 0001)
-- ---------------------------------------------------------------------------
alter table public.schools
  add column description text,
  add column address text,
  add column contact_email text,
  add column contact_phone text;

-- Lecture publique des ecoles actives/en essai : necessaire pour que la
-- vitrine (visiteur non connecte) puisse afficher les infos de l'ecole.
-- S'ajoute a schools_select (0001) sans le remplacer : les policies
-- permissives d'une meme commande se combinent en OR.
create policy "schools_select_public" on public.schools
  for select using (status in ('trial', 'active'));

-- ---------------------------------------------------------------------------
-- Demandes d'admission (volet gratuit : bulletin/infos candidat uniquement)
-- ---------------------------------------------------------------------------
create table public.admissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  candidate_first_name text not null,
  candidate_last_name text not null,
  candidate_birth_date date,
  desired_level text,
  guardian_first_name text not null,
  guardian_last_name text not null,
  guardian_email text not null,
  guardian_phone text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  decision_note text,
  decided_at timestamptz,
  submitted_at timestamptz not null default now(),
  -- Jeton non devinable donne au candidat pour suivre sa demande sans
  -- compte : voir check-admission-status. Jamais expose en lecture directe
  -- via RLS (cf. absence de policy select publique ci-dessous).
  access_token uuid not null default gen_random_uuid()
);

comment on table public.admissions is
  'Demande d admission gratuite (pole 01). Ecriture et lecture par jeton '
  'geres exclusivement par les Edge Functions submit-admission et '
  'check-admission-status, jamais par le client directement.';

alter table public.admissions enable row level security;

-- Aucune policy INSERT/SELECT-par-jeton pour anon : RLS ne peut pas
-- distinguer "le client a filtre par token" de "le client liste tout",
-- donc un select public ouvrirait la fuite de toutes les demandes.
-- Seul le staff de l'ecole (via son propre compte) peut lire/decider.
create policy "admissions_select_staff" on public.admissions
  for select using (
    school_id in (
      select p.school_id from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'direction')
    )
  );

create policy "admissions_update_staff" on public.admissions
  for update
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
