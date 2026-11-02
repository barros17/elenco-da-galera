create table public.events (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 80),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  location_name text not null default '',
  location_address text,
  location_link text,
  modality text not null check (modality in ('futsal', 'fut7', 'campo11')),
  description text default '',
  confirmation_deadline timestamptz,
  vacancy_count integer not null default 0 check (vacancy_count >= 0),
  status text not null default 'scheduled' check (status in ('scheduled', 'canceled')),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  canceled_at timestamptz
);

create index events_section_id_starts_at_idx
  on public.events (section_id, starts_at);

create table public.event_attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  player_id uuid not null references public.section_players (id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING', 'CONFIRMED', 'DECLINED')),
  responded_at timestamptz,
  responded_by uuid references auth.users (id) on delete set null,
  waitlist_position integer,
  constraint event_attendance_unique_player_per_event unique (event_id, player_id)
);

create index event_attendance_event_status_idx
  on public.event_attendance (event_id, status, waitlist_position);

alter table public.events enable row level security;
alter table public.event_attendance enable row level security;

revoke all on public.events from anon, authenticated;
revoke all on public.event_attendance from anon, authenticated;

-- As permissões são controladas por membership da seção e pela regra de admin.

create policy "Section members can view events"
  on public.events for select
  to authenticated
  using ((select public.is_section_member(section_id)));

create policy "Admins can manage events"
  on public.events for all
  to authenticated
  using ((select public.is_section_admin(section_id)))
  with check ((select public.is_section_admin(section_id)));

create policy "Members can view attendance"
  on public.event_attendance for select
  to authenticated
  using ((select public.is_section_member((select section_id from public.events where id = event_id))));

create policy "Players can manage their own attendance"
  on public.event_attendance for insert
  to authenticated
  with check (
    (select public.is_section_member((select section_id from public.events where id = event_id)))
    and (
      player_id in (
        select sp.id from public.section_players sp
        where sp.user_id = (select auth.uid())
      )
      or (select public.is_section_admin((select section_id from public.events where id = event_id)))
    )
  );

create policy "Players can update their own attendance"
  on public.event_attendance for update
  to authenticated
  using (
    (select public.is_section_admin((select section_id from public.events where id = event_id)))
    or (
      player_id in (
        select sp.id from public.section_players sp
        where sp.user_id = (select auth.uid())
      )
    )
  )
  with check (
    (select public.is_section_admin((select section_id from public.events where id = event_id)))
    or (
      player_id in (
        select sp.id from public.section_players sp
        where sp.user_id = (select auth.uid())
      )
    )
  );

create or replace function public.event_attendance_is_confirmed(p_status text)
returns boolean
language sql
stable
as $$
  select p_status = 'CONFIRMED';
$$;

create or replace function public.event_waitlist_order(p_event_id uuid)
returns table (player_id uuid, waitlist_position integer, responded_at timestamptz)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    ea.player_id,
    ea.waitlist_position,
    ea.responded_at
  from public.event_attendance ea
  where ea.event_id = p_event_id
    and ea.status = 'CONFIRMED'
  order by ea.waitlist_position asc nulls last,
           ea.responded_at asc nulls last,
           ea.id asc;
$$;

create or replace function public.ensure_event_attendance_state()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status not in ('PENDING', 'CONFIRMED', 'DECLINED') then
    raise exception 'Status de presença inválido.';
  end if;

  if new.status = 'CONFIRMED' then
    new.responded_at = coalesce(new.responded_at, now());
  end if;

  if new.status <> 'CONFIRMED' and new.waitlist_position is not null then
    new.waitlist_position = null;
  end if;

  return new;
end;
$$;

create trigger event_attendance_state_guard
  before insert or update on public.event_attendance
  for each row execute function public.ensure_event_attendance_state();

create or replace view public.event_draw_eligible as
  select
    ea.event_id,
    ea.player_id,
    ea.status,
    ea.waitlist_position,
    ea.responded_at
  from public.event_attendance ea
  where ea.status = 'CONFIRMED';
