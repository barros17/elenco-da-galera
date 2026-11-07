begin;

do $$
declare
  admin_id uuid := gen_random_uuid(); member_id uuid := gen_random_uuid(); other_admin_id uuid := gen_random_uuid();
  section_id uuid; other_section_id uuid; player_id uuid; member_player_id uuid;
begin
  insert into auth.users (id, aud, role, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (admin_id, 'authenticated', 'authenticated', admin_id::text || '@styles.invalid', now(), now(), '{}', '{}'),
    (member_id, 'authenticated', 'authenticated', member_id::text || '@styles.invalid', now(), now(), '{}', '{}'),
    (other_admin_id, 'authenticated', 'authenticated', other_admin_id::text || '@styles.invalid', now(), now(), '{}', '{}');
  perform set_config('request.jwt.claim.role', 'authenticated', false);
  perform set_config('request.jwt.claim.sub', admin_id::text, false);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', admin_id)::text,
    false
  );
  execute 'set local role authenticated';
  section_id := public.create_section('Seção de estilos');
  execute 'reset role';

  perform set_config('request.jwt.claim.sub', other_admin_id::text, false);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', other_admin_id)::text,
    false
  );
  execute 'set local role authenticated';
  other_section_id := public.create_section('Outra seção');
  execute 'reset role';

  insert into public.section_members (section_id, user_id)
  values (section_id, member_id);
  insert into public.section_players (section_id, user_id, name, position, skills, created_by)
  values (section_id, admin_id, 'Jogador de teste', 'ATA', '{}', admin_id) returning id into player_id;
  insert into public.section_players (section_id, user_id, name, position, skills, created_by)
  values (section_id, member_id, 'Jogador do membro', 'ATA', '{}', admin_id) returning id into member_player_id;
  perform set_config('test_styles.admin_id', admin_id::text, true);
  perform set_config('test_styles.member_id', member_id::text, true);
  perform set_config('test_styles.other_admin_id', other_admin_id::text, true);
  perform set_config('test_styles.section_id', section_id::text, true);
  perform set_config('test_styles.other_section_id', other_section_id::text, true);
  perform set_config('test_styles.player_id', player_id::text, true);
  perform set_config('test_styles.member_player_id', member_player_id::text, true);
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claim.sub', current_setting('test_styles.admin_id'), false);
select set_config(
  'request.jwt.claims',
  json_build_object('role', 'authenticated', 'sub', current_setting('test_styles.admin_id'))::text,
  false
);

do $$
declare
  style_id uuid; foreign_style_id uuid; v_event_id uuid; v_protected_id uuid; attendance_count integer; rejected boolean; snapshot record;
begin
  style_id := public.create_game_style(current_setting('test_styles.section_id')::uuid, '4x4 sem goleiro', 4, false, 1, 2, 1);

  perform set_config('request.jwt.claim.sub', current_setting('test_styles.other_admin_id'), false);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', current_setting('test_styles.other_admin_id'))::text,
    false
  );
  foreign_style_id := public.create_game_style(current_setting('test_styles.other_section_id')::uuid, 'Estilo externo', 4, false, 1, 2, 1);

  perform set_config('request.jwt.claim.sub', current_setting('test_styles.admin_id'), false);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', current_setting('test_styles.admin_id'))::text,
    false
  );
  v_event_id := public.create_section_event(current_setting('test_styles.section_id')::uuid, 'Jogo custom', now() + interval '1 day', now() + interval '1 day 2 hours', 'custom', style_id);
  select count(*) into attendance_count from public.event_attendance ea where ea.event_id = v_event_id;
  if attendance_count <> 2 then raise exception 'Criar jogo não criou as presenças iniciais.'; end if;
  rejected := false;
  begin
    perform public.update_section_event(v_event_id, 'Formato inválido', now() + interval '1 day', now() + interval '1 day 2 hours', 'custom', foreign_style_id);
  exception when others then rejected := true; end;
  if not rejected then raise exception 'Evento aceitou estilo de outra seção.'; end if;
  perform public.update_section_event(v_event_id, 'Jogo fut7', now() + interval '1 day', now() + interval '1 day 2 hours', 'fut7');
  select e.players_per_team, e.has_goalkeeper, e.defenders, e.midfielders, e.attackers into snapshot from public.events e where e.id = v_event_id;
  if snapshot.players_per_team <> 7 or not snapshot.has_goalkeeper or snapshot.defenders <> 2 or snapshot.midfielders <> 3 or snapshot.attackers <> 1 then raise exception 'Snapshot não foi regravado ao trocar para preset.'; end if;
  select count(*) into attendance_count from public.event_attendance ea where ea.event_id = v_event_id;
  if attendance_count <> 2 then raise exception 'Editar o jogo apagou presenças.'; end if;
  perform public.cancel_section_event(v_event_id);

  perform set_config('request.jwt.claim.sub', current_setting('test_styles.member_id'), false);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', current_setting('test_styles.member_id'))::text,
    false
  );
  rejected := false;
  begin
    update public.event_attendance
    set status = 'CONFIRMED'
    where event_attendance.event_id = v_event_id
      and event_attendance.player_id = current_setting('test_styles.member_player_id')::uuid;
  exception when others then rejected := true; end;
  if not rejected then raise exception 'Presença em jogo cancelado foi aceita.'; end if;

  perform set_config('request.jwt.claim.sub', current_setting('test_styles.admin_id'), false);
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', current_setting('test_styles.admin_id'))::text,
    false
  );
  perform public.reactivate_section_event(v_event_id);
  perform public.delete_section_event(v_event_id);
  if exists (select 1 from public.event_attendance ea where ea.event_id = v_event_id) then raise exception 'Excluir jogo não removeu presenças.'; end if;
  v_protected_id := public.create_section_event(current_setting('test_styles.section_id')::uuid, 'Jogo protegido', now() + interval '2 days', now() + interval '2 days 2 hours', 'futsal');
  perform set_config('test_styles.protected_event_id', v_protected_id::text, true);
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test_styles.member_id'), false);
select set_config(
  'request.jwt.claims',
  json_build_object('role', 'authenticated', 'sub', current_setting('test_styles.member_id'))::text,
  false
);
do $$
declare rejected boolean := false;
begin
  begin perform public.cancel_section_event(gen_random_uuid()); exception when others then rejected := true; end;
  if not rejected then raise exception 'Membro comum conseguiu cancelar jogo.'; end if;
  rejected := false;
  begin update public.events set title = 'Alterado diretamente' where id = current_setting('test_styles.protected_event_id')::uuid; exception when others then rejected := true; end;
  if not rejected then raise exception 'Membro comum conseguiu editar evento diretamente.'; end if;
  rejected := false;
  begin delete from public.events where id = current_setting('test_styles.protected_event_id')::uuid; exception when others then rejected := true; end;
  if not rejected then raise exception 'Membro comum conseguiu excluir evento diretamente.'; end if;
  if has_table_privilege('authenticated', 'public.events', 'UPDATE') or has_table_privilege('authenticated', 'public.events', 'DELETE') then raise exception 'Authenticated ainda pode editar ou excluir eventos diretamente.'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test_styles.other_admin_id'), false);
select set_config(
  'request.jwt.claims',
  json_build_object('role', 'authenticated', 'sub', current_setting('test_styles.other_admin_id'))::text,
  false
);
do $$
declare rejected boolean := false;
begin
  begin perform public.delete_section_event(current_setting('test_styles.protected_event_id')::uuid); exception when others then rejected := true; end;
  if not rejected then raise exception 'Admin de outra seção conseguiu excluir jogo.'; end if;
end;
$$;

rollback;
