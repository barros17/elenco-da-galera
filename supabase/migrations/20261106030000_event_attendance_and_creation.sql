grant select, insert on public.events to authenticated;
grant select, insert, update on public.event_attendance to authenticated;

insert into public.event_attendance (event_id, player_id)
select e.id, sp.id
from public.events e
join public.section_players sp on sp.section_id = e.section_id
on conflict (event_id, player_id) do nothing;

create or replace function public.add_player_to_scheduled_event_attendance()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.event_attendance (event_id, player_id)
  select e.id, new.id
  from public.events e
  where e.section_id = new.section_id
    and e.status = 'scheduled'
  on conflict (event_id, player_id) do nothing;

  return new;
end;
$$;

create trigger section_player_event_attendance
  after insert on public.section_players
  for each row execute function public.add_player_to_scheduled_event_attendance();

revoke all on function public.add_player_to_scheduled_event_attendance() from public, anon, authenticated;

create or replace function public.create_section_event(
  p_section_id uuid,
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_modality text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_id uuid;
begin
  if auth.uid() is null or not public.is_section_admin(p_section_id) then
    raise exception 'Somente o administrador pode criar jogos para a seção.'
      using errcode = '42501';
  end if;

  insert into public.events (
    section_id,
    title,
    starts_at,
    ends_at,
    modality,
    created_by
  )
  values (
    p_section_id,
    p_title,
    p_starts_at,
    p_ends_at,
    p_modality,
    auth.uid()
  )
  returning id into v_event_id;

  insert into public.event_attendance (event_id, player_id)
  select v_event_id, sp.id
  from public.section_players sp
  where sp.section_id = p_section_id
  on conflict (event_id, player_id) do nothing;

  return v_event_id;
end;
$$;

revoke all on function public.create_section_event(uuid, text, timestamptz, timestamptz, text)
  from public, anon;
grant execute on function public.create_section_event(uuid, text, timestamptz, timestamptz, text)
  to authenticated;