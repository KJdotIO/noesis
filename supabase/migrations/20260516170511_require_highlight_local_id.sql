update public.user_highlights
set local_id = id::text
where local_id is null;

drop index if exists public.user_highlights_user_id_local_id_idx;

alter table public.user_highlights
  alter column local_id set not null;

create unique index if not exists user_highlights_user_id_local_id_idx
  on public.user_highlights(user_id, local_id);
