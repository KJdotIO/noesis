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

revoke all on public.user_saved_entries from anon;
revoke all on public.user_reading_positions from anon;
revoke all on public.user_highlights from anon;

grant select, insert, update, delete on public.user_saved_entries to authenticated;
grant select, insert, update, delete on public.user_reading_positions to authenticated;
grant select, insert, update, delete on public.user_highlights to authenticated;

create policy "Users can read own saved entries"
  on public.user_saved_entries
  for select
  using ((select auth.uid()) = user_id);

create policy "Users can insert own saved entries"
  on public.user_saved_entries
  for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update own saved entries"
  on public.user_saved_entries
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own saved entries"
  on public.user_saved_entries
  for delete
  using ((select auth.uid()) = user_id);

create policy "Users can read own reading positions"
  on public.user_reading_positions
  for select
  using ((select auth.uid()) = user_id);

create policy "Users can insert own reading positions"
  on public.user_reading_positions
  for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update own reading positions"
  on public.user_reading_positions
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own reading positions"
  on public.user_reading_positions
  for delete
  using ((select auth.uid()) = user_id);

create policy "Users can read own highlights"
  on public.user_highlights
  for select
  using ((select auth.uid()) = user_id);

create policy "Users can insert own highlights"
  on public.user_highlights
  for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update own highlights"
  on public.user_highlights
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own highlights"
  on public.user_highlights
  for delete
  using ((select auth.uid()) = user_id);
