alter table public.user_highlights
  add column if not exists local_id text;

create unique index if not exists user_highlights_user_id_local_id_idx
  on public.user_highlights(user_id, local_id)
  where local_id is not null;
