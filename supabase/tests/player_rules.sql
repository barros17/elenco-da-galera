begin;

create temporary table player_rules_players (
  id uuid primary key default gen_random_uuid(),
  name text,
  position text,
  skills jsonb,
  weak_foot integer,
  overall integer,
  photo_url text
);

create temporary table player_rules_section_players (
  id uuid primary key default gen_random_uuid(),
  name text,
  position text,
  skills jsonb,
  weak_foot integer,
  overall integer,
  photo_url text
);

create trigger player_rules_players_trigger
  before insert or update on player_rules_players
  for each row execute function public.enforce_player_rules();
create trigger player_rules_section_players_trigger
  before insert or update on player_rules_section_players
  for each row execute function public.enforce_player_rules();

do $$
declare
  target_table text;
  player_id uuid;
  result integer;
  expected_overall integer;
  normalized jsonb;
  should_fail boolean;
  extra_skill text;
  test_position text;
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'players_enforce_player_rules'
      and tgrelid = 'public.players'::regclass
      and not tgisinternal
  ) or not exists (
    select 1 from pg_trigger
    where tgname = 'section_players_enforce_player_rules'
      and tgrelid = 'public.section_players'::regclass
      and not tgisinternal
  ) then
    raise exception 'Os triggers de validação não estão instalados nas tabelas reais.';
  end if;

  foreach target_table in array array['player_rules_players', 'player_rules_section_players'] loop
    foreach test_position in array array['ATA', 'MEI', 'VOL', 'LAT', 'ZAG'] loop
      execute format(
        'insert into %I (name, position, skills, overall) values ($1, $2, $3, 99) returning overall',
        target_table
      )
      into result
      using 'Regressão ' || test_position, test_position,
        '{"RIT":60,"CHU":40,"PAS":70,"DRI":65,"DEF":90,"FIS":85}'::jsonb;

      expected_overall := case test_position
        when 'ATA' then 60
        when 'MEI' then 67
        when 'VOL' then 75
        when 'LAT' then 73
        when 'ZAG' then 82
      end;
      if result <> expected_overall then
        raise exception 'Overall incorreto para %: esperado %, obtido %.',
          test_position, expected_overall, result;
      end if;
    end loop;

    execute format(
      'insert into %I (name, position, skills, weak_foot, overall) values ($1, $2, $3, 99, 99) returning id, overall',
      target_table
    )
    into player_id, result
    using '  Teste  ', 'ZAG',
      '{"RIT":60,"CHU":40,"PAS":70,"DRI":65,"DEF":90,"FIS":85}'::jsonb;

    if result <> 82 then
      raise exception 'O overall ZAG deveria ser 82, mas foi %.', result;
    end if;

    execute format('select name, weak_foot from %I where id = $1', target_table)
      into extra_skill, result using player_id;
    if extra_skill <> 'Teste' or result <> 5 then
      raise exception 'O nome não foi aparado ou o pé fraco não foi limitado.';
    end if;

    execute format('update %I set overall = 99 where id = $1 returning overall', target_table)
      into result using player_id;
    if result <> 82 then
      raise exception 'A alteração direta de overall não foi sobrescrita.';
    end if;

    execute format(
      'update %I set position = $2, skills = $3 where id = $1 returning overall',
      target_table
    )
    into result
    using player_id, 'GOL',
      '{"MER":70,"MAN":80,"CHU":60,"REF":90,"VEL":75,"POS":65}'::jsonb;
    if result <> 73 then
      raise exception 'A troca de posição para GOL deveria resultar em 73, mas foi %.', result;
    end if;

    execute format(
      'insert into %I (name, position, skills, overall) values ($1, $2, $3, 99) returning id, skills',
      target_table
    )
    into player_id, normalized
    using 'Decimal', 'ATA',
      '{"RIT":70.5,"CHU":"inválido","PAS":null,"DRI":2,"DEF":3,"FIS":4,"EXTRA":99}'::jsonb;
    if normalized ->> 'RIT' <> '71'
      or normalized ->> 'CHU' <> '1'
      or normalized ? 'EXTRA'
      or (select count(*) from jsonb_object_keys(normalized)) <> 6
    then
      raise exception 'As habilidades decimais ou desconhecidas não foram normalizadas.';
    end if;

    execute format(
      'insert into %I (name, position, skills, overall) values ($1, $2, $3, 99) returning overall',
      target_table
    )
    into result
    using 'Mínimo', 'ATA',
      '{"RIT":1,"CHU":1,"PAS":1,"DRI":1,"DEF":1,"FIS":1}'::jsonb;
    if result <> 1 then raise exception 'Overall mínimo esperado: 1.'; end if;

    execute format(
      'insert into %I (name, position, skills, overall) values ($1, $2, $3, 1) returning overall',
      target_table
    )
    into result
    using 'Máximo', 'ATA',
      '{"RIT":99,"CHU":99,"PAS":99,"DRI":99,"DEF":99,"FIS":99}'::jsonb;
    if result <> 99 then raise exception 'Overall máximo esperado: 99.'; end if;

    execute format(
      'insert into %I (name, position, skills, overall) values ($1, $2, $3, 1) returning overall',
      target_table
    )
    into result
    using 'Meio exato', 'ATA',
      '{"RIT":70,"CHU":70,"PAS":70,"DRI":72,"DEF":70,"FIS":70}'::jsonb;
    if result <> 71 then raise exception 'Meio exato deveria arredondar para 71.'; end if;

    should_fail := false;
    begin
      execute format('insert into %I (name, position, skills) values ($1, $2, $3)', target_table)
        using '', 'ATA', '{}'::jsonb;
    exception when others then should_fail := true;
    end;
    if not should_fail then raise exception 'Nome vazio foi aceito.'; end if;

    should_fail := false;
    begin
      execute format('insert into %I (name, position, skills) values ($1, $2, $3)', target_table)
        using repeat('x', 41), 'ATA', '{}'::jsonb;
    exception when others then should_fail := true;
    end;
    if not should_fail then raise exception 'Nome com 41 caracteres foi aceito.'; end if;

    should_fail := false;
    begin
      execute format('insert into %I (name, position, skills) values ($1, $2, $3)', target_table)
        using 'Skills inválidas', 'ATA', '[]'::jsonb;
    exception when others then should_fail := true;
    end;
    if not should_fail then raise exception 'Skills que não são objeto foram aceitas.'; end if;

    should_fail := false;
    begin
      execute format(
        'insert into %I (name, position, skills, photo_url) values ($1, $2, $3, $4)',
        target_table
      ) using 'Foto HTTP', 'ATA', '{}'::jsonb, 'http://example.com/foto.png';
    exception when others then should_fail := true;
    end;
    if not should_fail then raise exception 'Foto com HTTP foi aceita.'; end if;

    should_fail := false;
    begin
      execute format(
        'insert into %I (name, position, skills, photo_url) values ($1, $2, $3, $4)',
        target_table
      ) using 'Foto JavaScript', 'ATA', '{}'::jsonb, 'javascript:alert(1)';
    exception when others then should_fail := true;
    end;
    if not should_fail then raise exception 'Foto com javascript: foi aceita.'; end if;

    should_fail := false;
    begin
      execute format(
        'insert into %I (name, position, skills, photo_url) values ($1, $2, $3, $4)',
        target_table
      ) using 'Foto grande', 'ATA', '{}'::jsonb, repeat('a', 1500001);
    exception when others then should_fail := true;
    end;
    if not should_fail then raise exception 'Foto acima do limite foi aceita.'; end if;
  end loop;
end;
$$;

rollback;
