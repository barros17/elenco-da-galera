drop view if exists public.event_draw_eligible;
drop function if exists public.event_waitlist_order(uuid);
drop function if exists public.event_attendance_is_confirmed(text);

revoke execute on all functions in schema public from public, anon;
alter default privileges in schema public revoke execute on functions from public;

grant execute on function public.player_skill_keys(text) to authenticated;
grant execute on function public.normalize_player_skills(text, jsonb) to authenticated;
grant execute on function public.calc_player_overall(text, jsonb) to authenticated;
grant execute on function public.is_section_member(uuid) to authenticated;
grant execute on function public.is_section_admin(uuid) to authenticated;
grant execute on function public.create_section(text) to authenticated;
grant execute on function public.join_section(text) to authenticated;
grant execute on function public.get_my_section() to authenticated;
grant execute on function public.get_section_members(uuid) to authenticated;
grant execute on function public.leave_section(uuid) to authenticated;
grant execute on function public.remove_section_member(uuid, uuid) to authenticated;
grant execute on function public.delete_section(uuid) to authenticated;
grant execute on function public.create_section_event(uuid, text, timestamptz, timestamptz, text)
  to authenticated;
