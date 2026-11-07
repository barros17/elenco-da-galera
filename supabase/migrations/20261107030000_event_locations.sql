alter table public.events
  add column location_lat numeric,
  add column location_lng numeric;

alter table public.events
  add constraint events_location_lat_range_check
  check (location_lat is null or location_lat between -90 and 90),
  add constraint events_location_lng_range_check
  check (location_lng is null or location_lng between -180 and 180),
  add constraint events_location_coordinates_pair_check
  check ((location_lat is null) = (location_lng is null));

create or replace function public.validate_event_location(
  p_location_name text,
  p_location_address text,
  p_location_link text,
  p_location_lat numeric,
  p_location_lng numeric
) returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_link text := nullif(btrim(p_location_link), '');
  v_host text;
begin
  if p_location_name is not null and char_length(btrim(p_location_name)) > 80 then
    raise exception 'O nome do local deve ter no máximo 80 caracteres.';
  end if;
  if p_location_address is not null and char_length(btrim(p_location_address)) > 200 then
    raise exception 'O endereço deve ter no máximo 200 caracteres.';
  end if;
  if v_link is not null then
    if char_length(v_link) > 500 then
      raise exception 'O link do Google Maps deve ter no máximo 500 caracteres.';
    end if;
    if v_link !~* '^https://[^/?#:@]+(?:/[^?#]*)?(?:\?[^#]*)?(?:#.*)?$' then
      raise exception 'O link do Google Maps deve ser HTTPS, sem credenciais e com host válido.';
    end if;
    v_host := lower((regexp_match(v_link, '^https://([^/?#:@]+)'))[1]);
    if v_host not in ('google.com', 'www.google.com', 'maps.google.com', 'maps.app.goo.gl', 'goo.gl') then
      raise exception 'O link deve apontar para um domínio permitido do Google Maps.';
    end if;
    if v_host = 'goo.gl' and v_link !~* '^https://goo\.gl/maps(?:/|$)' then
      raise exception 'Links goo.gl precisam começar por /maps.';
    end if;
  end if;
  if (p_location_lat is null) <> (p_location_lng is null) then
    raise exception 'Latitude e longitude devem ser informadas juntas.';
  end if;
  if p_location_lat is not null and (p_location_lat < -90 or p_location_lat > 90) then
    raise exception 'A latitude deve estar entre -90 e 90.';
  end if;
  if p_location_lng is not null and (p_location_lng < -180 or p_location_lng > 180) then
    raise exception 'A longitude deve estar entre -180 e 180.';
  end if;
end;
$$;
revoke all on function public.validate_event_location(text,text,text,numeric,numeric) from public, anon;
grant execute on function public.validate_event_location(text,text,text,numeric,numeric) to authenticated;

drop function if exists public.create_section_event(uuid,text,timestamptz,timestamptz,text,uuid);
create or replace function public.create_section_event(
  p_section_id uuid,
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_modality text,
  p_game_style_id uuid default null,
  p_location_name text default null,
  p_location_address text default null,
  p_location_link text default null,
  p_location_lat numeric default null,
  p_location_lng numeric default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_id uuid;
  v_players integer;
  v_gk boolean;
  v_def integer;
  v_mid integer;
  v_atk integer;
  v_style_section uuid;
  v_location_name text := nullif(btrim(coalesce(p_location_name, '')), '');
  v_location_address text := nullif(btrim(coalesce(p_location_address, '')), '');
  v_location_link text := nullif(btrim(coalesce(p_location_link, '')), '');
begin
  if auth.uid() is null or not public.is_section_admin(p_section_id) then
    raise exception 'Somente o administrador pode criar jogos para a seção.' using errcode = '42501';
  end if;
  perform public.validate_event_location(v_location_name, v_location_address, v_location_link, p_location_lat, p_location_lng);
  if p_modality = 'custom' then
    if p_game_style_id is null then raise exception 'Escolha um estilo personalizado para criar este jogo.'; end if;
    select section_id, players_per_team, has_goalkeeper, defenders, midfielders, attackers
      into v_style_section, v_players, v_gk, v_def, v_mid, v_atk
    from public.game_styles where id = p_game_style_id;
    if v_style_section is distinct from p_section_id then raise exception 'O estilo não pertence a esta seção.'; end if;
  elsif p_modality = 'futsal' then
    v_players := 5; v_gk := true; v_def := 1; v_mid := 2; v_atk := 1;
  elsif p_modality = 'fut7' then
    v_players := 7; v_gk := true; v_def := 2; v_mid := 3; v_atk := 1;
  elsif p_modality = 'campo11' then
    v_players := 11; v_gk := true; v_def := 4; v_mid := 3; v_atk := 3;
  else
    raise exception 'Modalidade de jogo inválida.';
  end if;
  insert into public.events(
    section_id,title,starts_at,ends_at,modality,game_style_id,players_per_team,has_goalkeeper,
    defenders,midfielders,attackers,location_name,location_address,location_link,location_lat,location_lng,created_by
  ) values (
    p_section_id,btrim(p_title),p_starts_at,p_ends_at,p_modality,
    case when p_modality = 'custom' then p_game_style_id else null end,
    v_players,v_gk,v_def,v_mid,v_atk,coalesce(v_location_name, ''),v_location_address,v_location_link,p_location_lat,p_location_lng,auth.uid()
  ) returning id into v_event_id;
  insert into public.event_attendance(event_id,player_id)
  select v_event_id,id from public.section_players where section_id=p_section_id on conflict do nothing;
  return v_event_id;
end;
$$;
revoke all on function public.create_section_event(uuid,text,timestamptz,timestamptz,text,uuid,text,text,text,numeric,numeric) from public, anon;
grant execute on function public.create_section_event(uuid,text,timestamptz,timestamptz,text,uuid,text,text,text,numeric,numeric) to authenticated;

drop function if exists public.update_section_event(uuid,text,timestamptz,timestamptz,text,uuid);
create or replace function public.update_section_event(
  p_event_id uuid,
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_modality text,
  p_game_style_id uuid default null,
  p_location_name text default null,
  p_location_address text default null,
  p_location_link text default null,
  p_location_lat numeric default null,
  p_location_lng numeric default null
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_section_id uuid;
  v_status text;
  v_players integer;
  v_gk boolean;
  v_def integer;
  v_mid integer;
  v_atk integer;
  v_style_section uuid;
  v_location_name text := nullif(btrim(coalesce(p_location_name, '')), '');
  v_location_address text := nullif(btrim(coalesce(p_location_address, '')), '');
  v_location_link text := nullif(btrim(coalesce(p_location_link, '')), '');
begin
  select section_id,status into v_section_id,v_status from public.events where id=p_event_id;
  if not found then raise exception 'Jogo não encontrado.'; end if;
  if auth.uid() is null or not public.is_section_admin(v_section_id) then
    raise exception 'Somente o administrador da seção pode editar este jogo.' using errcode = '42501';
  end if;
  if v_status = 'canceled' then raise exception 'O jogo está cancelado. Reative o jogo antes de editá-lo.'; end if;
  perform public.validate_event_location(v_location_name, v_location_address, v_location_link, p_location_lat, p_location_lng);
  if p_modality = 'custom' then
    if p_game_style_id is null then raise exception 'Escolha um estilo personalizado para o jogo.'; end if;
    select section_id,players_per_team,has_goalkeeper,defenders,midfielders,attackers
      into v_style_section,v_players,v_gk,v_def,v_mid,v_atk from public.game_styles where id=p_game_style_id;
    if v_style_section is distinct from v_section_id then raise exception 'O estilo não pertence à seção deste jogo.'; end if;
  elsif p_modality = 'futsal' then v_players:=5;v_gk:=true;v_def:=1;v_mid:=2;v_atk:=1;
  elsif p_modality = 'fut7' then v_players:=7;v_gk:=true;v_def:=2;v_mid:=3;v_atk:=1;
  elsif p_modality = 'campo11' then v_players:=11;v_gk:=true;v_def:=4;v_mid:=3;v_atk:=3;
  else raise exception 'Modalidade de jogo inválida.';
  end if;
  update public.events set
    title=btrim(p_title),starts_at=p_starts_at,ends_at=p_ends_at,modality=p_modality,
    game_style_id=case when p_modality='custom' then p_game_style_id else null end,
    players_per_team=v_players,has_goalkeeper=v_gk,defenders=v_def,midfielders=v_mid,attackers=v_atk,
    location_name=coalesce(v_location_name,''),location_address=v_location_address,location_link=v_location_link,
    location_lat=p_location_lat,location_lng=p_location_lng
  where id=p_event_id;
end;
$$;
revoke all on function public.update_section_event(uuid,text,timestamptz,timestamptz,text,uuid,text,text,text,numeric,numeric) from public, anon;
grant execute on function public.update_section_event(uuid,text,timestamptz,timestamptz,text,uuid,text,text,text,numeric,numeric) to authenticated;

create or replace function public.reactivate_section_event(p_event_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_section_id uuid;
begin
  select section_id into v_section_id from public.events where id=p_event_id;
  if not found then raise exception 'Jogo não encontrado.'; end if;
  if auth.uid() is null or not public.is_section_admin(v_section_id) then
    raise exception 'Somente o administrador da seção pode reativar este jogo.' using errcode = '42501';
  end if;
  update public.events set status='scheduled',canceled_at=null where id=p_event_id;
  insert into public.event_attendance(event_id,player_id)
  select p_event_id,sp.id from public.section_players sp where sp.section_id=v_section_id on conflict (event_id,player_id) do nothing;
end;
$$;
revoke all on function public.reactivate_section_event(uuid) from public, anon;
grant execute on function public.reactivate_section_event(uuid) to authenticated;
