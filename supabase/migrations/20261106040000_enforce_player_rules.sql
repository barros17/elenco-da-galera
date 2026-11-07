drop trigger if exists section_players_server_validation on public.section_players;
drop function if exists public.normalize_section_player_data();

create or replace function public.player_skill_keys(p_position text)
returns text[]
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if p_position = 'GOL' then
    return array['MER', 'MAN', 'CHU', 'REF', 'VEL', 'POS'];
  end if;

  if p_position in ('ZAG', 'LAT', 'VOL', 'MEI', 'ATA') then
    return array['RIT', 'CHU', 'PAS', 'DRI', 'DEF', 'FIS'];
  end if;

  raise exception 'Posição inválida para o jogador.';
end;
$$;

create or replace function public.normalize_player_skills(p_position text, p_skills jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  skill_key text;
  raw_value text;
  numeric_value numeric;
  normalized_value integer;
  normalized_skills jsonb := '{}'::jsonb;
begin
  if jsonb_typeof(p_skills) is distinct from 'object' then
    raise exception 'As habilidades devem ser um objeto JSON.';
  end if;

  foreach skill_key in array public.player_skill_keys(p_position) loop
    raw_value := p_skills ->> skill_key;
    normalized_value := 1;

    if raw_value ~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?$' then
      begin
        numeric_value := round(raw_value::numeric);
        normalized_value := least(99, greatest(1, numeric_value))::integer;
      exception
        when numeric_value_out_of_range then
          normalized_value := 1;
      end;
    end if;

    normalized_skills := normalized_skills || jsonb_build_object(skill_key, normalized_value);
  end loop;

  return normalized_skills;
end;
$$;

create or replace function public.calc_player_overall(p_position text, p_skills jsonb)
returns integer
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  normalized_skills jsonb := public.normalize_player_skills(p_position, p_skills);
  total integer;
  result integer;
begin
  if p_position = 'GOL' then
    total :=
      (normalized_skills ->> 'MER')::integer +
      (normalized_skills ->> 'MAN')::integer +
      (normalized_skills ->> 'CHU')::integer +
      (normalized_skills ->> 'REF')::integer +
      (normalized_skills ->> 'VEL')::integer +
      (normalized_skills ->> 'POS')::integer;
    result := (total + 3) / 6;
  else
    total := case p_position
      when 'ATA' then
        (normalized_skills ->> 'RIT')::integer * 20 +
        (normalized_skills ->> 'CHU')::integer * 30 +
        (normalized_skills ->> 'PAS')::integer * 10 +
        (normalized_skills ->> 'DRI')::integer * 25 +
        (normalized_skills ->> 'DEF')::integer * 0 +
        (normalized_skills ->> 'FIS')::integer * 15
      when 'MEI' then
        (normalized_skills ->> 'RIT')::integer * 10 +
        (normalized_skills ->> 'CHU')::integer * 15 +
        (normalized_skills ->> 'PAS')::integer * 30 +
        (normalized_skills ->> 'DRI')::integer * 25 +
        (normalized_skills ->> 'DEF')::integer * 5 +
        (normalized_skills ->> 'FIS')::integer * 15
      when 'VOL' then
        (normalized_skills ->> 'RIT')::integer * 10 +
        (normalized_skills ->> 'CHU')::integer * 5 +
        (normalized_skills ->> 'PAS')::integer * 25 +
        (normalized_skills ->> 'DRI')::integer * 15 +
        (normalized_skills ->> 'DEF')::integer * 30 +
        (normalized_skills ->> 'FIS')::integer * 15
      when 'LAT' then
        (normalized_skills ->> 'RIT')::integer * 25 +
        (normalized_skills ->> 'CHU')::integer * 5 +
        (normalized_skills ->> 'PAS')::integer * 15 +
        (normalized_skills ->> 'DRI')::integer * 15 +
        (normalized_skills ->> 'DEF')::integer * 25 +
        (normalized_skills ->> 'FIS')::integer * 15
      when 'ZAG' then
        (normalized_skills ->> 'RIT')::integer * 10 +
        (normalized_skills ->> 'CHU')::integer * 0 +
        (normalized_skills ->> 'PAS')::integer * 10 +
        (normalized_skills ->> 'DRI')::integer * 5 +
        (normalized_skills ->> 'DEF')::integer * 45 +
        (normalized_skills ->> 'FIS')::integer * 30
    end;
    result := (total + 50) / 100;
  end if;

  return least(99, greatest(1, result));
end;
$$;

create or replace function public.enforce_player_rules()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  name_changed boolean;
  photo_changed boolean;
begin
  if tg_op = 'INSERT' then
    name_changed := true;
    photo_changed := true;
  else
    name_changed := new.name is distinct from old.name;
    photo_changed := new.photo_url is distinct from old.photo_url;
  end if;

  new.name := btrim(coalesce(new.name, ''));
  if name_changed and char_length(new.name) not between 1 and 40 then
    raise exception 'O nome do jogador deve ter entre 1 e 40 caracteres.';
  end if;

  if photo_changed and new.photo_url is not null then
    if char_length(new.photo_url) > 1500000 then
      raise exception 'A foto do jogador excede o tamanho máximo permitido.';
    end if;
    if new.photo_url !~ '^data:image/(png|jpeg|webp);base64,'
      and new.photo_url !~ '^https://'
      and new.photo_url !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpe?g|webp)$'
    then
      raise exception 'A foto deve ser uma data URL de imagem, uma URL HTTPS ou um caminho válido do Storage.';
    end if;
  end if;

  new.weak_foot := least(5, greatest(0, coalesce(new.weak_foot, 0)));
  new.skills := public.normalize_player_skills(new.position, new.skills);
  new.overall := public.calc_player_overall(new.position, new.skills);
  return new;
end;
$$;

revoke all on function public.enforce_player_rules() from public, anon, authenticated;

drop trigger if exists players_enforce_player_rules on public.players;
create trigger players_enforce_player_rules
  before insert or update on public.players
  for each row execute function public.enforce_player_rules();

drop trigger if exists section_players_enforce_player_rules on public.section_players;
create trigger section_players_enforce_player_rules
  before insert or update on public.section_players
  for each row execute function public.enforce_player_rules();

drop policy if exists "Admins and members can create section players" on public.section_players;
create policy "Admins and members can create section players"
  on public.section_players for insert
  to authenticated
  with check (
    (created_by is null or created_by = (select auth.uid()))
    and (
      (
        (select public.is_section_admin(section_id))
        and (user_id is null or user_id = (select auth.uid()))
      )
      or (
        user_id = (select auth.uid())
        and (select public.is_section_member(section_id))
      )
    )
  );

do $$
declare
  changed_players integer;
  changed_section_players integer;
begin
  select count(*) into changed_players
  from public.players
  where overall is distinct from public.calc_player_overall(position, skills);

  update public.players set skills = skills, overall = overall;

  select count(*) into changed_section_players
  from public.section_players
  where overall is distinct from public.calc_player_overall(position, skills);

  update public.section_players set skills = skills, overall = overall;

  raise notice 'Overall recalculado: % linhas em players e % em section_players mudaram.',
    changed_players, changed_section_players;
end;
$$;
