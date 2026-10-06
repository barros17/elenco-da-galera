-- Jogadores da seção: cartas que vivem só dentro da seção.
-- O administrador pode criar, editar e remover quantos jogadores quiser (inclusive os de
-- outros participantes). Nada disso toca em public.players, que volta a ser o jogador
-- individual de cada pessoa.

create table public.section_players (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections (id) on delete cascade,
  -- Participante que esta carta representa. Nulo = jogador adicionado pelo administrador.
  user_id uuid references auth.users (id) on delete set null,
  name text not null check (char_length(trim(name)) between 1 and 40),
  position text not null check (position in ('GOL', 'ZAG', 'LAT', 'VOL', 'MEI', 'ATA')),
  skills jsonb not null default '{}'::jsonb,
  weak_foot integer not null default 0 check (weak_foot between 0 and 5),
  overall integer not null default 1 check (overall between 1 and 99),
  photo_url text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index section_players_section_id_overall_idx
  on public.section_players (section_id, overall desc);

-- Cada participante tem no máximo uma carta própria por seção.
create unique index section_players_one_per_member_idx
  on public.section_players (section_id, user_id)
  where user_id is not null;

-- Copia os jogadores que hoje estão dentro de seções (players.section_id) para a nova tabela.
insert into public.section_players
  (section_id, user_id, name, position, skills, weak_foot, overall, photo_url, created_by, created_at)
select
  p.section_id,
  p.user_id,
  coalesce(nullif(left(trim(p.name), 40), ''), 'Jogador'),
  p.position,
  p.skills,
  p.weak_foot,
  p.overall,
  p.photo_url,
  p.user_id,
  p.created_at
from public.players p
where p.section_id is not null;

-- O jogador individual deixa de pertencer a uma seção e fica intacto.
update public.players set section_id = null where section_id is not null;

alter table public.section_players enable row level security;

revoke all on public.section_players from anon, authenticated;
grant select, insert, update, delete on public.section_players to authenticated;

create policy "Section members can view section players"
  on public.section_players for select
  to authenticated
  using ((select public.is_section_member(section_id)));

create policy "Admins and members can create section players"
  on public.section_players for insert
  to authenticated
  with check (
    (
      (select public.is_section_admin(section_id))
      and (user_id is null or user_id = (select auth.uid()))
    )
    or (
      user_id = (select auth.uid())
      and (select public.is_section_member(section_id))
    )
  );

create policy "Admins and owners can update section players"
  on public.section_players for update
  to authenticated
  using (
    (select public.is_section_admin(section_id))
    or (
      user_id = (select auth.uid())
      and (select public.is_section_member(section_id))
    )
  )
  with check (
    (select public.is_section_admin(section_id))
    or (
      user_id = (select auth.uid())
      and (select public.is_section_member(section_id))
    )
  );

create policy "Admins and owners can delete section players"
  on public.section_players for delete
  to authenticated
  using (
    (select public.is_section_admin(section_id))
    or (
      user_id = (select auth.uid())
      and (select public.is_section_member(section_id))
    )
  );

-- Impede mover uma carta para outra seção ou trocar a quem ela pertence.
create or replace function public.section_players_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.section_id <> old.section_id or new.user_id is distinct from old.user_id then
    raise exception 'Não é possível mover a carta para outra seção ou participante.';
  end if;
  return new;
end;
$$;

create trigger section_players_guard
  before update on public.section_players
  for each row execute function public.section_players_guard();

-- Quem cria a própria carta pela primeira vez já ganha o jogador individual dele.
-- Se já existir um jogador individual, ele nunca é alterado.
create or replace function public.seed_personal_player()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.user_id is not null then
    insert into public.players (user_id, name, position, skills, weak_foot, overall, photo_url)
    values (new.user_id, new.name, new.position, new.skills, new.weak_foot, new.overall, new.photo_url)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.seed_personal_player() from public, anon, authenticated;

create trigger section_players_seed_personal
  after insert on public.section_players
  for each row execute function public.seed_personal_player();

-- players volta a ser apenas do próprio dono.
drop policy if exists "Section members can view section players" on public.players;
drop policy if exists "Section members can create their own player" on public.players;
drop policy if exists "Section members can update their own player" on public.players;
drop policy if exists "Section members can delete their own player" on public.players;

create policy "Users can manage their own players"
  on public.players for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- RPCs: agora copiam/removem cartas em section_players em vez de mover players.

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

  insert into public.section_players
    (section_id, user_id, name, position, skills, weak_foot, overall, photo_url, created_by)
  select
    new_section_id, p.user_id,
    coalesce(nullif(left(trim(p.name), 40), ''), 'Jogador'),
    p.position, p.skills, p.weak_foot, p.overall, p.photo_url, current_user_id
  from public.players p
  where p.user_id = current_user_id;

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

  insert into public.section_players
    (section_id, user_id, name, position, skills, weak_foot, overall, photo_url, created_by)
  select
    target_section_id, p.user_id,
    coalesce(nullif(left(trim(p.name), 40), ''), 'Jogador'),
    p.position, p.skills, p.weak_foot, p.overall, p.photo_url, current_user_id
  from public.players p
  where p.user_id = current_user_id;

  return target_section_id;
exception
  when unique_violation then
    raise exception 'Você já está em uma seção ativa.';
end;
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
    select sm.user_id, sm.joined_at, s.created_by = sm.user_id, sp.name
    from public.section_members sm
    join public.sections s on s.id = sm.section_id
    left join public.section_players sp
      on sp.user_id = sm.user_id
      and sp.section_id = sm.section_id
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

  delete from public.section_players
  where section_id = p_section_id and user_id = current_user_id;
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

  delete from public.section_players
  where section_id = p_section_id and user_id = p_user_id;
end;
$$;

revoke all on function public.create_section(text) from public, anon;
revoke all on function public.join_section(text) from public, anon;
revoke all on function public.get_section_members(uuid) from public, anon;
revoke all on function public.leave_section(uuid) from public, anon;
revoke all on function public.remove_section_member(uuid, uuid) from public, anon;

grant execute on function public.create_section(text) to authenticated;
grant execute on function public.join_section(text) to authenticated;
grant execute on function public.get_section_members(uuid) to authenticated;
grant execute on function public.leave_section(uuid) to authenticated;
grant execute on function public.remove_section_member(uuid, uuid) to authenticated;
