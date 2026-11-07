create or replace function public.set_event_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.set_event_updated_at() from public, anon, authenticated;
drop trigger if exists events_updated_at on public.events;
create trigger events_updated_at before update on public.events
for each row execute function public.set_event_updated_at();

create or replace function public.update_section_event(
  p_event_id uuid,
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_modality text,
  p_game_style_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_section_id uuid;
  v_status text;
  v_players integer;
  v_gk boolean;
  v_def integer;
  v_mid integer;
  v_atk integer;
  v_style_section uuid;
begin
  select section_id, status into v_section_id, v_status
  from public.events where id = p_event_id;
  if not found then raise exception 'Jogo não encontrado.'; end if;
  if auth.uid() is null or not public.is_section_admin(v_section_id) then
    raise exception 'Somente o administrador da seção pode editar este jogo.' using errcode = '42501';
  end if;
  if v_status = 'canceled' then
    raise exception 'O jogo está cancelado. Reative o jogo antes de editá-lo.';
  end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 80 then
    raise exception 'O título do jogo deve ter entre 1 e 80 caracteres.';
  end if;
  if p_ends_at <= p_starts_at then raise exception 'O término precisa ser depois do início.'; end if;

  if p_modality = 'custom' then
    if p_game_style_id is null then raise exception 'Escolha um estilo personalizado para o jogo.'; end if;
    select section_id, players_per_team, has_goalkeeper, defenders, midfielders, attackers
      into v_style_section, v_players, v_gk, v_def, v_mid, v_atk
    from public.game_styles where id = p_game_style_id;
    if v_style_section is distinct from v_section_id then
      raise exception 'O estilo não pertence à seção deste jogo.';
    end if;
  elsif p_modality = 'futsal' then
    v_players := 5; v_gk := true; v_def := 1; v_mid := 2; v_atk := 1;
  elsif p_modality = 'fut7' then
    v_players := 7; v_gk := true; v_def := 2; v_mid := 3; v_atk := 1;
  elsif p_modality = 'campo11' then
    v_players := 11; v_gk := true; v_def := 4; v_mid := 3; v_atk := 3;
  else
    raise exception 'Modalidade de jogo inválida.';
  end if;

  update public.events set
    title = btrim(p_title), starts_at = p_starts_at, ends_at = p_ends_at,
    modality = p_modality, game_style_id = case when p_modality = 'custom' then p_game_style_id else null end,
    players_per_team = v_players, has_goalkeeper = v_gk,
    defenders = v_def, midfielders = v_mid, attackers = v_atk
  where id = p_event_id;
end;
$$;
revoke all on function public.update_section_event(uuid,text,timestamptz,timestamptz,text,uuid) from public, anon;
grant execute on function public.update_section_event(uuid,text,timestamptz,timestamptz,text,uuid) to authenticated;

create or replace function public.cancel_section_event(p_event_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_section_id uuid;
begin
  select section_id into v_section_id from public.events where id = p_event_id;
  if not found then raise exception 'Jogo não encontrado.'; end if;
  if auth.uid() is null or not public.is_section_admin(v_section_id) then
    raise exception 'Somente o administrador da seção pode cancelar este jogo.' using errcode = '42501';
  end if;
  update public.events set status = 'canceled', canceled_at = coalesce(canceled_at, now()) where id = p_event_id;
end;
$$;
revoke all on function public.cancel_section_event(uuid) from public, anon;
grant execute on function public.cancel_section_event(uuid) to authenticated;

create or replace function public.reactivate_section_event(p_event_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_section_id uuid;
begin
  select section_id into v_section_id from public.events where id = p_event_id;
  if not found then raise exception 'Jogo não encontrado.'; end if;
  if auth.uid() is null or not public.is_section_admin(v_section_id) then
    raise exception 'Somente o administrador da seção pode reativar este jogo.' using errcode = '42501';
  end if;
  update public.events set status = 'scheduled', canceled_at = null where id = p_event_id;
end;
$$;
revoke all on function public.reactivate_section_event(uuid) from public, anon;
grant execute on function public.reactivate_section_event(uuid) to authenticated;

create or replace function public.delete_section_event(p_event_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_section_id uuid;
begin
  select section_id into v_section_id from public.events where id = p_event_id;
  if not found then raise exception 'Jogo não encontrado.'; end if;
  if auth.uid() is null or not public.is_section_admin(v_section_id) then
    raise exception 'Somente o administrador da seção pode excluir este jogo.' using errcode = '42501';
  end if;
  delete from public.events where id = p_event_id;
end;
$$;
revoke all on function public.delete_section_event(uuid) from public, anon;
grant execute on function public.delete_section_event(uuid) to authenticated;
