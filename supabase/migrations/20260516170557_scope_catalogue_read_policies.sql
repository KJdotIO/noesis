drop policy if exists "Anyone can read catalogue entries" on public.entries;
drop policy if exists "Anyone can read catalogue authors" on public.authors;
drop policy if exists "Anyone can read catalogue entry authors" on public.entry_authors;
drop policy if exists "Public can read entries" on public.entries;
drop policy if exists "Public can read authors" on public.authors;
drop policy if exists "Public can read entry_authors" on public.entry_authors;

revoke all on public.entries from public;
revoke all on public.authors from public;
revoke all on public.entry_authors from public;

revoke all on public.entries from anon;
revoke all on public.authors from anon;
revoke all on public.entry_authors from anon;

revoke all on public.entries from authenticated;
revoke all on public.authors from authenticated;
revoke all on public.entry_authors from authenticated;

grant select on public.entries to anon, authenticated;
grant select on public.authors to anon, authenticated;
grant select on public.entry_authors to anon, authenticated;

create policy "Anyone can read catalogue entries"
  on public.entries
  for select
  to anon, authenticated
  using (true);

create policy "Anyone can read catalogue authors"
  on public.authors
  for select
  to anon, authenticated
  using (true);

create policy "Anyone can read catalogue entry authors"
  on public.entry_authors
  for select
  to anon, authenticated
  using (true);
