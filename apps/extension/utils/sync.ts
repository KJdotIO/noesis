import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { GuestState } from "./guest-storage";

export type SyncSummary = {
  savedEntries: number;
  readingPositions: number;
  highlights: number;
};

export async function syncGuestStateToSupabase(
  supabase: SupabaseClient,
  user: User,
  state: GuestState,
): Promise<SyncSummary> {
  const savedEntries = Object.values(state.savedEntries);
  const readingPositions = Object.values(state.readingPositions);
  const highlights = Object.values(state.highlights).flat();

  if (savedEntries.length > 0) {
    const { error } = await supabase.from("user_saved_entries").upsert(
      savedEntries.map((entry) => ({
        user_id: user.id,
        entry_slug: entry.slug,
        title: entry.title,
        source_url: entry.url,
        saved_at: entry.savedAt,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "user_id,entry_slug" },
    );

    if (error) {
      throw error;
    }
  }

  if (readingPositions.length > 0) {
    const { error } = await supabase.from("user_reading_positions").upsert(
      readingPositions.map((position) => ({
        user_id: user.id,
        entry_slug: position.slug,
        source_url: position.url,
        scroll_y: position.scrollY,
        scroll_ratio: position.scrollRatio,
        updated_at: position.updatedAt,
      })),
      { onConflict: "user_id,entry_slug" },
    );

    if (error) {
      throw error;
    }
  }

  if (highlights.length > 0) {
    const { error } = await supabase.from("user_highlights").upsert(
      highlights.map((highlight) => ({
        user_id: user.id,
        local_id: highlight.id,
        entry_slug: highlight.slug,
        source_url: highlight.url,
        quote: highlight.quote,
        note: highlight.note ?? null,
        color: highlight.color ?? null,
        text_position: highlight.textPosition ?? null,
        occurrence_index: highlight.occurrenceIndex ?? null,
        prefix: highlight.prefix ?? null,
        suffix: highlight.suffix ?? null,
        created_at: highlight.createdAt,
        updated_at: highlight.updatedAt,
      })),
      { onConflict: "user_id,local_id" },
    );

    if (error) {
      throw error;
    }
  }

  return {
    savedEntries: savedEntries.length,
    readingPositions: readingPositions.length,
    highlights: highlights.length,
  };
}
