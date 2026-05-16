drop policy if exists "Anyone can read catalogue entries" on public.entries;
drop policy if exists "Anyone can read catalogue authors" on public.authors;
drop policy if exists "Anyone can read catalogue entry authors" on public.entry_authors;

revoke all on table public.entries from public;
revoke all on table public.authors from public;
revoke all on table public.entry_authors from public;
revoke all on table public.entries from anon, authenticated;
revoke all on table public.authors from anon, authenticated;
revoke all on table public.entry_authors from anon, authenticated;

drop extension if exists pg_graphql;

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
