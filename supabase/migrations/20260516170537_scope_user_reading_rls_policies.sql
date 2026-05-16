drop policy if exists "Users can read own saved entries" on public.user_saved_entries;
drop policy if exists "Users can insert own saved entries" on public.user_saved_entries;
drop policy if exists "Users can update own saved entries" on public.user_saved_entries;
drop policy if exists "Users can delete own saved entries" on public.user_saved_entries;

drop policy if exists "Users can read own reading positions" on public.user_reading_positions;
drop policy if exists "Users can insert own reading positions" on public.user_reading_positions;
drop policy if exists "Users can update own reading positions" on public.user_reading_positions;
drop policy if exists "Users can delete own reading positions" on public.user_reading_positions;

drop policy if exists "Users can read own highlights" on public.user_highlights;
drop policy if exists "Users can insert own highlights" on public.user_highlights;
drop policy if exists "Users can update own highlights" on public.user_highlights;
drop policy if exists "Users can delete own highlights" on public.user_highlights;

revoke all on public.user_saved_entries from public;
revoke all on public.user_reading_positions from public;
revoke all on public.user_highlights from public;

revoke all on public.user_saved_entries from anon;
revoke all on public.user_reading_positions from anon;
revoke all on public.user_highlights from anon;

revoke all on public.user_saved_entries from authenticated;
revoke all on public.user_reading_positions from authenticated;
revoke all on public.user_highlights from authenticated;

grant select, insert, update, delete on public.user_saved_entries to authenticated;
grant select, insert, update, delete on public.user_reading_positions to authenticated;
grant select, insert, update, delete on public.user_highlights to authenticated;

create policy "Users can read own saved entries"
  on public.user_saved_entries
  for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can insert own saved entries"
  on public.user_saved_entries
  for insert
  to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can update own saved entries"
  on public.user_saved_entries
  for update
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can delete own saved entries"
  on public.user_saved_entries
  for delete
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can read own reading positions"
  on public.user_reading_positions
  for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can insert own reading positions"
  on public.user_reading_positions
  for insert
  to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can update own reading positions"
  on public.user_reading_positions
  for update
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can delete own reading positions"
  on public.user_reading_positions
  for delete
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can read own highlights"
  on public.user_highlights
  for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can insert own highlights"
  on public.user_highlights
  for insert
  to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can update own highlights"
  on public.user_highlights
  for update
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can delete own highlights"
  on public.user_highlights
  for delete
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
