begin;

do $$
declare
  admin_id uuid := gen_random_uuid();
  other_member_id uuid := gen_random_uuid();
  no_section_id uuid := gen_random_uuid();
  event_section_id uuid;
  other_section_id uuid;
  event_player_id uuid;
  own_event_id uuid;
  foreign_event_id uuid;
begin
  insert into auth.users (
    id, aud, role, email, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  )
  values
    (admin_id, 'authenticated', 'authenticated', admin_id::text || '@rls-test.invalid',
      now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
    (other_member_id, 'authenticated', 'authenticated', other_member_id::text || '@rls-test.invalid',
      now(), now(), '{"provider":"email","providers":["email"]}', '{}');

  insert into public.sections (name, created_by)
  values ('Seção privada de teste', admin_id)
  returning id into event_section_id;
  insert into public.section_members (section_id, user_id)
  values (event_section_id, admin_id);

  insert into public.sections (name, created_by)
  values ('Outra seção de teste', other_member_id)
  returning id into other_section_id;
  insert into public.section_members (section_id, user_id)
  values (other_section_id, other_member_id);

  insert into public.section_players (
    section_id, name, position, skills, weak_foot, overall, created_by
  )
  values (
    event_section_id, 'Carta privada', 'ZAG',
    '{"RIT":60,"CHU":40,"PAS":70,"DRI":65,"DEF":90,"FIS":85}', 0, 99, admin_id
  )
  returning id into event_player_id;

  insert into public.events (
    section_id, title, starts_at, ends_at, modality, players_per_team, has_goalkeeper, defenders, midfielders, attackers, created_by
  )
  values (
    event_section_id, 'Jogo privado de teste', now() + interval '1 day',
    now() + interval '1 day 2 hours', 'futsal', 5, true, 1, 2, 1, admin_id
  )
  returning id into own_event_id;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  insert into public.event_attendance (event_id, player_id)
  values (own_event_id, event_player_id);

  insert into public.events (
    section_id, title, starts_at, ends_at, modality, players_per_team, has_goalkeeper, defenders, midfielders, attackers, created_by
  )
  values (
    other_section_id, 'Jogo da outra seção', now() + interval '1 day',
    now() + interval '1 day 2 hours', 'futsal', 5, true, 1, 2, 1, other_member_id
  )
  returning id into foreign_event_id;

  perform set_config('test_rls.no_section_id', no_section_id::text, true);
  perform set_config('test_rls.other_member_id', other_member_id::text, true);
  perform set_config('test_rls.own_event_id', own_event_id::text, true);
  perform set_config('test_rls.foreign_event_id', foreign_event_id::text, true);
end;
$$;

do $$
declare
  unsafe_routine record;
begin
  if to_regprocedure('public.event_waitlist_order(uuid)') is not null
    or to_regprocedure('public.event_attendance_is_confirmed(text)') is not null
  then
    raise exception 'Uma view ou função de presença não utilizada continua exposta.';
  end if;

  if has_table_privilege('anon', 'public.events', 'SELECT')
    or has_table_privilege('anon', 'public.event_attendance', 'SELECT')
    or has_table_privilege('anon', 'public.event_draw_eligible', 'SELECT')
  then
    raise exception 'O papel anon ainda tem permissão de leitura de eventos ou presenças.';
  end if;

  select routine_schema, routine_name, grantee
  into unsafe_routine
  from information_schema.routine_privileges
  where routine_schema = 'public'
    and grantee in ('PUBLIC', 'anon')
    and privilege_type = 'EXECUTE'
  limit 1;
  if found then
    raise exception 'Execução exposta em public.%. Grantee: %.',
      unsafe_routine.routine_name, unsafe_routine.grantee;
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test_rls.no_section_id'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  visible_events integer;
  visible_attendance integer;
begin
  select count(*) into visible_events from public.events;
  select count(*) into visible_attendance from public.event_attendance;
  if visible_events <> 0 or visible_attendance <> 0 then
    raise exception 'Usuário sem seção leu % jogos e % presenças.',
      visible_events, visible_attendance;
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test_rls.other_member_id'), true);
do $$
declare
  visible_events integer;
  visible_attendance integer;
  own_event_id uuid := current_setting('test_rls.own_event_id')::uuid;
  visible_own_events integer;
begin
  select count(*) into visible_events
  from public.events
  where id = own_event_id;
  select count(*) into visible_attendance
  from public.event_attendance ea
  join public.events e on e.id = ea.event_id
  where e.id = own_event_id;
  select count(*) into visible_own_events
  from public.events
  where id = current_setting('test_rls.foreign_event_id')::uuid;
  if visible_events <> 0 or visible_attendance <> 0 or visible_own_events <> 1 then
    raise exception 'Membro de outra seção leu dados fora da própria seção.';
  end if;
end;
$$;

reset role;
set local role anon;
do $$
declare
  read_succeeded boolean := false;
begin
  begin
    perform count(*) from public.events;
    read_succeeded := true;
  exception when insufficient_privilege then
    null;
  end;
  if read_succeeded then
    raise exception 'O papel anon conseguiu consultar eventos.';
  end if;

  read_succeeded := false;
  begin
    perform count(*) from public.event_attendance;
    read_succeeded := true;
  exception when insufficient_privilege then
    null;
  end;
  if read_succeeded then
    raise exception 'O papel anon conseguiu consultar presenças.';
  end if;
end;
$$;

reset role;
select routine_name, specific_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and grantee = 'authenticated'
  and privilege_type = 'EXECUTE'
order by routine_name, specific_name;

rollback;
