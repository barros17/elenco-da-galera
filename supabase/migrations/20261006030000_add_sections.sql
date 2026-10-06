create table public.sections (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 50),
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  created_by uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.section_members (
  section_id uuid not null references public.sections (id) on delete cascade,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (section_id, user_id)
);

create index section_members_section_id_idx on public.section_members (section_id);

alter table public.players
  add column section_id uuid references public.sections (id) on delete set null;
create index players_section_id_overall_idx on public.players (section_id, overall desc);

do $$
declare
  legacy_player record;
  new_section_id uuid;
begin
  for legacy_player in select distinct user_id from public.players loop
    insert into public.sections (name, created_by)
    values ('Seção migrada', legacy_player.user_id)
    returning id into new_section_id;

    insert into public.section_members (section_id, user_id)
    values (new_section_id, legacy_player.user_id);

    update public.players
    set section_id = new_section_id
    where user_id = legacy_player.user_id;
  end loop;
end;
$$;

alter table public.sections enable row level security;
alter table public.section_members enable row level security;

revoke all on public.sections from anon, authenticated;
revoke all on public.section_members from anon, authenticated;
grant select on public.sections, public.section_members to authenticated;

create or replace function public.is_section_member(p_section_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.section_members
    where section_id = p_section_id
      and user_id = (select auth.uid())
  );
$$;

create or replace function public.is_section_admin(p_section_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.sections
    where id = p_section_id
      and created_by = (select auth.uid())
  );
$$;

revoke all on function public.is_section_member(uuid) from public, anon;
revoke all on function public.is_section_admin(uuid) from public, anon;
grant execute on function public.is_section_member(uuid) to authenticated;
grant execute on function public.is_section_admin(uuid) to authenticated;

create policy "Section members can view their sections"
  on public.sections for select
  to authenticated
  using ((select public.is_section_member(id)));

create policy "Section members can view their membership"
  on public.section_members for select
  to authenticated
  using ((select public.is_section_member(section_id)));

drop policy if exists "Users can view their own players" on public.players;
drop policy if exists "Authenticated users can view the shared roster" on public.players;
create policy "Section members can view section players"
  on public.players for select
  to authenticated
  using (
    section_id is not null
    and (select public.is_section_member(section_id))
  );

drop policy "Users can create their own players" on public.players;
create policy "Section members can create their own player"
  on public.players for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and section_id is not null
    and (select public.is_section_member(section_id))
  );

drop policy "Users can update their own players" on public.players;
create policy "Section members can update their own player"
  on public.players for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and section_id is not null
    and (select public.is_section_member(section_id))
  )
  with check (
    (select auth.uid()) = user_id
    and section_id is not null
    and (select public.is_section_member(section_id))
  );

drop policy "Users can delete their own players" on public.players;
create policy "Section members can delete their own player"
  on public.players for delete
  to authenticated
  using (
    (select auth.uid()) = user_id
    and section_id is not null
    and (select public.is_section_member(section_id))
  );

create or replace function public.create_section(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  new_section_id uuid;
begin
  if current_user_id is null then
    raise exception 'Faça login novamente.';
  end if;

  if p_name is null or char_length(trim(p_name)) not between 2 and 50 then
    raise exception 'O nome da seção deve ter entre 2 e 50 caracteres.';
  end if;

  if exists (
    select 1 from public.section_members where user_id = current_user_id
  ) then
    raise exception 'Saia da seção ativa antes de criar outra.';
  end if;

  if exists (
    select 1 from public.sections where created_by = current_user_id
  ) then
    raise exception 'Você já administra uma seção.';
  end if;

  insert into public.sections (name, created_by)
  values (trim(p_name), current_user_id)
  returning id into new_section_id;

  insert into public.section_members (section_id, user_id)
  values (new_section_id, current_user_id);

  update public.players
  set section_id = new_section_id
  where user_id = current_user_id;

  return new_section_id;
end;
$$;

create or replace function public.join_section(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  target_section_id uuid;
  member_count integer;
begin
  if current_user_id is null then
    raise exception 'Faça login novamente.';
  end if;

  if exists (
    select 1 from public.section_members where user_id = current_user_id
  ) then
    raise exception 'Saia da seção ativa antes de entrar em outra.';
  end if;

  select id into target_section_id
  from public.sections
  where invite_code = upper(trim(p_invite_code))
  for update;

  if target_section_id is null then
    raise exception 'Código de convite inválido.';
  end if;

  select count(*) into member_count
  from public.section_members
  where section_id = target_section_id;

  if member_count >= 24 then
    raise exception 'Esta seção já atingiu o limite de 24 participantes.';
  end if;

  insert into public.section_members (section_id, user_id)
  values (target_section_id, current_user_id);

  update public.players
  set section_id = target_section_id
  where user_id = current_user_id;

  return target_section_id;
exception
  when unique_violation then
    raise exception 'Você já está em uma seção ativa.';
end;
$$;

create or replace function public.get_my_section()
returns table (
  section_id uuid,
  name text,
  invite_code text,
  is_admin boolean,
  member_count integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.id, s.name, s.invite_code, s.created_by = (select auth.uid()),
    (select count(*)::integer from public.section_members sm where sm.section_id = s.id)
  from public.sections s
  join public.section_members mine on mine.section_id = s.id
  where mine.user_id = (select auth.uid())
  limit 1;
$$;

create or replace function public.get_section_members(p_section_id uuid)
returns table (
  user_id uuid,
  joined_at timestamptz,
  is_admin boolean,
  player_name text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_section_member(p_section_id) then
    raise exception 'Você não participa desta seção.';
  end if;

  return query
    select sm.user_id, sm.joined_at, s.created_by = sm.user_id, p.name
    from public.section_members sm
    join public.sections s on s.id = sm.section_id
    left join public.players p
      on p.user_id = sm.user_id
      and p.section_id = sm.section_id
    where sm.section_id = p_section_id
    order by s.created_by = sm.user_id desc, sm.joined_at;
end;
$$;

create or replace function public.leave_section(p_section_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Faça login novamente.';
  end if;

  if public.is_section_admin(p_section_id) then
    raise exception 'Exclua sua seção antes de sair dela.';
  end if;

  delete from public.section_members
  where section_id = p_section_id and user_id = current_user_id;

  if not found then
    raise exception 'Você não participa desta seção.';
  end if;

  update public.players
  set section_id = null
  where user_id = current_user_id and section_id = p_section_id;
end;
$$;

create or replace function public.remove_section_member(p_section_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_section_admin(p_section_id) then
    raise exception 'Somente o administrador pode remover participantes.';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Exclua a seção para encerrar sua administração.';
  end if;

  delete from public.section_members
  where section_id = p_section_id and user_id = p_user_id;

  if not found then
    raise exception 'Participante não encontrado nesta seção.';
  end if;

  update public.players
  set section_id = null
  where user_id = p_user_id and section_id = p_section_id;
end;
$$;

create or replace function public.delete_section(p_section_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_section_admin(p_section_id) then
    raise exception 'Somente o administrador pode excluir esta seção.';
  end if;

  delete from public.sections where id = p_section_id;
end;
$$;

revoke all on function public.create_section(text) from public, anon;
revoke all on function public.join_section(text) from public, anon;
revoke all on function public.get_my_section() from public, anon;
revoke all on function public.get_section_members(uuid) from public, anon;
revoke all on function public.leave_section(uuid) from public, anon;
revoke all on function public.remove_section_member(uuid, uuid) from public, anon;
revoke all on function public.delete_section(uuid) from public, anon;

grant execute on function public.create_section(text) to authenticated;
grant execute on function public.join_section(text) to authenticated;
grant execute on function public.get_my_section() to authenticated;
grant execute on function public.get_section_members(uuid) to authenticated;
grant execute on function public.leave_section(uuid) to authenticated;
grant execute on function public.remove_section_member(uuid, uuid) to authenticated;
grant execute on function public.delete_section(uuid) to authenticated;
