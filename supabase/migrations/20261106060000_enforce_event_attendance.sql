create or replace function public.enforce_event_attendance_rules()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  event_section_id uuid;
  event_status text;
  confirmation_deadline timestamptz;
  player_section_id uuid;
  player_user_id uuid;
  is_admin boolean;
begin
  if tg_op = 'UPDATE' then
    if new.event_id is distinct from old.event_id
      or new.player_id is distinct from old.player_id
      or new.waitlist_position is distinct from old.waitlist_position
    then
      if not public.is_section_admin(
        (select section_id from public.events where id = old.event_id)
      ) then
        raise exception 'Somente o administrador pode alterar o jogo, jogador ou posição na lista.';
      end if;
    end if;
  elsif new.waitlist_position is not null
    and not public.is_section_admin(
      (select section_id from public.events where id = new.event_id)
    )
  then
    raise exception 'Somente o administrador pode definir a posição na lista.';
  end if;

  select e.section_id, e.status, e.confirmation_deadline
  into event_section_id, event_status, confirmation_deadline
  from public.events e
  where e.id = new.event_id;
  if not found then
    raise exception 'O jogo informado não existe.';
  end if;

  select sp.section_id, sp.user_id
  into player_section_id, player_user_id
  from public.section_players sp
  where sp.id = new.player_id;
  if not found or player_section_id <> event_section_id then
    raise exception 'O jogador precisa pertencer à mesma seção do jogo.';
  end if;

  is_admin := public.is_section_admin(event_section_id);
  if not is_admin then
    if auth.uid() is null then
      raise exception 'Faça login para responder à presença.'
        using errcode = '42501';
    end if;

    new.responded_by := auth.uid();
    if player_user_id is distinct from auth.uid() then
      raise exception 'Você só pode responder pela sua própria carta.'
        using errcode = '42501';
    end if;

    if tg_op = 'INSERT' or new.status is distinct from old.status then
      if event_status = 'canceled' then
        raise exception 'Não é possível alterar presença em um jogo cancelado.';
      end if;
      if confirmation_deadline is not null and confirmation_deadline <= now() then
        raise exception 'O prazo para confirmar presença já terminou.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_event_attendance_rules() from public, anon, authenticated;

drop trigger if exists event_attendance_integrity on public.event_attendance;
create trigger event_attendance_integrity
  before insert or update on public.event_attendance
  for each row execute function public.enforce_event_attendance_rules();

drop policy if exists "Players can manage their own attendance" on public.event_attendance;
create policy "Players can manage their own attendance"
  on public.event_attendance for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.events e
      join public.section_players sp
        on sp.section_id = e.section_id
      where e.id = event_id
        and sp.id = player_id
        and (select public.is_section_member(e.section_id))
        and (
          sp.user_id = (select auth.uid())
          or (select public.is_section_admin(e.section_id))
        )
    )
  );

revoke insert on public.events from authenticated;
