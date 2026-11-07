alter table public.section_players
  add constraint section_players_photo_url_size_check
  check (photo_url is null or length(photo_url) <= 2000000);

create or replace function public.normalize_section_player_data()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  skill_key text;
  skill_value integer;
  metric_value integer;
begin
  if new.position not in ('GOL', 'ZAG', 'LAT', 'VOL', 'MEI', 'ATA') then
    raise exception 'Posição inválida para o jogador.';
  end if;

  if jsonb_typeof(coalesce(new.skills, '{}'::jsonb)) <> 'object' then
    raise exception 'Skills devem ser um objeto JSON.';
  end if;

  if new.position = 'GOL' then
    for skill_key in select key from jsonb_object_keys(coalesce(new.skills, '{}'::jsonb)) as key loop
      skill_value := coalesce((new.skills->>skill_key)::int, 1);
      skill_value := least(99, greatest(1, skill_value));
      new.skills := jsonb_set(new.skills, array[skill_key], to_jsonb(skill_value), true);
    end loop;

    new.overall := (
      select round(avg(value::int))
      from jsonb_each_text(new.skills) as kv(key, value)
      where kv.key in ('MER', 'MAN', 'CHU', 'REF', 'VEL', 'POS')
    );
  else
    new.skills := jsonb_set(new.skills, '{RIT}', to_jsonb(least(99, greatest(1, coalesce((new.skills->>'RIT')::int, 1)))), true);
    new.skills := jsonb_set(new.skills, '{CHU}', to_jsonb(least(99, greatest(1, coalesce((new.skills->>'CHU')::int, 1)))), true);
    new.skills := jsonb_set(new.skills, '{PAS}', to_jsonb(least(99, greatest(1, coalesce((new.skills->>'PAS')::int, 1)))), true);
    new.skills := jsonb_set(new.skills, '{DRI}', to_jsonb(least(99, greatest(1, coalesce((new.skills->>'DRI')::int, 1)))), true);
    new.skills := jsonb_set(new.skills, '{DEF}', to_jsonb(least(99, greatest(1, coalesce((new.skills->>'DEF')::int, 1)))), true);
    new.skills := jsonb_set(new.skills, '{FIS}', to_jsonb(least(99, greatest(1, coalesce((new.skills->>'FIS')::int, 1)))), true);

    new.overall := (
      select round(
        (
          coalesce((new.skills->>'RIT')::int, 1) * 0.2 +
          coalesce((new.skills->>'CHU')::int, 1) * 0.3 +
          coalesce((new.skills->>'PAS')::int, 1) * 0.1 +
          coalesce((new.skills->>'DRI')::int, 1) * 0.25 +
          coalesce((new.skills->>'DEF')::int, 1) * 0.0 +
          coalesce((new.skills->>'FIS')::int, 1) * 0.15
        )::numeric
      )
    );
  end if;

  new.weak_foot := least(5, greatest(0, coalesce(new.weak_foot, 0)));
  new.overall := least(99, greatest(1, coalesce(new.overall, 1)));

  return new;
end;
$$;

create trigger section_players_server_validation
  before insert or update on public.section_players
  for each row
  execute function public.normalize_section_player_data();
