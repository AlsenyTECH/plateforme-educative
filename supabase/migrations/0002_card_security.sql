-- Pole 06 (partie 1/2) : cles de signature Ed25519 par ecole + cartes scolaires.
-- Le wallet et la billetterie du meme pole seront une migration separee.

-- Cle publique de signature : exposee sur schools, lisible par tout utilisateur
-- de l'ecole via la policy schools_select deja existante. Les terminaux de scan
-- la recuperent pour verifier les cartes entierement hors-ligne.
alter table public.schools
  add column card_public_key bytea;

-- Cle privee : jamais lue par un client. RLS activee mais SANS AUCUNE policy :
-- seule la service_role key (utilisee cote serveur par l'Edge Function de
-- signature) peut lire cette table, car elle contourne RLS par construction.
create table public.school_signing_keys (
  school_id uuid primary key references public.schools(id) on delete cascade,
  private_key bytea not null,
  created_at timestamptz not null default now()
);

alter table public.school_signing_keys enable row level security;

comment on table public.school_signing_keys is
  'Cle privee Ed25519 par ecole. RLS activee sans aucune policy : ni anon ni '
  'authenticated ne peuvent lire cette table quel que soit le role applicatif ; '
  'seule la service_role key (Edge Functions serveur) y a acces.';

-- Cartes scolaires. id = card_id du payload signe encode dans le QR.
create table public.cards (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  card_version int not null default 1,
  status text not null default 'active' check (status in ('active', 'revoked')),
  issued_at timestamptz not null default now(),
  signature bytea not null,
  revoked_at timestamptz,
  revoked_reason text
);

comment on table public.cards is
  'Une ligne = une carte physique emise. signature = Ed25519 sur '
  '(id, student_id, school_id, issued_at, card_version), calculee une seule fois '
  'par l Edge Function au moment de l emission (jamais recalculee ensuite). '
  'Perte/vol : on ne modifie jamais la ligne existante, on la passe a revoked '
  'et on insere une nouvelle carte avec card_version + 1.';

-- Un seul badge actif par eleve a la fois.
create unique index cards_one_active_per_student
  on public.cards (student_id)
  where status = 'active';

alter table public.cards enable row level security;

create policy "cards_select" on public.cards
  for select using (school_id in (select app.accessible_school_ids(auth.uid())));

create policy "cards_write_staff" on public.cards
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
