create table public.game_styles (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  players_per_team integer not null check (players_per_team between 2 and 11),
  has_goalkeeper boolean not null default false,
  defenders integer not null default 0 check (defenders >= 0),
  midfielders integer not null default 0 check (midfielders >= 0),
  attackers integer not null default 0 check (attackers >= 0),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_styles_total_check check (
    players_per_team = (case when has_goalkeeper then 1 else 0 end) + defenders + midfielders + attackers
  ),
  constraint game_styles_name_unique unique (section_id, name)
);

create unique index game_styles_section_name_ci_idx on public.game_styles(section_id, lower(name));
create index game_styles_section_id_idx on public.game_styles(section_id);

create or replace function public.set_game_style_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at = now(); return new; end;
$$;
revoke all on function public.set_game_style_updated_at() from public, anon, authenticated;
create trigger game_styles_updated_at before update on public.game_styles
for each row execute function public.set_game_style_updated_at();

alter table public.game_styles enable row level security;
revoke all on public.game_styles from public, anon, authenticated;
grant select on public.game_styles to authenticated;
create policy "Members can view game styles" on public.game_styles for select to authenticated
using ((select public.is_section_member(section_id)));
create policy "Admins can insert game styles" on public.game_styles for insert to authenticated
with check ((select public.is_section_admin(section_id)));
create policy "Admins can update game styles" on public.game_styles for update to authenticated
using ((select public.is_section_admin(section_id))) with check ((select public.is_section_admin(section_id)));
create policy "Admins can delete game styles" on public.game_styles for delete to authenticated
using ((select public.is_section_admin(section_id)));

create or replace function public.create_game_style(
  p_section_id uuid, p_name text, p_players_per_team integer, p_has_goalkeeper boolean,
  p_defenders integer, p_midfielders integer, p_attackers integer
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.is_section_admin(p_section_id) then
    raise exception 'Somente o administrador pode criar estilos para a seção.' using errcode = '42501';
  end if;
  if (select count(*) from public.game_styles where section_id = p_section_id) >= 20 then
    raise exception 'A seção já atingiu o limite de 20 estilos de jogo.';
  end if;
  insert into public.game_styles(section_id, name, players_per_team, has_goalkeeper, defenders, midfielders, attackers, created_by)
  values (p_section_id, btrim(p_name), p_players_per_team, p_has_goalkeeper, p_defenders, p_midfielders, p_attackers, auth.uid())
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'Já existe um estilo com esse nome nesta seção.';
end;
$$;
revoke all on function public.create_game_style(uuid,text,integer,boolean,integer,integer,integer) from public, anon;
grant execute on function public.create_game_style(uuid,text,integer,boolean,integer,integer,integer) to authenticated;

create or replace function public.update_game_style(
  p_id uuid, p_section_id uuid, p_name text, p_players_per_team integer, p_has_goalkeeper boolean,
  p_defenders integer, p_midfielders integer, p_attackers integer
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not public.is_section_admin(p_section_id) then
    raise exception 'Somente o administrador pode editar estilos da seção.' using errcode = '42501';
  end if;
  update public.game_styles set name=btrim(p_name), players_per_team=p_players_per_team,
    has_goalkeeper=p_has_goalkeeper, defenders=p_defenders, midfielders=p_midfielders, attackers=p_attackers
  where id=p_id and section_id=p_section_id;
  if not found then raise exception 'Estilo de jogo não encontrado.'; end if;
exception when unique_violation then
  raise exception 'Já existe um estilo com esse nome nesta seção.';
end;
$$;
revoke all on function public.update_game_style(uuid,uuid,text,integer,boolean,integer,integer,integer) from public, anon;
grant execute on function public.update_game_style(uuid,uuid,text,integer,boolean,integer,integer,integer) to authenticated;

create or replace function public.delete_game_style(p_id uuid, p_section_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not public.is_section_admin(p_section_id) then
    raise exception 'Somente o administrador pode excluir estilos da seção.' using errcode = '42501';
  end if;
  delete from public.game_styles where id=p_id and section_id=p_section_id;
  if not found then raise exception 'Estilo de jogo não encontrado.'; end if;
end;
$$;
revoke all on function public.delete_game_style(uuid,uuid) from public, anon;
grant execute on function public.delete_game_style(uuid,uuid) to authenticated;

alter table public.events add column players_per_team integer;
alter table public.events add column has_goalkeeper boolean;
alter table public.events add column defenders integer;
alter table public.events add column midfielders integer;
alter table public.events add column attackers integer;
alter table public.events add column game_style_id uuid references public.game_styles(id) on delete set null;
update public.events set players_per_team = case modality when 'futsal' then 5 when 'fut7' then 7 when 'campo11' then 11 end,
  has_goalkeeper = true,
  defenders = case modality when 'futsal' then 1 when 'fut7' then 2 when 'campo11' then 4 end,
  midfielders = case modality when 'futsal' then 2 when 'fut7' then 3 when 'campo11' then 3 end,
  attackers = case modality when 'futsal' then 1 when 'fut7' then 1 when 'campo11' then 3 end
where players_per_team is null;
alter table public.events alter column players_per_team set not null;
alter table public.events alter column has_goalkeeper set not null;
alter table public.events alter column defenders set not null;
alter table public.events alter column midfielders set not null;
alter table public.events alter column attackers set not null;
alter table public.events drop constraint if exists events_modality_check;
alter table public.events add constraint events_modality_check check (modality in ('futsal','fut7','campo11','custom'));
alter table public.events add constraint events_formation_snapshot_check check (
  players_per_team between 2 and 11 and defenders >= 0 and midfielders >= 0 and attackers >= 0 and
  players_per_team = (case when has_goalkeeper then 1 else 0 end) + defenders + midfielders + attackers
);

create or replace function public.validate_event_formation_snapshot()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.players_per_team <> (case when new.has_goalkeeper then 1 else 0 end) + new.defenders + new.midfielders + new.attackers then
    raise exception 'A soma da formação não corresponde ao tamanho do time.';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_event_formation_snapshot() from public, anon, authenticated;
create trigger events_formation_snapshot_guard before insert or update on public.events
for each row execute function public.validate_event_formation_snapshot();

revoke insert, update, delete on public.events from authenticated;

drop function if exists public.create_section_event(uuid,text,timestamptz,timestamptz,text);
create or replace function public.create_section_event(
  p_section_id uuid, p_title text, p_starts_at timestamptz, p_ends_at timestamptz,
  p_modality text, p_game_style_id uuid default null
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_event_id uuid; v_players integer; v_gk boolean; v_def integer; v_mid integer; v_atk integer; v_style_section uuid;
begin
  if auth.uid() is null or not public.is_section_admin(p_section_id) then
    raise exception 'Somente o administrador pode criar jogos para a seção.' using errcode = '42501';
  end if;
  if p_modality = 'custom' then
    if p_game_style_id is null then raise exception 'Escolha um estilo personalizado para criar este jogo.'; end if;
    select section_id, players_per_team, has_goalkeeper, defenders, midfielders, attackers
      into v_style_section, v_players, v_gk, v_def, v_mid, v_atk from public.game_styles where id=p_game_style_id;
    if v_style_section is distinct from p_section_id then raise exception 'O estilo não pertence a esta seção.'; end if;
  else
    if p_modality = 'futsal' then v_players:=5; v_gk:=true; v_def:=1; v_mid:=2; v_atk:=1;
    elsif p_modality = 'fut7' then v_players:=7; v_gk:=true; v_def:=2; v_mid:=3; v_atk:=1;
    elsif p_modality = 'campo11' then v_players:=11; v_gk:=true; v_def:=4; v_mid:=3; v_atk:=3;
    else raise exception 'Modalidade de jogo inválida.'; end if;
  end if;
  insert into public.events(section_id,title,starts_at,ends_at,modality,game_style_id,players_per_team,has_goalkeeper,defenders,midfielders,attackers,created_by)
  values(p_section_id,p_title,p_starts_at,p_ends_at,p_modality,p_game_style_id,v_players,v_gk,v_def,v_mid,v_atk,auth.uid()) returning id into v_event_id;
  insert into public.event_attendance(event_id,player_id) select v_event_id,id from public.section_players where section_id=p_section_id on conflict do nothing;
  return v_event_id;
end;
$$;
revoke all on function public.create_section_event(uuid,text,timestamptz,timestamptz,text,uuid) from public, anon;
grant execute on function public.create_section_event(uuid,text,timestamptz,timestamptz,text,uuid) to authenticated;

drop view if exists public.event_draw_eligible;
create view public.event_draw_eligible with (security_invoker = true) as
select event_id, player_id, status, waitlist_position, responded_at
from public.event_attendance where status = 'CONFIRMED';
