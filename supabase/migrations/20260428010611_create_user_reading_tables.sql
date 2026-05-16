create table if not exists public.user_saved_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_slug text not null,
  title text not null,
  source_url text not null,
  saved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_slug)
);

create table if not exists public.user_reading_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_slug text not null,
  source_url text not null,
  scroll_y integer not null default 0,
  scroll_ratio numeric not null default 0 check (scroll_ratio >= 0 and scroll_ratio <= 1),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_slug)
);

create table if not exists public.user_highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_slug text not null,
  source_url text not null,
  quote text not null,
  note text,
  text_position integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_saved_entries_user_id_idx
  on public.user_saved_entries(user_id);

create index if not exists user_reading_positions_user_id_idx
  on public.user_reading_positions(user_id);

create index if not exists user_highlights_user_id_entry_slug_idx
  on public.user_highlights(user_id, entry_slug);

alter table public.user_saved_entries enable row level security;
alter table public.user_reading_positions enable row level security;
alter table public.user_highlights enable row level security;

create policy "Users can read own saved entries"
  on public.user_saved_entries
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own saved entries"
  on public.user_saved_entries
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own saved entries"
  on public.user_saved_entries
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own saved entries"
  on public.user_saved_entries
  for delete
  using (auth.uid() = user_id);

create policy "Users can read own reading positions"
  on public.user_reading_positions
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own reading positions"
  on public.user_reading_positions
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own reading positions"
  on public.user_reading_positions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own reading positions"
  on public.user_reading_positions
  for delete
  using (auth.uid() = user_id);

create policy "Users can read own highlights"
  on public.user_highlights
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own highlights"
  on public.user_highlights
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own highlights"
  on public.user_highlights
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own highlights"
  on public.user_highlights
  for delete
  using (auth.uid() = user_id);
