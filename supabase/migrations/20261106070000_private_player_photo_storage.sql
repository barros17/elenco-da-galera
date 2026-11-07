insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'player-photos',
  'player-photos',
  false,
  524288,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

revoke all on storage.objects from public, anon;
grant select, insert, update, delete on storage.objects to authenticated;

drop policy if exists "Section members can read player photos" on storage.objects;
create policy "Section members can read player photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'player-photos'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpe?g|webp)$'
    and exists (
      select 1
      from public.sections s
      where s.id::text = split_part(name, '/', 1)
        and (select public.is_section_member(s.id))
    )
  );

drop policy if exists "Players and admins can upload player photos" on storage.objects;
create policy "Players and admins can upload player photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'player-photos'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpe?g|webp)$'
    and exists (
      select 1
      from public.section_players sp
      where sp.id::text = split_part(split_part(name, '/', 2), '.', 1)
        and sp.section_id::text = split_part(name, '/', 1)
        and (
          sp.user_id = (select auth.uid())
          or (select public.is_section_admin(sp.section_id))
        )
    )
  );

drop policy if exists "Players and admins can replace player photos" on storage.objects;
create policy "Players and admins can replace player photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'player-photos'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpe?g|webp)$'
    and exists (
      select 1
      from public.section_players sp
      where sp.id::text = split_part(split_part(name, '/', 2), '.', 1)
        and sp.section_id::text = split_part(name, '/', 1)
        and (
          sp.user_id = (select auth.uid())
          or (select public.is_section_admin(sp.section_id))
        )
    )
  )
  with check (
    bucket_id = 'player-photos'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpe?g|webp)$'
    and exists (
      select 1
      from public.section_players sp
      where sp.id::text = split_part(split_part(name, '/', 2), '.', 1)
        and sp.section_id::text = split_part(name, '/', 1)
        and (
          sp.user_id = (select auth.uid())
          or (select public.is_section_admin(sp.section_id))
        )
    )
  );

drop policy if exists "Players and admins can delete player photos" on storage.objects;
create policy "Players and admins can delete player photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'player-photos'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpe?g|webp)$'
    and exists (
      select 1
      from public.section_players sp
      where sp.id::text = split_part(split_part(name, '/', 2), '.', 1)
        and sp.section_id::text = split_part(name, '/', 1)
        and (
          sp.user_id = (select auth.uid())
          or (select public.is_section_admin(sp.section_id))
        )
    )
  );
