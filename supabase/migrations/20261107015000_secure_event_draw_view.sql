revoke all on public.event_draw_eligible from public, anon;
grant select on public.event_draw_eligible to authenticated;

drop function if exists public.event_waitlist_order(uuid);
drop function if exists public.event_attendance_is_confirmed(text);
