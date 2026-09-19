-- Stockage de fichiers : un seul bucket prive "uploads", chemin
-- {school_id}/{categorie}/{id}/{fichier} - le premier segment (school_id)
-- sert de base a la RLS, via storage.foldername(name).
--
-- documents : pieces jointes generiques (admission, dossier eleve...),
-- plutot que des champs ad hoc par table - reutilisable partout.

insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict (id) do nothing;

create policy "uploads_select" on storage.objects
  for select using (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1]::uuid in (select app.accessible_school_ids(auth.uid()))
  );

create policy "uploads_write_staff" on storage.objects
  for all
  using (
    bucket_id = 'uploads'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.school_id = (storage.foldername(name))[1]::uuid
        and p.role in ('admin', 'direction')
    )
  )
  with check (
    bucket_id = 'uploads'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.school_id = (storage.foldername(name))[1]::uuid
        and p.role in ('admin', 'direction')
    )
  );

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  entity_type text not null check (entity_type in ('student', 'admission', 'teacher', 'staff_member')),
  entity_id uuid not null,
  document_type text not null,
  storage_path text not null,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.documents enable row level security;

create policy "documents_select_staff" on public.documents
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = documents.school_id and p.role in ('admin', 'direction'))
  );

create policy "documents_write_staff" on public.documents
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = documents.school_id and p.role in ('admin', 'direction')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = documents.school_id and p.role in ('admin', 'direction')));
