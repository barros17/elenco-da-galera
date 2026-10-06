drop policy "Users can view their own players" on public.players;

create policy "Authenticated users can view the shared roster"
  on public.players for select
  to authenticated
  using (true);

create unique index players_one_per_user_idx on public.players (user_id);
