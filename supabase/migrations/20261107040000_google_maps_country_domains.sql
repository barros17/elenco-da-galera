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
  v_path text;
begin
  if p_location_name is not null and char_length(btrim(p_location_name)) > 80 then
    raise exception 'O nome do local deve ter no máximo 80 caracteres.';
  end if;
  if p_location_address is not null and char_length(btrim(p_location_address)) > 200 then
    raise exception 'O endereço deve ter no máximo 200 caracteres.';
  end if;
  if v_link is not null then
    if char_length(v_link) > 500
      or v_link !~* '^https://[^/?#:@]+(?:/[^?#]*)?(?:\?[^#]*)?(?:#.*)?$' then
      raise exception 'Link inválido. Cole um link do Google Maps (google.com/maps, google.com.br/maps ou maps.app.goo.gl). No app do Maps, use Compartilhar e copie o link.';
    end if;
    v_host := lower((regexp_match(v_link, '^https://([^/?#:@]+)'))[1]);
    v_path := coalesce((regexp_match(v_link, '^https://[^/?#:@]+([^?#]*)'))[1], '');
    if v_host = 'maps.app.goo.gl' then
      null;
    elsif v_host = 'goo.gl' then
      if v_path <> '/maps' and v_path !~* '^/maps/' then
        raise exception 'Link inválido. Cole um link do Google Maps (google.com/maps, google.com.br/maps ou maps.app.goo.gl). No app do Maps, use Compartilhar e copie o link.';
      end if;
    elsif v_host ~ '^(www\.|maps\.)?google\.(com|com\.[a-z]{2}|co\.[a-z]{2}|[a-z]{2})$' then
      if v_host !~ '^maps\.google\.' and v_path <> '/maps' and v_path !~* '^/maps/' then
        raise exception 'Link inválido. Cole um link do Google Maps (google.com/maps, google.com.br/maps ou maps.app.goo.gl). No app do Maps, use Compartilhar e copie o link.';
      end if;
    else
      raise exception 'Link inválido. Cole um link do Google Maps (google.com/maps, google.com.br/maps ou maps.app.goo.gl). No app do Maps, use Compartilhar e copie o link.';
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
