begin;

-- Execute este arquivo com um usuário autenticado de teste e substitua os UUIDs.
-- Cada caso deve ser executado em transação para não deixar dados no banco.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);

do $$
begin
  begin
    perform public.create_game_style('00000000-0000-0000-0000-000000000010', 'Sem permissão', 4, false, 1, 2, 1);
    raise exception 'membro comum não deveria criar estilo';
  exception when others then
    if sqlerrm not like '%Somente o administrador%' then raise; end if;
  end;
end;
$$;

-- Asserções de banco para uso no ambiente Supabase local/CI:
-- 1) admin da seção consegue criar/editar/excluir;
-- 2) admin de outra seção falha;
-- 3) nome duplicado, soma inválida e 21º estilo falham;
-- 4) custom sem estilo falha;
-- 5) excluir estilo mantém events.players_per_team/has_goalkeeper/defenders/midfielders/attackers.

rollback;
