export type HighlightColor = "yellow" | "green" | "blue" | "pink" | "purple";

export type UserSavedEntryRow = {
  id: string;
  user_id: string;
  entry_slug: string;
  title: string;
  source_url: string;
  saved_at: string;
  created_at: string;
  updated_at: string;
};

export type UserReadingPositionRow = {
  id: string;
  user_id: string;
  entry_slug: string;
  source_url: string;
  scroll_y: number;
  scroll_ratio: number;
  updated_at: string;
};

export type UserHighlightRow = {
  id: string;
  user_id: string;
  local_id: string;
  entry_slug: string;
  source_url: string;
  quote: string;
  note: string | null;
  color: HighlightColor | null;
  text_position: number | null;
  occurrence_index: number | null;
  prefix: string | null;
  suffix: string | null;
  created_at: string;
  updated_at: string;
};

export type UserSavedEntrySyncRow = Pick<
  UserSavedEntryRow,
  "entry_slug" | "title" | "source_url" | "saved_at"
>;

export type UserReadingPositionSyncRow = Pick<
  UserReadingPositionRow,
  "entry_slug" | "source_url" | "scroll_y" | "scroll_ratio" | "updated_at"
>;

export type UserHighlightSyncRow = Pick<
  UserHighlightRow,
  | "id"
  | "local_id"
  | "entry_slug"
  | "source_url"
  | "quote"
  | "note"
  | "color"
  | "text_position"
  | "occurrence_index"
  | "prefix"
  | "suffix"
  | "created_at"
  | "updated_at"
>;
