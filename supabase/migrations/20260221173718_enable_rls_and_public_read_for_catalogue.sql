create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  issued date not null,
  modified date not null,
  source_url text not null,
  fetched_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug),
  unique (source_url)
);

create table if not exists public.authors (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  sort_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (display_name)
);

create table if not exists public.entry_authors (
  entry_id uuid not null references public.entries(id) on delete cascade,
  author_id uuid not null references public.authors(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (entry_id, author_id),
  unique (entry_id, position)
);

create index if not exists entries_slug_idx
  on public.entries(slug);

create index if not exists entry_authors_author_id_idx
  on public.entry_authors(author_id);

alter table public.entries enable row level security;
alter table public.authors enable row level security;
alter table public.entry_authors enable row level security;

revoke insert, update, delete on public.entries from anon, authenticated;
revoke insert, update, delete on public.authors from anon, authenticated;
revoke insert, update, delete on public.entry_authors from anon, authenticated;

grant select on public.entries to anon, authenticated;
grant select on public.authors to anon, authenticated;
grant select on public.entry_authors to anon, authenticated;

create policy "Anyone can read catalogue entries"
  on public.entries
  for select
  using (true);

create policy "Anyone can read catalogue authors"
  on public.authors
  for select
  using (true);

create policy "Anyone can read catalogue entry authors"
  on public.entry_authors
  for select
  using (true);
