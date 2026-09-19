-- Pole 08 (communication) : annonces internes par ecole. La messagerie
-- directe parent-professeur et les notifications SMS/WhatsApp (necessitent
-- un fournisseur externe) restent un chantier separe.

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  author_profile_id uuid references public.profiles(id),
  title text not null,
  body text not null,
  audience text not null default 'all' check (audience in ('all', 'staff', 'parents')),
  class_id uuid references public.classes(id),
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

create policy "announcements_select" on public.announcements
  for select using (
    school_id in (select app.accessible_school_ids(auth.uid()))
    and (
      audience = 'all'
      or (
        audience = 'staff'
        and exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.school_id = announcements.school_id
            and p.role in ('admin', 'direction', 'professeur')
        )
      )
      or (
        audience = 'parents'
        and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'parent')
      )
    )
  );

create policy "announcements_write_staff" on public.announcements
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.school_id = announcements.school_id
        and p.role in ('admin', 'direction', 'professeur')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.school_id = announcements.school_id
        and p.role in ('admin', 'direction', 'professeur')
    )
  );
