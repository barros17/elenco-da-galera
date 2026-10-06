create table public.players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  position text not null check (position in ('GOL', 'ZAG', 'LAT', 'VOL', 'MEI', 'ATA')),
  skills jsonb not null default '{}'::jsonb,
  weak_foot integer not null default 0 check (weak_foot between 0 and 5),
  overall integer not null default 1 check (overall between 1 and 99),
  photo_url text,
  created_at timestamptz not null default now()
);

revoke all on public.players from anon;
grant select, insert, update, delete on public.players to authenticated;

create index players_user_id_overall_idx
  on public.players (user_id, overall desc);

alter table public.players enable row level security;

create policy "Users can view their own players"
  on public.players for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own players"
  on public.players for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own players"
  on public.players for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own players"
  on public.players for delete
  to authenticated
  using ((select auth.uid()) = user_id);
