alter table public.authors
  add column if not exists updated_at timestamptz not null default now();
