alter table public.user_highlights
  add column if not exists color text,
  add column if not exists occurrence_index integer,
  add column if not exists prefix text,
  add column if not exists suffix text;

alter table public.user_highlights
  drop constraint if exists user_highlights_color_check;

alter table public.user_highlights
  add constraint user_highlights_color_check
  check (color is null or color in ('yellow', 'green', 'blue', 'pink', 'purple'));
