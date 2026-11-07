begin;

do $$
declare
  admin_id uuid := gen_random_uuid();
  member_id uuid := gen_random_uuid();
  other_admin_id uuid := gen_random_uuid();
  own_section_id uuid;
  other_section_id uuid;
  member_player_id uuid;
  admin_player_id uuid;
  other_player_id uuid;
  active_event_id uuid;
  canceled_event_id uuid;
  expired_event_id uuid;
  other_event_id uuid;
  attendance_id uuid;
  expired_attendance_id uuid;
begin
  insert into auth.users (
    id, aud, role, email, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  )
  values
    (admin_id, 'authenticated', 'authenticated', admin_id::text || '@attendance-test.invalid',
      now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
    (member_id, 'authenticated', 'authenticated', member_id::text || '@attendance-test.invalid',
      now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
    (other_admin_id, 'authenticated', 'authenticated', other_admin_id::text || '@attendance-test.invalid',
      now(), now(), '{"provider":"email","providers":["email"]}', '{}');

  insert into public.sections (name, created_by)
  values ('Seção de presença', admin_id)
  returning id into own_section_id;
  insert into public.section_members (section_id, user_id)
  values (own_section_id, admin_id), (own_section_id, member_id);

  insert into public.sections (name, created_by)
  values ('Outra seção de presença', other_admin_id)
  returning id into other_section_id;
  insert into public.section_members (section_id, user_id)
  values (other_section_id, other_admin_id);

  insert into public.section_players (section_id, user_id, name, position, skills, created_by)
  values (own_section_id, member_id, 'Jogador membro', 'ATA', '{}', admin_id)
  returning id into member_player_id;
  insert into public.section_players (section_id, user_id, name, position, skills, created_by)
  values (own_section_id, admin_id, 'Jogador admin', 'ATA', '{}', admin_id)
  returning id into admin_player_id;
  insert into public.section_players (section_id, user_id, name, position, skills, created_by)
  values (other_section_id, other_admin_id, 'Jogador externo', 'ATA', '{}', other_admin_id)
  returning id into other_player_id;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);

  insert into public.events (
    section_id, title, starts_at, ends_at, modality, players_per_team, has_goalkeeper, defenders, midfielders, attackers, created_by, confirmation_deadline
  )
  values (
    own_section_id, 'Jogo ativo', now() + interval '1 day',
    now() + interval '1 day 2 hours', 'futsal', 5, true, 1, 2, 1, admin_id, now() + interval '12 hours'
  )
  returning id into active_event_id;

  insert into public.events (
    section_id, title, starts_at, ends_at, modality, players_per_team, has_goalkeeper, defenders, midfielders, attackers, status, created_by
  )
  values (
    own_section_id, 'Jogo cancelado', now() + interval '2 days',
    now() + interval '2 days 2 hours', 'futsal', 5, true, 1, 2, 1, 'canceled', admin_id
  )
  returning id into canceled_event_id;

  insert into public.events (
    section_id, title, starts_at, ends_at, modality, players_per_team, has_goalkeeper, defenders, midfielders, attackers, created_by, confirmation_deadline
  )
  values (
    own_section_id, 'Jogo com prazo vencido', now() + interval '3 days',
    now() + interval '3 days 2 hours', 'futsal', 5, true, 1, 2, 1, admin_id, now() - interval '1 minute'
  )
  returning id into expired_event_id;

  insert into public.events (
    section_id, title, starts_at, ends_at, modality, players_per_team, has_goalkeeper, defenders, midfielders, attackers, created_by
  )
  values (
    other_section_id, 'Jogo externo', now() + interval '1 day',
    now() + interval '1 day 2 hours', 'futsal', 5, true, 1, 2, 1, other_admin_id
  )
  returning id into other_event_id;

  insert into public.event_attendance (event_id, player_id)
  values (active_event_id, member_player_id)
  returning id into attendance_id;
  insert into public.event_attendance (event_id, player_id)
  values (expired_event_id, member_player_id)
  returning id into expired_attendance_id;

  perform set_config('test_attendance.admin_id', admin_id::text, true);
  perform set_config('test_attendance.member_id', member_id::text, true);
  perform set_config('test_attendance.admin_player_id', admin_player_id::text, true);
  perform set_config('test_attendance.other_player_id', other_player_id::text, true);
  perform set_config('test_attendance.active_event_id', active_event_id::text, true);
  perform set_config('test_attendance.canceled_event_id', canceled_event_id::text, true);
  perform set_config('test_attendance.expired_event_id', expired_event_id::text, true);
  perform set_config('test_attendance.other_event_id', other_event_id::text, true);
  perform set_config('test_attendance.attendance_id', attendance_id::text, true);
  perform set_config('test_attendance.expired_attendance_id', expired_attendance_id::text, true);
  perform set_config('test_attendance.section_id', own_section_id::text, true);
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', current_setting('test_attendance.member_id'), true);

do $$
declare
  changed_by uuid;
  rejected boolean;
  direct_event_insert_rejected boolean := false;
begin
  update public.event_attendance
  set responded_by = current_setting('test_attendance.admin_id')::uuid
  where id = current_setting('test_attendance.attendance_id')::uuid;
  select responded_by into changed_by
  from public.event_attendance
  where id = current_setting('test_attendance.attendance_id')::uuid;
  if changed_by <> auth.uid() then
    raise exception 'responded_by não foi substituído pelo usuário autenticado.';
  end if;

  rejected := false;
  begin
    update public.event_attendance
    set waitlist_position = 1
    where id = current_setting('test_attendance.attendance_id')::uuid;
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'Membro comum alterou a posição na lista.'; end if;

  rejected := false;
  begin
    insert into public.event_attendance (event_id, player_id, waitlist_position)
    values (
      current_setting('test_attendance.active_event_id')::uuid,
      current_setting('test_attendance.admin_player_id')::uuid,
      1
    );
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'Membro comum definiu waitlist_position na inserção.'; end if;

  rejected := false;
  begin
    update public.event_attendance
    set player_id = current_setting('test_attendance.admin_player_id')::uuid
    where id = current_setting('test_attendance.attendance_id')::uuid;
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'Membro comum alterou player_id.'; end if;

  rejected := false;
  begin
    update public.event_attendance
    set event_id = current_setting('test_attendance.other_event_id')::uuid
    where id = current_setting('test_attendance.attendance_id')::uuid;
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'Membro comum alterou event_id.'; end if;

  rejected := false;
  begin
    update public.event_attendance
    set player_id = current_setting('test_attendance.admin_player_id')::uuid,
        status = 'CONFIRMED'
    where id = current_setting('test_attendance.attendance_id')::uuid;
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'Membro comum respondeu por carta de outra pessoa.'; end if;

  rejected := false;
  begin
    insert into public.event_attendance (event_id, player_id, status)
    values (
      current_setting('test_attendance.canceled_event_id')::uuid,
      (select player_id from public.event_attendance
       where id = current_setting('test_attendance.attendance_id')::uuid),
      'CONFIRMED'
    );
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'Presença em jogo cancelado foi aceita.'; end if;

  rejected := false;
  begin
    update public.event_attendance
    set status = 'CONFIRMED'
    where id = current_setting('test_attendance.expired_attendance_id')::uuid;
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'Confirmação após o prazo foi aceita.'; end if;

  if has_table_privilege('authenticated', 'public.events', 'INSERT') then
    raise exception 'Authenticated ainda pode inserir eventos diretamente.';
  end if;
  begin
    insert into public.events (
      section_id, title, starts_at, ends_at, modality, created_by
    )
    values (
      current_setting('test_attendance.section_id')::uuid, 'Inserção direta',
      now() + interval '1 day', now() + interval '1 day 2 hours', 'futsal',
      current_setting('test_attendance.admin_id')::uuid
    );
    direct_event_insert_rejected := false;
  exception when insufficient_privilege then
    direct_event_insert_rejected := true;
  end;
  if not direct_event_insert_rejected then
    raise exception 'Inserção direta de evento não foi bloqueada.';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test_attendance.admin_id'), true);
do $$
declare
  rejected boolean := false;
  created_event_id uuid;
begin
  begin
    insert into public.event_attendance (event_id, player_id)
    values (
      current_setting('test_attendance.active_event_id')::uuid,
      current_setting('test_attendance.other_player_id')::uuid
    );
  exception when others then rejected := true;
  end;
  if not rejected then
    raise exception 'Admin inseriu presença com jogador de outra seção.';
  end if;

  created_event_id := public.create_section_event(
    current_setting('test_attendance.section_id')::uuid,
    'Jogo criado pela RPC',
    now() + interval '4 days',
    now() + interval '4 days 2 hours',
    'futsal'
  );
  if created_event_id is null then
    raise exception 'A RPC administrativa não criou o evento.';
  end if;
end;
$$;

rollback;
